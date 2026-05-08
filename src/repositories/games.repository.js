import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { resolveStoredGameImageUrl } from "../utils/gameImageStorage.js";

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
  const [
    hasGameId,
    hasGameUrl,
    hasGameSecretKey,
    hasIsLandscape,
    hasIsMobile,
    hasSlug,
    hasBackgroundUrl,
  ] = await Promise.all([
    hasGamesTableColumn("game_id"),
    hasGamesTableColumn("game_url"),
    hasGamesTableColumn("gamesecretkey"),
    hasGamesTableColumn("is_landscape"),
    hasGamesTableColumn("is_mobile"),
    hasGamesTableColumn("slug"),
    hasGamesTableColumn("background_url"),
  ]);

  return {
    hasGameId,
    hasGameUrl,
    hasGameSecretKey,
    hasIsLandscape,
    hasIsMobile,
    hasSlug,
    hasBackgroundUrl,
  };
}

function buildGameSelectColumns(columnSupport, options = {}) {
  const includeGameSecretKey = options.includeGameSecretKey === true;
  const selectedColumns = [
    "games.id",
    columnSupport.hasGameId ? "games.game_id" : "NULL AS game_id",
    columnSupport.hasGameUrl ? "games.game_url" : "NULL AS game_url",
    columnSupport.hasSlug ? "games.slug" : "NULL AS slug",
    "games.name",
    columnSupport.hasIsLandscape ? "games.is_landscape" : "'False' AS is_landscape",
    columnSupport.hasIsMobile ? "games.is_mobile" : "'False' AS is_mobile",
    "games.description",
    "games.image_url",
    columnSupport.hasBackgroundUrl ? "games.background_url" : "NULL AS background_url",
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

  if (columnSupport.hasGameUrl) {
    groupByColumns.splice(columnSupport.hasGameId ? 2 : 1, 0, "games.game_url");
  }

  if (columnSupport.hasSlug) {
    groupByColumns.splice(groupByColumns.length - 1, 0, "games.slug");
  }

  if (columnSupport.hasIsLandscape) {
    groupByColumns.splice(groupByColumns.length - 1, 0, "games.is_landscape");
  }

  if (columnSupport.hasIsMobile) {
    groupByColumns.splice(groupByColumns.length - 1, 0, "games.is_mobile");
  }

  if (columnSupport.hasBackgroundUrl) {
    groupByColumns.splice(groupByColumns.length - 1, 0, "games.background_url");
  }

  return groupByColumns;
}

async function mapGameRecord(record, options = {}) {
  const includeGameSecretKey = options.includeGameSecretKey === true;
  const includeTotalPlayers = options.includeTotalPlayers === true;
  const [imageUrl, backgroundUrl] = await Promise.all([
    resolveStoredGameImageUrl(record.image_url),
    resolveStoredGameImageUrl(record.background_url),
  ]);

  return {
    id: record.id,
    game_id: record.game_id ?? null,
    game_url: record.game_url ?? null,
    slug: record.slug ?? null,
    is_landscape: record.is_landscape ?? "False",
    is_mobile: record.is_mobile ?? "False",
    ...(includeGameSecretKey
      ? {
          gamesecretkey: record.gamesecretkey ?? null,
          game_secret_key: record.gamesecretkey ?? null,
        }
      : {}),
    name: record.name,
    description: record.description ?? null,
    image_url: imageUrl,
    background_url: backgroundUrl,
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

  return Promise.all(games.map((game) => mapGameRecord(game)));
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

  return Promise.all(games.map((game) => mapGameRecord(game)));
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

    return Promise.all(games.map((game) => mapGameRecord(game, { includeTotalPlayers: true })));
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

  return Promise.all(games.map((game) => mapGameRecord(game, { includeTotalPlayers: true })));
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
