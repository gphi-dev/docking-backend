import {
  createRewardRecord,
  deleteRewardRecord,
  drawRewardRecord,
  getRewardRecordById,
  listRewardRecords,
  updateRewardProbabilitiesForGame,
  updateRewardRecord,
  updateRewardStatusRecord,
} from "../services/rewards.service.js";
import { Game } from "../models/index.js";

const DEFAULT_REWARD_PAGE_SIZE = 10;
const MAX_REWARD_PAGE_SIZE = 100;
const PICTURE_MAX_LENGTH = 255;
const PRIZE_MAX_LENGTH = 255;

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hasOwn(body, fieldName) {
  return Object.prototype.hasOwnProperty.call(body ?? {}, fieldName);
}

function parsePositiveInteger(rawValue, fieldName) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    throw createHttpError(`${fieldName} is required`);
  }

  if (typeof rawValue === "boolean") {
    throw createHttpError(`${fieldName} must be a positive integer`);
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw createHttpError(`${fieldName} must be a positive integer`);
  }

  return parsedValue;
}

function parseOptionalPositiveInteger(rawValue, fieldName) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return undefined;
  }

  return parsePositiveInteger(rawValue, fieldName);
}

function parsePaginationInteger(rawValue, fieldName, fallbackValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return fallbackValue;
  }

  if (typeof rawValue === "boolean") {
    throw createHttpError(`${fieldName} must be a positive integer`);
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw createHttpError(`${fieldName} must be a positive integer`);
  }

  return parsedValue;
}

function normalizeProbability(rawValue, fieldName = "probability") {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    throw createHttpError(`${fieldName} is required`);
  }

  if (typeof rawValue === "boolean") {
    throw createHttpError(`${fieldName} must be a number between 0 and 100`);
  }

  const probability = Number(rawValue);
  if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
    throw createHttpError(`${fieldName} must be a number between 0 and 100`);
  }

  return Number(probability.toFixed(2));
}

function normalizeRequiredString(rawValue, fieldName, maxLength) {
  if (typeof rawValue !== "string") {
    throw createHttpError(`${fieldName} is required`);
  }

  const normalizedValue = rawValue.trim();
  if (!normalizedValue) {
    throw createHttpError(`${fieldName} is required`);
  }

  if (normalizedValue.length > maxLength) {
    throw createHttpError(`${fieldName} must be ${maxLength} characters or less`);
  }

  return normalizedValue;
}

function normalizeOptionalString(rawValue, fieldName, maxLength) {
  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue === null) {
    return null;
  }

  if (typeof rawValue !== "string") {
    throw createHttpError(`${fieldName} must be a string`);
  }

  const normalizedValue = rawValue.trim();
  if (normalizedValue.length > maxLength) {
    throw createHttpError(`${fieldName} must be ${maxLength} characters or less`);
  }

  return normalizedValue || null;
}

function normalizeOptionalText(rawValue, fieldName) {
  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue === null) {
    return null;
  }

  if (typeof rawValue !== "string") {
    throw createHttpError(`${fieldName} must be a string`);
  }

  return rawValue.trim() || null;
}

function normalizeHoldings(rawValue, options = {}) {
  const { defaultValue } = options;
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return undefined;
  }

  if (typeof rawValue === "boolean") {
    throw createHttpError("holdings must be an integer greater than or equal to 0");
  }

  const holdings = Number(rawValue);
  if (!Number.isInteger(holdings) || holdings < 0) {
    throw createHttpError("holdings must be an integer greater than or equal to 0");
  }

  return holdings;
}

function normalizeIsActive(rawValue, options = {}) {
  const { defaultValue, required = false } = options;
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    if (required) {
      throw createHttpError("is_active is required");
    }
    return defaultValue;
  }

  if (rawValue === true || rawValue === 1 || rawValue === "1") {
    return 1;
  }

  if (rawValue === false || rawValue === 0 || rawValue === "0") {
    return 0;
  }

  throw createHttpError("is_active must be 0 or 1");
}

function normalizeSearch(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }

  const normalizedSearch = String(rawValue).trim();
  return normalizedSearch || undefined;
}

function readGameSecretKeyPayload(body) {
  if (Object.prototype.hasOwnProperty.call(body ?? {}, "gamesecretkey")) {
    return body.gamesecretkey;
  }

  if (Object.prototype.hasOwnProperty.call(body ?? {}, "game_secret_key")) {
    return body.game_secret_key;
  }

  return undefined;
}

async function assertGameSecretKeyMatches(gameId, rawGameSecretKey) {
  if (gameId === undefined) {
    return;
  }

  if (rawGameSecretKey === undefined || rawGameSecretKey === null || String(rawGameSecretKey).trim() === "") {
    throw createHttpError("gamesecretkey is required when game_id is provided");
  }

  const game = await Game.findOne({
    attributes: ["game_id", "gamesecretkey"],
    where: { game_id: gameId },
  });

  if (!game) {
    throw createHttpError("Game not found", 404);
  }

  if (String(game.gamesecretkey ?? "").trim() !== String(rawGameSecretKey).trim()) {
    throw createHttpError("gamesecretkey does not match game_id", 401);
  }
}

function buildCreatePayload(body) {
  return {
    game_id: parsePositiveInteger(body?.game_id, "game_id"),
    picture: normalizeOptionalString(body?.picture, "picture", PICTURE_MAX_LENGTH) ?? null,
    description: normalizeOptionalText(body?.description, "description") ?? null,
    prize: normalizeRequiredString(body?.prize, "prize", PRIZE_MAX_LENGTH),
    holdings: normalizeHoldings(body?.holdings, { defaultValue: 0 }),
    is_active: normalizeIsActive(body?.is_active, { defaultValue: 1 }),
  };
}

