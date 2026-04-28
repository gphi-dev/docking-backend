import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { Game } from "../models/index.js";
import {
  hasConfiguredS3UploadCredentials,
  isImageDataUrl,
  resolveGameImageUrl,
  resolveStoredGameImageUrl,
} from "../utils/gameImageStorage.js";
import {
  getGameDetailsById,
  getGameDetailsByIdentifier,
  getGameDetailsBySlug,
  getGamesCatalog,
} from "../services/games.service.js";

const DEFAULT_GAME_SECTION_LIMIT = 10;
const MAX_GAME_SECTION_LIMIT = 50;
const GAME_NAME_MAX_LENGTH = 255;
const GAME_ID_MAX_LENGTH = 45;
const GAME_URL_MAX_LENGTH = 255;
const GAME_SECRET_KEY_MAX_LENGTH = 45;

function createBadRequestError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseGamesSectionLimit(rawValue, queryParamName) {
  if (rawValue === undefined) {
    return DEFAULT_GAME_SECTION_LIMIT;
  }

  const parsedValue = Number.parseInt(String(rawValue), 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    const error = new Error(`${queryParamName} must be a positive integer`);
    error.status = 400;
    throw error;
  }

  return Math.min(parsedValue, MAX_GAME_SECTION_LIMIT);
}

function normalizeRequiredGameName(rawValue, message = "name is required") {
  if (!rawValue || typeof rawValue !== "string") {
    throw createBadRequestError(message);
  }

  const normalizedName = rawValue.trim();
  if (!normalizedName) {
    throw createBadRequestError(message);
  }

  if (normalizedName.length > GAME_NAME_MAX_LENGTH) {
    throw createBadRequestError(`name must be ${GAME_NAME_MAX_LENGTH} characters or less`);
  }

  return normalizedName;
}

function normalizeOptionalGameId(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  const normalizedGameId = String(rawValue).trim();
  if (normalizedGameId.length > GAME_ID_MAX_LENGTH) {
    throw createBadRequestError(`game_id must be ${GAME_ID_MAX_LENGTH} characters or less`);
  }

  return normalizedGameId || null;
}

function normalizeOptionalGameUrl(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  const normalizedGameUrl = String(rawValue).trim();
  if (normalizedGameUrl.length > GAME_URL_MAX_LENGTH) {
    throw createBadRequestError(`game_url must be ${GAME_URL_MAX_LENGTH} characters or less`);
  }

  return normalizedGameUrl || null;
}

function normalizeOptionalGameSecretKey(rawValue) {
  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue === null) {
    return null;
  }

  const normalizedGameSecretKey = String(rawValue).trim();
  if (normalizedGameSecretKey.length > GAME_SECRET_KEY_MAX_LENGTH) {
    throw createBadRequestError(`game_secret_key must be ${GAME_SECRET_KEY_MAX_LENGTH} characters or less`);
  }

  return normalizedGameSecretKey || null;
}

function readGameSecretKeyPayload(body) {
  if (Object.prototype.hasOwnProperty.call(body ?? {}, "game_secret_key")) {
    return body.game_secret_key;
  }

  if (Object.prototype.hasOwnProperty.call(body ?? {}, "gamesecretkey")) {
    return body.gamesecretkey;
  }

  return undefined;
}

function isDuplicateGameUrlError(error) {
  if (error?.name !== "SequelizeUniqueConstraintError" && error?.parent?.code !== "ER_DUP_ENTRY") {
    return false;
  }

  const fieldNames = [
    ...Object.keys(error?.fields ?? {}),
    ...(error?.errors ?? []).map((validationError) => validationError.path),
  ].filter(Boolean);
  const databaseMessage = String(error?.parent?.sqlMessage ?? error?.original?.sqlMessage ?? error?.message ?? "");

  return fieldNames.includes("game_url") || databaseMessage.includes("game_url");
}

function isDatabaseValueTooLongError(error) {
  return error?.parent?.code === "ER_DATA_TOO_LONG" || String(error?.parent?.sqlMessage ?? "").includes("Data too long");
}

