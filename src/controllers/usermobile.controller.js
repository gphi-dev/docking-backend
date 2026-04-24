import { Usermobile } from "../models/usermobile.model.js";

function maskPhoneNumber(phone) {
  const rawPhone = String(phone ?? "").trim();

  if (!rawPhone) {
    return rawPhone;
  }

  if (/^\d{10}$/.test(rawPhone)) {
    return `${rawPhone.substring(0, 3)}-****-${rawPhone.substring(7, 10)}`;
  }

  if (rawPhone.length <= 4) {
    return rawPhone;
  }

  return `${rawPhone.slice(0, 3)}${"*".repeat(Math.max(rawPhone.length - 5, 1))}${rawPhone.slice(-2)}`;
}

function sanitizeUsermobile(usermobile) {
  const usermobileData = usermobile.get({ plain: true });
  delete usermobileData.otp;
  delete usermobileData.otp_expires_at;
  return usermobileData;
}

function parsePoints(rawValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return 0;
  }

  const points = Number.parseInt(String(rawValue), 10);
  if (!Number.isFinite(points)) {
    return null;
  }

  return points;
}

export async function listUsermobile(_req, res) {
  const users = await Usermobile.findAll({
    attributes: { exclude: ["otp", "otp_expires_at"] },
    order: [["created_at", "DESC"]],
  });

  return res.json(users);
}

export async function getUsermobileByPhone(req, res) {
  const phone = String(req.params.phone ?? "").trim();
  if (!phone) {
    return res.status(400).json({ message: "phone is required" });
  }

  const user = await Usermobile.findOne({
    where: { phone },
    attributes: { exclude: ["otp", "otp_expires_at"] },
  });

  if (!user) {
    return res.status(404).json({ message: "User mobile not found" });
  }

  return res.json(user);
}

export async function createUsermobile(req, res) {
  const phone = String(req.body?.phone ?? "").trim();
  const gameId = String(req.body?.game_id ?? "").trim();
  const points = parsePoints(req.body?.points);

  if (!phone) {
    return res.status(400).json({ message: "phone is required" });
  }

  if (!gameId) {
    return res.status(400).json({ message: "game_id is required" });
  }

  if (points === null) {
    return res.status(400).json({ message: "points must be a valid integer" });
  }

  const createdUser = await Usermobile.create({
    phone,
    game_id: gameId,
    is_verified: req.body?.is_verified ?? 0,
    verified_at: req.body?.verified_at ?? null,
    otp: req.body?.otp ?? null,
    otp_expires_at: req.body?.otp_expires_at ?? null,
    points,
  });

  return res.status(201).json(sanitizeUsermobile(createdUser));
}

export async function getUsermobileSubscribedGame(req, res) {
  const gameId = String(req.params.gameId ?? "").trim();
  if (!gameId) {
    return res.status(400).json({ message: "gameId is required" });
  }

  const users = await Usermobile.findAll({
    where: { game_id: gameId },
    attributes: { exclude: ["otp", "otp_expires_at"] },
    order: [["created_at", "DESC"]],
  });

  return res.json(users);
}

export async function getUsersMaskedScoreList(_req, res) {
  const users = await Usermobile.findAll({
    attributes: ["phone", "game_id", "points"],
    order: [["created_at", "DESC"]],
  });

  return res.json(
    users.map((user) => ({
      phone: maskPhoneNumber(user.phone),
      game_id: user.game_id,
      points: user.points ?? 0,
    })),
  );
}

export async function getUsersMaskedScoreListByGame(req, res) {
    const gameId = String(
      req.body?.game_id ??
      "",
  ).trim();

  if (!gameId) {
    return res.status(400).json({ message: "game_id is required" });
  }

  const users = await Usermobile.findAll({
    where: { game_id: gameId },
    attributes: ["phone", "game_id", "points"],
    order: [["points", "DESC"], ["created_at", "ASC"]],
    limit: 2,
  });

  return res.json(
    users.map((user) => ({
      phone: maskPhoneNumber(user.phone),
      game_id: user.game_id,
      points: user.points ?? 0,
    })),
  );
}
