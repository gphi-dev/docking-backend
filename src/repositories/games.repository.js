import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database.js";

let gamesTableDefinitionPromise;

async function getGamesTableDefinition() {
  if (!gamesTableDefinitionPromise) {
    gamesTableDefinitionPromise = sequelize
      .getQueryInterface()
      .describeTable("games")
      .catch((error) => {
        gamesTableDefinitionPromise = undefined;
        throw error;
      });
  }

  return gamesTableDefinitionPromise;
}

export async function hasGamesTableColumn(columnName) {
  const tableDefinition = await getGamesTableDefinition();
  return Object.prototype.hasOwnProperty.call(tableDefinition, columnName);
}

async function getGamesColumnSupport() {
  const [hasGameId, hasGameSecretKey, hasSlug] = await Promise.all([
    hasGamesTableColumn("game_id"),
    hasGamesTableColumn("gamesecretkey"),
    hasGamesTableColumn("slug"),
  ]);

  return { hasGameId, hasGameSecretKey, hasSlug };
}

function buildGameSelectColumns(columnSupport, options = {}) {
  const includeGameSecretKey = options.includeGameSecretKey === true;
  const selectedColumns = [
    "games.id",
    columnSupport.hasGameId ? "games.game_id" : "NULL AS game_id",
    columnSupport.hasSlug ? "games.slug" : "NULL AS slug",
    "games.name",
    "games.description",
    "games.image_url",
    "games.created_at",
  ];

  if (includeGameSecretKey) {
    selectedColumns.splice(
      3,
      0,
      columnSupport.hasGameSecretKey ? "games.gamesecretkey" : "NULL AS gamesecretkey",
    );
  }

  return selectedColumns;
}

function buildFeaturedGamesGroupBy(columnSupport) {
  const groupByColumns = [
    "games.id",
    "games.name",
    "games.description",
    "games.image_url",
    "games.created_at",
  ];

  if (columnSupport.hasGameId) {
    groupByColumns.splice(1, 0, "games.game_id");
  }

  if (columnSupport.hasSlug) {
    groupByColumns.splice(groupByColumns.length - 1, 0, "games.slug");
  }

  return groupByColumns;
}

function mapGameRecord(record, options = {}) {
  const includeGameSecretKey = options.includeGameSecretKey === true;
  const includeTotalPlayers = options.includeTotalPlayers === true;

  return {
    id: record.id,
    game_id: record.game_id ?? null,
    slug: record.slug ?? null,
    ...(includeGameSecretKey
      ? {
          gamesecretkey: record.gamesecretkey ?? null,
          game_secret_key: record.gamesecretkey ?? null,
        }
      : {}),
    name: record.name,
    description: record.description ?? null,
    image_url: record.image_url ?? null,
    created_at: record.created_at,
    ...(includeTotalPlayers ? { total_players: Number(record.total_players ?? 0) } : {}),
  };
}

export async function listPublicGames() {
  const columnSupport = await getGamesColumnSupport();
  const selectedColumns = buildGameSelectColumns(columnSupport);
  const games = await sequelize.query(
    `
      SELECT ${selectedColumns.join(", ")}
      FROM games
      ORDER BY games.created_at DESC
    `,
    {
      type: QueryTypes.SELECT,
    },
  );

  return games.map((game) => mapGameRecord(game));
}

export async function listNewestPublicGames(limit) {
  const columnSupport = await getGamesColumnSupport();
  const selectedColumns = buildGameSelectColumns(columnSupport);

  // New games is the latest slice of the public games list by creation time.
  const games = await sequelize.query(
    `
      SELECT ${selectedColumns.join(", ")}
      FROM games
      ORDER BY games.created_at DESC
      LIMIT :limit
    `,
    {
      replacements: { limit },
      type: QueryTypes.SELECT,
    },
  );

  return games.map((game) => mapGameRecord(game));
}

export async function listFeaturedPublicGames(limit) {
  const columnSupport = await getGamesColumnSupport();
  const selectedColumns = buildGameSelectColumns(columnSupport);

  if (!columnSupport.hasGameId) {
    const games = await sequelize.query(
      `
        SELECT ${selectedColumns.join(", ")}, 0 AS total_players
        FROM games
        ORDER BY games.created_at DESC
        LIMIT :limit
      `,
      {
        replacements: { limit },
        type: QueryTypes.SELECT,
      },
    );

    return games.map((game) => mapGameRecord(game, { includeTotalPlayers: true }));
  }

  const groupByColumns = buildFeaturedGamesGroupBy(columnSupport);

  // Featured games uses a LEFT JOIN so titles without player rows can still appear with 0 players.
  const games = await sequelize.query(
    `
      SELECT
        ${selectedColumns.join(",\n        ")},
        COUNT(usersmobile.id) AS total_players
      FROM games
      LEFT JOIN usersmobile
        ON usersmobile.game_id = games.game_id
      GROUP BY ${groupByColumns.join(", ")}
      ORDER BY total_players DESC, games.created_at DESC
      LIMIT :limit
    `,
    {
      replacements: { limit },
      type: QueryTypes.SELECT,
    },
  );

  return games.map((game) => mapGameRecord(game, { includeTotalPlayers: true }));
}

export async function findGameById(gameId, options = {}) {
  const columnSupport = await getGamesColumnSupport();
  const selectedColumns = buildGameSelectColumns(columnSupport, options);
  const [game] = await sequelize.query(
    `
      SELECT ${selectedColumns.join(", ")}
      FROM games
      WHERE games.id = :gameId
      LIMIT 1
    `,
    {
      replacements: { gameId },
      type: QueryTypes.SELECT,
    },
  );

  return game ? mapGameRecord(game, options) : null;
}

export async function findGameBySlug(slug, options = {}) {
  const columnSupport = await getGamesColumnSupport();
  if (!columnSupport.hasSlug) {
    return null;
  }

  const selectedColumns = buildGameSelectColumns(columnSupport, options);
  const [game] = await sequelize.query(
    `
      SELECT ${selectedColumns.join(", ")}
      FROM games
      WHERE games.slug = :slug
      LIMIT 1
    `,
    {
      replacements: { slug },
      type: QueryTypes.SELECT,
    },
  );

  return game ? mapGameRecord(game, options) : null;
}