async function resolveGameImageUrlForUpdate(imageValue, currentImageUrl) {
  if (imageValue === undefined) {
    return undefined;
  }

  if (isImageDataUrl(imageValue) && currentImageUrl && !hasConfiguredS3UploadCredentials()) {
    return undefined;
  }

  return resolveGameImageUrl(imageValue);
}

async function serializeGameResponse(game) {
  const gamePayload = typeof game.get === "function" ? game.get({ plain: true }) : { ...game };
  gamePayload.image_url = await resolveStoredGameImageUrl(gamePayload.image_url);
  return gamePayload;
}

export async function listGames(req, res) {
  const featuredLimit = parseGamesSectionLimit(req.query.featured_limit, "featured_limit");
  const newLimit = parseGamesSectionLimit(req.query.new_limit, "new_limit");
  const payload = await getGamesCatalog({ featuredLimit, newLimit });
  return res.json(payload);
}

export async function getGameById(req, res) {
  const gameId = Number(req.params.gameId);
  if (!Number.isFinite(gameId)) {
    return res.status(400).json({ message: "Invalid game id" });
  }

  const game = await getGameDetailsById(gameId);
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

  const game = await getGameDetailsByIdentifier(identifier);
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

  const game = await getGameDetailsBySlug(slug);
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
  const name = normalizeRequiredGameName(req.body?.name);
  const game_id = normalizeOptionalGameId(req.body?.game_id);
  const game_url = normalizeOptionalGameUrl(req.body?.game_url);
  const gamesecretkey = normalizeOptionalGameSecretKey(readGameSecretKeyPayload(req.body));
  const description = req.body?.description ?? null;
  const imageUrl = await resolveGameImageUrl(req.body?.image_url ?? null);

  const generatedSlug = await generateUniqueSlug(name);

  let createdGame;
  try {
    createdGame = await Game.create({
      name,
      game_id,
      game_url,
      gamesecretkey,
      description,
      image_url: imageUrl,
      slug: generatedSlug,
    });
  } catch (error) {
    if (isDuplicateGameUrlError(error)) {
      return res.status(409).json({ message: "game_url is already taken" });
    }
    if (isDatabaseValueTooLongError(error)) {
      return res.status(400).json({ message: "One or more game fields exceed the allowed length" });
    }
    throw error;
  }

  return res.status(201).json(await serializeGameResponse(createdGame));
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
  const nextGameId = req.body?.game_id !== undefined
    ? normalizeOptionalGameId(req.body.game_id)
    : undefined;
  const nextGameUrl = req.body?.game_url !== undefined
    ? normalizeOptionalGameUrl(req.body.game_url)
    : undefined;
  const nextGameSecretKey = normalizeOptionalGameSecretKey(readGameSecretKeyPayload(req.body));
  const nextDescription = req.body?.description;
  const nextImageUrl = await resolveGameImageUrlForUpdate(req.body?.image_url, game.image_url);

  if (nextName !== undefined) {
    const normalizedNextName = normalizeRequiredGameName(
      nextName,
      "name must be a non-empty string when provided",
    );
    if (normalizedNextName !== game.name) {
      game.name = normalizedNextName;
      game.slug = await generateUniqueSlug(normalizedNextName, game.id);
    }
  }
  if (!game.slug || !String(game.slug).trim()) {
    game.slug = await generateUniqueSlug(game.name, game.id);
  }
  if (nextGameId !== undefined) {
    game.game_id = nextGameId;
  }
  if (nextGameUrl !== undefined) {
    game.game_url = nextGameUrl;
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

  try {
    await game.save();
  } catch (error) {
    if (isDuplicateGameUrlError(error)) {
      return res.status(409).json({ message: "game_url is already taken" });
    }
    if (isDatabaseValueTooLongError(error)) {
      return res.status(400).json({ message: "One or more game fields exceed the allowed length" });
    }
    throw error;
  }

  return res.json(await serializeGameResponse(game));
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
