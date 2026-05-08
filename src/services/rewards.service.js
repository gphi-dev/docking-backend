import { Op } from "sequelize";
import { sequelize } from "../config/database.js";
import { Game, Reward } from "../models/index.js";

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function serializeId(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  const numericValue = Number(rawValue);
  return Number.isSafeInteger(numericValue) ? numericValue : String(rawValue);
}

function serializeProbability(rawValue) {
  const probability = Number(rawValue ?? 0);
  return Number.isFinite(probability) ? Number(probability.toFixed(2)) : 0;
}

function serializeIsActive(rawValue) {
  if (rawValue === true || rawValue === 1 || rawValue === "1") {
    return 1;
  }

  return 0;
}

export function serializeReward(rewardRecord) {
  if (!rewardRecord) {
    return null;
  }

  const reward = typeof rewardRecord.get === "function"
    ? rewardRecord.get({ plain: true })
    : { ...rewardRecord };

  return {
    id: serializeId(reward.id),
    game_id: serializeId(reward.game_id),
    picture: reward.picture ?? null,
    description: reward.description ?? null,
    prize: reward.prize,
    holdings: Number(reward.holdings ?? 0),
    probability: serializeProbability(reward.probability),
    is_active: serializeIsActive(reward.is_active),
    created_at: reward.created_at ?? reward.createdAt ?? null,
    updated_at: reward.updated_at ?? reward.updatedAt ?? null,
  };
}

async function lockGamesForRewardMutation(gameIds, transaction) {
  const uniqueGameIds = [...new Set(
    gameIds
      .map((gameId) => Number(gameId))
      .filter((gameId) => Number.isInteger(gameId) && gameId > 0),
  )].sort((left, right) => left - right);

  if (uniqueGameIds.length === 0) {
    return new Map();
  }

  const games = await Game.findAll({
    attributes: ["id", "game_id"],
    where: {
      game_id: {
        [Op.in]: uniqueGameIds,
      },
    },
    order: [["game_id", "ASC"]],
    transaction,
    lock: true,
  });

  return new Map(games.map((game) => [Number(game.game_id), game]));
}

async function findRewardOrThrow(rewardId, transaction) {
  const reward = await Reward.findByPk(rewardId, {
    transaction,
    lock: true,
  });

  if (!reward) {
    throw createHttpError("Reward not found", 404);
  }

  return reward;
}

async function findSerializedRewardById(rewardId, transaction) {
  const reward = await Reward.findByPk(rewardId, { transaction });
  return serializeReward(reward);
}

export async function recalculateRewardProbabilities(gameId, connectionOrTransaction) {
  const transaction = connectionOrTransaction ?? undefined;
  const activeRewardCount = await Reward.count({
    where: {
      game_id: gameId,
      is_active: true,
    },
    transaction,
  });

  if (activeRewardCount === 0) {
    await Reward.update(
      { probability: 0 },
      {
        where: { game_id: gameId },
        transaction,
      },
    );

    return {
      activeRewardCount,
      probability: 0,
    };
  }

  const computedProbability = Number((100 / activeRewardCount).toFixed(2));

  await Reward.update(
    { probability: computedProbability },
    {
      where: {
        game_id: gameId,
        is_active: true,
      },
      transaction,
    },
  );

  await Reward.update(
    { probability: 0 },
    {
      where: {
        game_id: gameId,
        is_active: false,
      },
      transaction,
    },
  );

  return {
    activeRewardCount,
    probability: computedProbability,
  };
}

export async function createRewardRecord(payload) {
  return sequelize.transaction(async (transaction) => {
    const gamesByGameId = await lockGamesForRewardMutation([payload.game_id], transaction);
    if (!gamesByGameId.has(Number(payload.game_id))) {
      throw createHttpError("Game not found", 404);
    }

    const reward = await Reward.create(
      {
        game_id: payload.game_id,
        picture: payload.picture ?? null,
        description: payload.description ?? null,
        prize: payload.prize,
        holdings: payload.holdings ?? 0,
        probability: 0,
        is_active: payload.is_active === 1,
      },
      { transaction },
    );

    await recalculateRewardProbabilities(payload.game_id, transaction);
    return findSerializedRewardById(reward.id, transaction);
  });
}

export async function listRewardRecords(options) {
  const where = {};

  if (options.gameId !== undefined) {
    where.game_id = options.gameId;
  }

  if (options.isActive !== undefined) {
    where.is_active = options.isActive === 1;
  }

  if (options.search) {
    where[Op.or] = [
      {
        prize: {
          [Op.like]: `%${options.search}%`,
        },
      },
      {
        description: {
          [Op.like]: `%${options.search}%`,
        },
      },
    ];
  }

  const offset = (options.page - 1) * options.limit;
  const { count, rows } = await Reward.findAndCountAll({
    where,
    order: [["created_at", "DESC"], ["id", "DESC"]],
    limit: options.limit,
    offset,
  });

  return {
    rewards: rows.map((reward) => serializeReward(reward)),
    total: count,
  };
}

export async function getRewardRecordById(rewardId) {
  return findSerializedRewardById(rewardId);
}

export async function updateRewardRecord(rewardId, payload) {
  return sequelize.transaction(async (transaction) => {
    const reward = await findRewardOrThrow(rewardId, transaction);
    const oldGameId = Number(reward.game_id);
    const newGameId = payload.game_id ?? oldGameId;
    const gamesByGameId = await lockGamesForRewardMutation([oldGameId, newGameId], transaction);

    if (payload.game_id !== undefined && !gamesByGameId.has(Number(payload.game_id))) {
      throw createHttpError("Game not found", 404);
    }

    if (payload.game_id !== undefined) {
      reward.game_id = payload.game_id;
    }
    if (payload.picture !== undefined) {
      reward.picture = payload.picture;
    }
    if (payload.description !== undefined) {
      reward.description = payload.description;
    }
    if (payload.prize !== undefined) {
      reward.prize = payload.prize;
    }
    if (payload.holdings !== undefined) {
      reward.holdings = payload.holdings;
    }
    if (payload.is_active !== undefined) {
      reward.is_active = payload.is_active === 1;
      if (payload.is_active === 0) {
        reward.probability = 0;
      }
    }

    await reward.save({ transaction });

    const shouldRecalculate = payload.game_id !== undefined || payload.is_active !== undefined;
    if (shouldRecalculate) {
      const gameIdsToRecalculate = [...new Set([oldGameId, newGameId])];
      for (const gameId of gameIdsToRecalculate) {
        await recalculateRewardProbabilities(gameId, transaction);
      }
    }

    return findSerializedRewardById(reward.id, transaction);
  });
}

export async function deleteRewardRecord(rewardId) {
  return sequelize.transaction(async (transaction) => {
    const reward = await findRewardOrThrow(rewardId, transaction);
    const gameId = Number(reward.game_id);

    await lockGamesForRewardMutation([gameId], transaction);
    await reward.destroy({ transaction });
    await recalculateRewardProbabilities(gameId, transaction);
  });
}

export async function updateRewardStatusRecord(rewardId, isActive) {
  return sequelize.transaction(async (transaction) => {
    const reward = await findRewardOrThrow(rewardId, transaction);
    const gameId = Number(reward.game_id);

    await lockGamesForRewardMutation([gameId], transaction);
    reward.is_active = isActive === 1;
    if (isActive === 0) {
      reward.probability = 0;
    }

    await reward.save({ transaction });
    await recalculateRewardProbabilities(gameId, transaction);
    return findSerializedRewardById(reward.id, transaction);
  });
}
