import { Usermobile } from "../models/index.js"; 

export async function listUsermobile(_req, res) {
  const usermobiles = await Usermobile.findAll({ 
    order: [["created_at", "DESC"]],
    attributes: { exclude: ["otp", "otp_expires_at"] }
  });
  
  return res.json(usermobiles);
}

export async function getGameByPhone(req, res) {
  const phoneParam = req.params.phone;

  // Check if the phone parameter was provided at all
  if (!phoneParam) {
    return res.status(400).json({ message: "Invalid phone number" });
  }

  // Use findOne since 'phone' is a standard column, not the Primary Key (id)
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

  const responseData = newUsermobile.toJSON();
  delete responseData.otp;
  delete responseData.otp_expires_at;

  return res.status(201).json(responseData);
}