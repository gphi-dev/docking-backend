import { Usermobile } from "../models/usermobile.model.js";

function maskPhone(phone) {
  const rawPhone = String(phone ?? "");
  if (rawPhone.length <= 4) {
    return rawPhone;
  }
  return `${rawPhone.slice(0, 3)}${"*".repeat(Math.max(rawPhone.length - 5, 1))}${rawPhone.slice(-2)}`;
}

export async function listUsermobile(_req, res) {
  const users = await Usermobile.findAll({ order: [["created_at", "DESC"]] });
  return res.json(users);
}

export async function getUsermobileByPhone(req, res) {
  const phone = String(req.params.phone ?? "").trim();
  if (!phone) {
    return res.status(400).json({ message: "phone is required" });
  }

  const user = await Usermobile.findOne({ where: { phone } });
  if (!user) {
    return res.status(404).json({ message: "User mobile not found" });
  }

  return res.json(user);
}

export async function createUsermobile(req, res) {
  const phone = String(req.body?.phone ?? "").trim();
  const gameId = String(req.body?.game_id ?? "").trim();

  if (!phone) {
    return res.status(400).json({ message: "phone is required" });
  }
  if (!gameId) {
    return res.status(400).json({ message: "game_id is required" });
  }

  const createdUser = await Usermobile.create({
    phone,
    game_id: gameId,
    is_verified: req.body?.is_verified ?? 0,
    verified_at: req.body?.verified_at ?? null,
    otp: req.body?.otp ?? null,
    otp_expires_at: req.body?.otp_expires_at ?? null,
  });

  return res.status(201).json(createdUser);
}

export async function getUsermobileSubscribedGame(req, res) {
  const gameId = String(req.params.gameId ?? "").trim();
  if (!gameId) {
    return res.status(400).json({ message: "gameId is required" });
  }

  const users = await Usermobile.findAll({
    where: { game_id: gameId },
    order: [["created_at", "DESC"]],
  });

  return res.json(users);
}

export async function getUsersMaskedScoreList(_req, res) {
  const users = await Usermobile.findAll({
    attributes: ["id", "phone", "game_id", "created_at"],
    order: [["created_at", "DESC"]],
  });

  return res.json(
    users.map((user) => ({
      id: user.id,
      phone: maskPhone(user.phone),
      game_id: user.game_id,
      created_at: user.created_at,
    })),
  );
}

export async function getUsersMaskedScoreListByGame(req, res) {
  const gameId = String(req.body?.game_id ?? req.body?.gameId ?? "").trim();
  if (!gameId) {
    return res.status(400).json({ message: "game_id is required" });
  }

  const users = await Usermobile.findAll({
    where: { game_id: gameId },
    attributes: ["id", "phone", "game_id", "created_at"],
    order: [["created_at", "DESC"]],
  });

  return res.json(
    users.map((user) => ({
      id: user.id,
      phone: maskPhone(user.phone),
      game_id: user.game_id,
      created_at: user.created_at,
    })),
  );
}
