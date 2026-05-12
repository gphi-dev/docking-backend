import { Op, QueryTypes } from "sequelize";
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

function serializeDrawnReward(rewardRecord) {
  const reward = serializeReward(rewardRecord);

  return {
    id: reward.id,
    game_id: reward.game_id,
    picture: reward.picture,
    description: reward.description,
    prize: reward.prize,
    remaining_holdings: reward.holdings,
    probability: reward.probability,
    is_active: reward.is_active,
    created_at: reward.created_at,
    updated_at: reward.updated_at,
  };
}

function getAffectedRows(queryResult, queryMetadata) {
  return Number(
    queryMetadata?.affectedRows
      ?? queryResult?.affectedRows
      ?? queryMetadata
      ?? 0,
  );
}

export async function drawRewardRecord(gameId, gameSecretKey) {
  return sequelize.transaction(async (transaction) => {
    const [game] = await sequelize.query(
      `
        SELECT game_id, gamesecretkey
        FROM games
        WHERE game_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      {
        replacements: [gameId],
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (!game || String(game.gamesecretkey ?? "").trim() !== String(gameSecretKey).trim()) {
      throw createHttpError("Invalid game credentials", 401);
    }

    const activeRewards = await sequelize.query(
      `
        SELECT *
        FROM rewards
        WHERE game_id = ?
        AND is_active = 1
        AND holdings > 0
        ORDER BY id ASC
        FOR UPDATE
      `,
      {
        replacements: [gameId],
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (activeRewards.length === 0) {
      throw createHttpError("No active rewards available for this game", 409);
    }

    const drawCount = activeRewards.length;
    const drawnMap = new Map();

    for (let drawIndex = 0; drawIndex < drawCount; drawIndex += 1) {
      const availableRewards = activeRewards.filter((reward) => Number(reward.holdings ?? 0) > 0);
      const totalProbability = availableRewards.reduce(
        (sum, reward) => sum + Number(reward.probability ?? 0),
        0,
      );

      if (totalProbability <= 0) {
        throw createHttpError("Total reward probability must be greater than 0", 409);
      }

      // Weighted random selection: each reward owns a slice of the total
      // probability range, so higher-probability rewards are selected more often.
      const random = Math.random() * totalProbability;
      let cumulative = 0;
      let selectedReward = null;
      let lastRewardWithProbability = null;

      for (const reward of availableRewards) {
        const rewardProbability = Number(reward.probability ?? 0);
        if (rewardProbability <= 0) {
          continue;
        }

        lastRewardWithProbability = reward;
        cumulative += rewardProbability;
        if (random <= cumulative) {
          selectedReward = reward;
          break;
        }
      }

      if (!selectedReward) {
        selectedReward = lastRewardWithProbability;
      }

      if (!selectedReward) {
        throw createHttpError("Total reward probability must be greater than 0", 409);
      }

      selectedReward.holdings = Number(selectedReward.holdings ?? 0) - 1;
      drawnMap.set(String(selectedReward.id), (drawnMap.get(String(selectedReward.id)) ?? 0) + 1);
    }

    for (const [rewardId, drawnQuantity] of drawnMap.entries()) {
      const [queryResult, queryMetadata] = await sequelize.query(
        `
          UPDATE rewards
          SET
            holdings = holdings - ?,
            is_active = CASE
              WHEN holdings - ? <= 0 THEN 0
              ELSE is_active
            END,
            updated_at = NOW()
          WHERE id = ?
          AND game_id = ?
          AND holdings >= ?
        `,
        {
          replacements: [drawnQuantity, drawnQuantity, rewardId, gameId, drawnQuantity],
          transaction,
        },
      );

      if (getAffectedRows(queryResult, queryMetadata) !== 1) {
        throw createHttpError("Failed to update reward holdings", 409);
      }
    }

    const selectedRewardIds = [...drawnMap.keys()];
    const updatedRewards = await sequelize.query(
      `
        SELECT *
        FROM rewards
        WHERE id IN (:selectedRewardIds)
        AND game_id = :gameId
        ORDER BY id ASC
      `,
      {
        replacements: {
          selectedRewardIds,
          gameId,
        },
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    return {
      rewards: updatedRewards.flatMap((reward) => {
        const drawnQuantity = drawnMap.get(String(reward.id)) ?? 0;
        return Array.from({ length: drawnQuantity }, () => serializeDrawnReward(reward));
      }),
      drawCount,
    };
  });
}

export async function updateRewardProbabilitiesForGame(gameId, probabilityUpdates) {
  return sequelize.transaction(async (transaction) => {
    const gamesByGameId = await lockGamesForRewardMutation([gameId], transaction);
    if (!gamesByGameId.has(Number(gameId))) {
      throw createHttpError("Game not found", 404);
    }

    const totalProbabilityCents = probabilityUpdates.reduce(
      (total, probabilityUpdate) => total + Math.round(Number(probabilityUpdate.probability) * 100),
      0,
    );
    if (totalProbabilityCents !== 10000) {
      throw createHttpError("Total probability must equal exactly 100.00");
    }

    const activeRewards = await Reward.findAll({
      where: {
        game_id: gameId,
        is_active: true,
      },
      order: [["id", "ASC"]],
      transaction,
      lock: true,
    });

    if (activeRewards.length === 0) {
      throw createHttpError("No active rewards for this game", 409);
    }

    const probabilityUpdatesByRewardId = new Map(
      probabilityUpdates.map((probabilityUpdate) => [
        String(probabilityUpdate.id),
        probabilityUpdate.probability,
      ]),
    );
    const activeRewardIds = new Set(activeRewards.map((reward) => String(reward.id)));
    const invalidRewardIds = [...probabilityUpdatesByRewardId.keys()].filter(
      (rewardId) => !activeRewardIds.has(rewardId),
    );
    if (invalidRewardIds.length > 0) {
      throw createHttpError("All probability updates must belong to active rewards for this game");
    }

    if (probabilityUpdatesByRewardId.size !== activeRewards.length) {
      throw createHttpError("All active rewards for this game must be included");
    }

    for (const reward of activeRewards) {
      reward.probability = probabilityUpdatesByRewardId.get(String(reward.id));
      await reward.save({ transaction });
    }

    return activeRewards.map((reward) => serializeReward(reward));
  });
}

export async function updateRewardRecord(rewardId, payload) {
  return sequelize.transaction(async (transaction) => {
    const reward = await findRewardOrThrow(rewardId, transaction);
    const oldGameId = Number(reward.game_id);
    const newGameId = payload.game_id !== undefined ? Number(payload.game_id) : oldGameId;
    const currentIsActive = serializeIsActive(reward.is_active) === 1;
    const nextIsActive = payload.is_active !== undefined ? payload.is_active === 1 : currentIsActive;
    const hasProbabilityUpdate = payload.probability !== undefined;
    const gameIdChanged = payload.game_id !== undefined && newGameId !== oldGameId;
    const isActiveChanged = payload.is_active !== undefined && nextIsActive !== currentIsActive;
    const gamesByGameId = await lockGamesForRewardMutation([oldGameId, newGameId], transaction);

    if (payload.game_id !== undefined && !gamesByGameId.has(Number(payload.game_id))) {
      throw createHttpError("Game not found", 404);
    }

    if (hasProbabilityUpdate) {
      if (gameIdChanged) {
        throw createHttpError("probability cannot be updated while changing game_id");
      }
      if (!currentIsActive || !nextIsActive) {
        throw createHttpError("probability can only be updated for active rewards");
      }
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
      reward.is_active = nextIsActive;
      if (!nextIsActive) {
        reward.probability = 0;
      }
    }
    if (hasProbabilityUpdate) {
      reward.probability = payload.probability;
    }

    await reward.save({ transaction });

    const shouldRecalculate = !hasProbabilityUpdate && (gameIdChanged || isActiveChanged);
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
