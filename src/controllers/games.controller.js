import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { Game } from "../models/index.js";

async function hasGamesTableColumn(columnName) {
  const tableDefinition = await sequelize.getQueryInterface().describeTable("games");
  return Object.prototype.hasOwnProperty.call(tableDefinition, columnName);
}

async function selectGamesWithOptionalGameId(whereClause = "", replacements = {}) {
  const includesGameId = await hasGamesTableColumn("game_id");
  const selectedColumns = [
    "id",
    "name",
    "description",
    "image_url",
    "created_at",
  ];

  if (includesGameId) {
    selectedColumns.splice(1, 0, "game_id");
  }

  const games = await sequelize.query(
    `SELECT ${selectedColumns.join(", ")} FROM games ${whereClause}`.trim(),
    {
      replacements,
      type: QueryTypes.SELECT,
    },
  );

  return games.map((game) => ({
    ...game,
    game_id: game.game_id ?? null,
  }));
}

export async function listGames(_req, res) {
  const games = await selectGamesWithOptionalGameId("ORDER BY created_at DESC");
  return res.json(games);
}

export async function getGameById(req, res) {
  const gameId = Number(req.params.gameId);
  if (!Number.isFinite(gameId)) {
    return res.status(400).json({ message: "Invalid game id" });
  }

  const [game] = await selectGamesWithOptionalGameId("WHERE id = :gameId LIMIT 1", { gameId });
  if (!game) {
    return res.status(404).json({ message: "Game not found" });
  }
  return res.json(game);
}

export async function createGame(req, res) {
  const name = req.body?.name;
  const game_id = Number(req.body?.game_id);
  const game_secret_key = req.body?.game_secret_key;
  const description = req.body?.description ?? null;
  const imageUrl = req.body?.image_url ?? null;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "name is required" });
  }

  const createdGame = await Game.create({
    name,
    game_id,
    game_secret_key,
    description,
    image_url: imageUrl,
  });

  return res.status(201).json(createdGame);
}

export async function updateGame(req, res) {
  const gameId = Number(req.params.gameId);
  if (!Number.isFinite(gameId)) {
    return res.status(400).json({ message: "Invalid game id" });
  }

  const game = await Game.findByPk(gameId);
  if (!game) {
    return res.status(404).json({ message: "Game not found" });
  }

  const nextName = req.body?.name;
  const nextGameId = Number(req.body?.game_id);
  const nextGameSecretKey = req.body?.game_secret_key;
  const nextDescription = req.body?.description;
  const nextImageUrl = req.body?.image_url;

  if (nextName !== undefined) {
    if (!nextName || typeof nextName !== "string") {
      return res.status(400).json({ message: "name must be a non-empty string when provided" });
    }
    game.name = nextName;
  }
  if (nextGameId !== undefined) {
    if (!Number.isFinite(nextGameId)) {
      return res.status(400).json({ message: "game_id must be a valid integer" });
    }
    game.game_id = nextGameId;
  }
  if (nextGameSecretKey !== undefined) {
    game.game_secret_key = nextGameSecretKey;
  }
  if (nextDescription !== undefined) {
    game.description = nextDescription;
  }
  if (nextImageUrl !== undefined) {
    game.image_url = nextImageUrl;
  }

  await game.save();
  return res.json(game);
}

export async function deleteGame(req, res) {
  const gameId = Number(req.params.gameId);
  if (!Number.isFinite(gameId)) {
    return res.status(400).json({ message: "Invalid game id" });
  }

  const deletedRowCount = await Game.destroy({ where: { id: gameId } });
  if (deletedRowCount === 0) {
    return res.status(404).json({ message: "Game not found" });
  }

  return res.status(204).send();
}
