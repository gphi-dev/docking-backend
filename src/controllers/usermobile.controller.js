import { Usermobile, Game } from "../models/index.js";

const DEFAULT_USERMOBILE_PAGE_SIZE = 20;
const MAX_USERMOBILE_PAGE_SIZE = 100;

/**
 * @utility maskPhoneNumber
 * @description Masks a 10-digit phone number to format: XXX-****-XXX
 * Replaces digits 4-7 with asterisks
 * @param {string} phone - 10-digit phone number (e.g., '9271234345')
 * @returns {string} Masked phone number (e.g., '927-****-345')
 */
function maskPhoneNumber(phone) {
  if (!phone || phone.length !== 10 || !/^\d+$/.test(phone)) {
    return phone;
  }
  return `${phone.substring(0, 3)}-****-${phone.substring(7, 10)}`;
}

function parsePositiveInteger(rawValue, fallbackValue) {
  const parsedValue = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallbackValue;
  }
  return parsedValue;
}

export async function listUsermobile(req, res) {
  const requestedPage = parsePositiveInteger(req.query.page, 1);
  const requestedPageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_USERMOBILE_PAGE_SIZE);
  const pageSize = Math.min(requestedPageSize, MAX_USERMOBILE_PAGE_SIZE);
  const gameId = String(req.query.gameId ?? "").trim();
  const where = gameId ? { game_id: gameId } : undefined;

  const totalCount = await Usermobile.count({ where });
  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  const usermobiles = await Usermobile.findAll({
    where,
    include: [
      {
        model: Game,
        as: "game",
        attributes: ["name"],
        required: true, // INNER JOIN to match the SQL
      },
    ],
    order: [["created_at", "DESC"]],
    attributes: { exclude: ["otp", "otp_expires_at"] },
    limit: pageSize,
    offset,
  });

  return res.json({
    items: usermobiles,
    total: totalCount,
    page,
    pageSize,
    totalPages,
  });
}

export async function getUsermobileSubscribedGame(req, res) {
  const gameIdParam = req.params.gameId;

  if (!gameIdParam) {
    return res.status(400).json({ message: "Invalid game id" });
  }

  const usermobiles = await Usermobile.findAll({
    where: { game_id: String(gameIdParam) },
    order: [["created_at", "DESC"]],
    attributes: { exclude: ["otp", "otp_expires_at"] },
  });

  return res.json(usermobiles);
}

// FIX: Renamed from 'getGameByPhone' to accurately reflect the data being returned.
export async function getUsermobileByPhone(req, res) {
  const phoneParam = req.params.phone;

  if (!phoneParam) {
    return res.status(400).json({ message: "Invalid phone number" });
  }

  const usermobile = await Usermobile.findOne({
    where: { phone: phoneParam },
    attributes: { exclude: ["otp", "otp_expires_at"] }
  });

  if (!usermobile) {
    return res.status(404).json({ message: "Usermobile not found" });
  }
  
  return res.json(usermobile);
}

export async function createUsermobile(req, res) {
  const { phone, game_id, points } = req.body;

  if (!phone || !game_id) {
    return res.status(400).json({ message: "phone and game_id are required" });
  }

  const newUsermobile = await Usermobile.create({
    phone,
    game_id,
    points,
  });

  // FIX: Using Sequelize's get() method for a cleaner, detached object payload
  const responseData = newUsermobile.get({ plain: true });
  delete responseData.otp;
  delete responseData.otp_expires_at;

  return res.status(201).json(responseData);
}

/**
 * @controller getUsersMaskedList
 * @description Retrieves all users from usersmobile table with masked phone numbers
 * @route GET /api/usermobile/masked
 * @access Public
 * @returns {Array} Array of objects with phone (masked), game_id, and points
 */
export async function getUsersMaskedScoreList(req, res) {
  try {
    const users = await Usermobile.findAll({
      attributes: ['phone', 'game_id', 'points'],
      order: [['created_at', 'DESC']],
    });

    if (!users || users.length === 0) {
      return res.status(200).json([]);
    }

    const maskedUsers = users.map(user => {
      const userData = user.get({ plain: true });
      return {
        phone: maskPhoneNumber(userData.phone),
        game_id: userData.game_id,
        points: userData.points ?? 0,
      };
    });

    return res.status(200).json(maskedUsers);
  } catch (error) {
    console.error('Error retrieving users:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}


export async function getUsersMaskedScoreListByGame(req, res) {
  const game_id = req.body?.game_id ?? req.query?.game_id;

  if (game_id === undefined || game_id === null) {
    return res.status(400).json({ message: "game_id is required" });
  }

  const normalizedGameId = String(game_id).trim();
  if (!normalizedGameId) {
    return res.status(400).json({ message: "game_id is required" });
  }

  try {
    const users = await Usermobile.findAll({
      where: { game_id: normalizedGameId },
      attributes: ['phone', 'game_id', 'points'],
      order: [['points', 'DESC'], ['created_at', 'ASC']],
      limit: 2, // Limit to the top 2 results
    });

    const maskedUsers = users.map(user => {
      const userData = user.get({ plain: true });
      return {
        phone: maskPhoneNumber(userData.phone),
        game_id: userData.game_id,
        points: userData.points ?? 0,
      };
    });

    return res.status(200).json(maskedUsers);
  } catch (error) {
    console.error('Error retrieving masked users by game:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
