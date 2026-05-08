import {
  createRewardRecord,
  deleteRewardRecord,
  getRewardRecordById,
  listRewardRecords,
  updateRewardRecord,
  updateRewardStatusRecord,
} from "../services/rewards.service.js";

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

  return payload;
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
  const page = parsePaginationInteger(req.query.page, "page", 1);
  const requestedLimit = parsePaginationInteger(req.query.limit, "limit", DEFAULT_REWARD_PAGE_SIZE);
  const limit = Math.min(requestedLimit, MAX_REWARD_PAGE_SIZE);
  const gameId = parseOptionalPositiveInteger(req.query.game_id, "game_id");
  const isActive = normalizeIsActive(req.query.is_active);
  const search = normalizeSearch(req.query.search);
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
