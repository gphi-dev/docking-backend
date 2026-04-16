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
    "slug",
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

/**
 * @controller getGameByIdentifier
 * @description Retrieves a game by numeric ID or slug
 * @route GET /api/games/:identifier
 * @access Public (Admin Protected)
 */
export async function getGameByIdentifier(req, res) {
  const identifier = req.params.identifier;

  if (!identifier || typeof identifier !== "string") {
    return res.status(400).json({ message: "Invalid identifier" });
  }

  // Try to parse as numeric ID first
  const numericId = Number(identifier);
  if (Number.isFinite(numericId)) {
    const [game] = await selectGamesWithOptionalGameId("WHERE id = :id LIMIT 1", { id: numericId });
    if (game) {
      return res.json(game);
    }
  }

  // Try as slug
  const [game] = await selectGamesWithOptionalGameId("WHERE slug = :slug LIMIT 1", { slug: identifier });
  if (game) {
    return res.json(game);
  }

  return res.status(404).json({ message: "Game not found" });
}

/**
 * @controller getGameBySlug
 * @description Retrieves a game by its slug identifier
 * @route GET /api/games/:slug
 * @access Public (Admin Protected)
 */
export async function getGameBySlug(req, res) {
  const slug = req.params.slug;

  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ message: "Invalid slug" });
  }

  const [game] = await selectGamesWithOptionalGameId("WHERE slug = :slug LIMIT 1", { slug });
  if (!game) {
    return res.status(404).json({ message: "Game not found" });
  }
  return res.json(game);
}

function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Replace spaces and special characters with hyphens
    .replace(/[^a-z0-9 -]/g, '') 
    .replace(/\s+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/-+/g, '-');
}

/**
 * @helper generateUniqueSlug
 * @description Generates a unique slug by appending incrementing numbers if needed
 * @param {string} name - The game name to slugify
 * @param {number} currentGameId - Optional: exclude current game from uniqueness check
 * @returns {Promise<string>} Unique slug
 */
async function generateUniqueSlug(name, currentGameId = null) {
  let base = generateSlug(name);
  let slug = base;
  let i = 1;

  while (true) {
    const result = await sequelize.query(
      currentGameId
        ? "SELECT 1 FROM games WHERE slug = :slug AND id != :id LIMIT 1"
        : "SELECT 1 FROM games WHERE slug = :slug LIMIT 1",
      {
        replacements: { slug, ...(currentGameId && { id: currentGameId }) },
        type: QueryTypes.SELECT,
      }
    );
    
    if (result.length === 0) break;
    slug = `${base}-${i++}`;
  }

  return slug;
}

export async function createGame(req, res) {
  const name = req.body?.name;
  const game_id = Number(req.body?.game_id);
  const gamesecretkey = req.body?.game_secret_key;
  const description = req.body?.description ?? null;
  const imageUrl = req.body?.image_url ?? null;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "name is required" });
  }

  const generatedSlug = await generateUniqueSlug(name);

  const createdGame = await Game.create({
    name,
    game_id,
    gamesecretkey,
    description,
    image_url: imageUrl,
    slug: generatedSlug,
  });

  return res.status(201).json(createdGame);
}

export async function updateGame(req, res) {
  const gameId = Number(req.params.gameId);
  if (!Number.isFinite(gameId)) {
    return res.status(400).json({ message: "Invalid game id" });
  }

  const game = await Game.findOne({
    where: { id: gameId }
  });
  if (!game) {
    return res.status(404).json({ message: "Game not found" });
  }

  const nextName = req.body?.name;
  const nextGameId = req.body?.game_id !== undefined ? Number(req.body.game_id) : undefined;
  const nextGameSecretKey = req.body?.gamesecretkey;
  const nextDescription = req.body?.description;
  const nextImageUrl = req.body?.image_url;

  if (nextName !== undefined) {
    if (!nextName || typeof nextName !== "string") {
      return res.status(400).json({ message: "name must be a non-empty string when provided" });
    }
    if (nextName !== game.name) {
      game.name = nextName;
      game.slug = await generateUniqueSlug(nextName, game.id);
    }
  }
  if (nextGameId !== undefined) {
    if (!Number.isFinite(nextGameId)) {
      return res.status(400).json({ message: "game_id must be a valid integer" });
    }
    game.game_id = nextGameId;
  }
  if (nextGameSecretKey !== undefined) {
    game.gamesecretkey = nextGameSecretKey;
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

  const game = await Game.findOne({
    where: { id: gameId }
  });
  if (!game) {
    return res.status(404).json({ message: "Game not found" });
  }

  await game.destroy();
  return res.status(204).send();
}