function buildUpdatePayload(body) {
  const payload = {};

  if (hasOwn(body, "game_id")) {
    payload.game_id = parsePositiveInteger(body.game_id, "game_id");
  }
  if (hasOwn(body, "picture")) {
    payload.picture = normalizeOptionalString(body.picture, "picture", PICTURE_MAX_LENGTH);
  }
  if (hasOwn(body, "description")) {
    payload.description = normalizeOptionalText(body.description, "description");
  }
  if (hasOwn(body, "prize")) {
    payload.prize = normalizeRequiredString(body.prize, "prize", PRIZE_MAX_LENGTH);
  }
  if (hasOwn(body, "holdings")) {
    payload.holdings = normalizeHoldings(body.holdings);
  }
  if (hasOwn(body, "is_active")) {
    payload.is_active = normalizeIsActive(body.is_active, { required: true });
  }
  if (hasOwn(body, "probability")) {
    payload.probability = normalizeProbability(body.probability);
  }

  return payload;
}

function buildBulkProbabilityPayload(body) {
  const gameId = parsePositiveInteger(body?.game_id, "game_id");
  const rawRewards = Array.isArray(body?.rewards) ? body.rewards : body?.probabilities;

  if (!Array.isArray(rawRewards) || rawRewards.length === 0) {
    throw createHttpError("rewards must be a non-empty array");
  }

  const seenRewardIds = new Set();
  const rewards = rawRewards.map((reward, index) => {
    const rewardId = parsePositiveInteger(reward?.id ?? reward?.reward_id, `rewards[${index}].id`);
    if (seenRewardIds.has(rewardId)) {
      throw createHttpError("Duplicate reward id in rewards array");
    }
    seenRewardIds.add(rewardId);

    return {
      id: rewardId,
      probability: normalizeProbability(reward?.probability, `rewards[${index}].probability`),
    };
  });

  const totalProbabilityCents = rewards.reduce(
    (total, reward) => total + Math.round(reward.probability * 100),
    0,
  );
  if (totalProbabilityCents !== 10000) {
    throw createHttpError("Total probability must equal exactly 100.00");
  }

  return {
    gameId,
    rewards,
  };
}

export async function createReward(req, res) {
  const reward = await createRewardRecord(buildCreatePayload(req.body ?? {}));

  return res.status(201).json({
    success: true,
    message: "Reward created successfully",
    data: reward,
  });
}

export async function listRewards(req, res) {
  const filters = {
    ...req.query,
    ...(req.body ?? {}),
  };
  const page = parsePaginationInteger(filters.page, "page", 1);
  const requestedLimit = parsePaginationInteger(filters.limit, "limit", DEFAULT_REWARD_PAGE_SIZE);
  const limit = Math.min(requestedLimit, MAX_REWARD_PAGE_SIZE);
  const gameId = parseOptionalPositiveInteger(filters.game_id, "game_id");
  await assertGameSecretKeyMatches(gameId, readGameSecretKeyPayload(filters));

  const isActive = normalizeIsActive(filters.is_active);
  const search = normalizeSearch(filters.search);
  const { rewards, total } = await listRewardRecords({
    gameId,
    isActive,
    search,
    page,
    limit,
  });

  return res.json({
    success: true,
    message: "Rewards fetched successfully",
    data: rewards,
    pagination: {
      page,
      limit,
      total,
      total_pages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  });
}

export async function drawReward(req, res) {
  const gameId = parsePositiveInteger(req.body?.game_id, "game_id");
  await assertGameSecretKeyMatches(gameId, readGameSecretKeyPayload(req.body ?? {}));
  const rewards = await drawRewardRecord(gameId);

  return res.json({
    success: true,
    message: "Rewards drawn successfully",
    data: rewards,
    count: rewards.length,
  });
}

export async function updateRewardProbabilities(req, res) {
  const { gameId, rewards } = buildBulkProbabilityPayload(req.body ?? {});
  const updatedRewards = await updateRewardProbabilitiesForGame(gameId, rewards);

  return res.json({
    success: true,
    message: "Reward probabilities updated successfully",
    data: updatedRewards,
  });
}

export async function getRewardById(req, res) {
  const rewardId = parsePositiveInteger(req.params.id, "reward id");
  const reward = await getRewardRecordById(rewardId);

  if (!reward) {
    return res.status(404).json({
      success: false,
      message: "Reward not found",
    });
  }

  return res.json({
    success: true,
    message: "Reward fetched successfully",
    data: reward,
  });
}

export async function updateReward(req, res) {
  const rewardId = parsePositiveInteger(req.params.id, "reward id");
  const reward = await updateRewardRecord(rewardId, buildUpdatePayload(req.body ?? {}));

  return res.json({
    success: true,
    message: "Reward updated successfully",
    data: reward,
  });
}

export async function deleteReward(req, res) {
  const rewardId = parsePositiveInteger(req.params.id, "reward id");
  await deleteRewardRecord(rewardId);

  return res.json({
    success: true,
    message: "Reward deleted successfully",
  });
}

export async function updateRewardStatus(req, res) {
  const rewardId = parsePositiveInteger(req.params.id, "reward id");
  const isActive = normalizeIsActive(req.body?.is_active, { required: true });
  const reward = await updateRewardStatusRecord(rewardId, isActive);

  return res.json({
    success: true,
    message: "Reward status updated successfully",
    data: reward,
  });
}
