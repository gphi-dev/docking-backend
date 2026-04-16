import { Usermobile } from "../models/index.js";

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

export async function listUsermobile(_req, res) {
  const usermobiles = await Usermobile.findAll({ 
    order: [["created_at", "DESC"]],
    attributes: { exclude: ["otp", "otp_expires_at"] }
  });
  
  return res.json(usermobiles);
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
        points: userData.points,
      };
    });

    return res.status(200).json(maskedUsers);
  } catch (error) {
    console.error('Error retrieving users:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}


export async function getUsersMaskedScoreListByGame(req, res) {
  const { game_id } = req.body;

  if (game_id === undefined || game_id === null) {
    return res.status(400).json({ message: "game_id is required" });
  }

  // Safety check: Ensure game_id is a numeric value and not a non-numeric string.
  if (!/^\d+$/.test(String(game_id))) {
    return res.status(400).json({ message: "game_id must be a numeric value." });
  }

  try {
    const users = await Usermobile.findAll({
      where: { game_id: String(game_id) },
      attributes: ['phone', 'game_id', 'points'],
      order: [['created_at', 'DESC']],
      limit: 2, // Limit to the top 2 results
    });

    const maskedUsers = users.map(user => {
      const userData = user.get({ plain: true });
      return {
        phone: maskPhoneNumber(userData.phone),
        game_id: userData.game_id,
        points: userData.points,
      };
    });

    return res.status(200).json(maskedUsers);
  } catch (error) {
    console.error('Error retrieving masked users by game:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}