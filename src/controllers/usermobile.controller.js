import { Usermobile } from "../models/index.js"; 

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
  const { phone, game_id } = req.body;

  if (!phone || !game_id) {
    return res.status(400).json({ message: "phone and game_id are required" });
  }

  const newUsermobile = await Usermobile.create({
    phone,
    game_id,
  });

  // FIX: Using Sequelize's get() method for a cleaner, detached object payload
  const responseData = newUsermobile.get({ plain: true });
  delete responseData.otp;
  delete responseData.otp_expires_at;

  return res.status(201).json(responseData);
}