import { Admin } from "../models/index.js";
import { hashPassword } from "../utils/password.js";

const ADMIN_USERNAME_MAX_LENGTH = 64;
const ADMIN_EMAIL_MAX_LENGTH = 100;
const ADMIN_ROLE_MAX_LENGTH = 45;

function normalizeRequiredString(rawValue, fieldName, maxLength) {
  if (typeof rawValue !== "string") {
    const error = new Error(`${fieldName} is required.`);
    error.status = 400;
    throw error;
  }

  const normalizedValue = rawValue.trim();
  if (!normalizedValue) {
    const error = new Error(`${fieldName} is required.`);
    error.status = 400;
    throw error;
  }

  if (normalizedValue.length > maxLength) {
    const error = new Error(`${fieldName} must be ${maxLength} characters or less.`);
    error.status = 400;
    throw error;
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

  const normalizedValue = String(rawValue).trim();
  if (normalizedValue.length > maxLength) {
    const error = new Error(`${fieldName} must be ${maxLength} characters or less.`);
    error.status = 400;
    throw error;
  }

  return normalizedValue || null;
}

function parseAdminId(rawValue) {
  const adminId = Number(rawValue);
  if (!Number.isInteger(adminId) || adminId < 1) {
    const error = new Error("Invalid admin id.");
    error.status = 400;
    throw error;
  }

  return adminId;
}

function serializeAdmin(adminRecord) {
  return {
    id: adminRecord.id,
    username: adminRecord.username,
    email: adminRecord.email ?? null,
    role: adminRecord.role ?? null,
    created_at: adminRecord.created_at ?? adminRecord.createdAt ?? null,
  };
}

export async function listAdmins(_req, res) {
  const admins = await Admin.findAll({
    attributes: ["id", "username", "email", "role", "created_at"],
    order: [["created_at", "ASC"]],
  });
  return res.json(admins);
}

/**
 * @controller createAdminuser
 * @description Creates a new admin user
 * @route POST /api/admins
 * @access Private (Should be protected by auth middleware in production)
 */
export async function createAdminuser(req, res) {
  const username = normalizeRequiredString(req.body?.username, "Username", ADMIN_USERNAME_MAX_LENGTH);
  const password = req.body?.password;
  const email = normalizeOptionalString(req.body?.email, "Email", ADMIN_EMAIL_MAX_LENGTH);
  const role = normalizeOptionalString(req.body?.role, "Role", ADMIN_ROLE_MAX_LENGTH);

  if (typeof password !== "string" || !password.trim()) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  const existingAdmin = await Admin.findOne({ where: { username } });
  if (existingAdmin) {
    return res.status(409).json({ message: "Username is already taken." });
  }

  const password_hash = await hashPassword(password);

  const newAdmin = await Admin.create({
    username,
    email,
    role,
    password_hash,
  });

  return res.status(201).json(serializeAdmin(newAdmin));
}

/**
 * @controller updateAdminuser
 * @description Updates an existing admin user
 * @route PUT /api/admins/:id
 * @access Private
 */
export async function updateAdminuser(req, res) {
  const id = parseAdminId(req.params.id);
  const nextUsername = req.body?.username !== undefined
    ? normalizeRequiredString(req.body.username, "Username", ADMIN_USERNAME_MAX_LENGTH)
    : undefined;
  const nextEmail = normalizeOptionalString(req.body?.email, "Email", ADMIN_EMAIL_MAX_LENGTH);
  const nextRole = normalizeOptionalString(req.body?.role, "Role", ADMIN_ROLE_MAX_LENGTH);
  const password = req.body?.password;

  const adminRecord = await Admin.findByPk(id);
  if (!adminRecord) {
    return res.status(404).json({ message: "Admin user not found." });
  }

  if (nextUsername !== undefined && nextUsername !== adminRecord.username) {
    const existingAdmin = await Admin.findOne({ where: { username: nextUsername } });
    if (existingAdmin) {
      return res.status(409).json({ message: "Username is already taken." });
    }
    adminRecord.username = nextUsername;
  }

  if (nextEmail !== undefined) {
    adminRecord.email = nextEmail;
  }
  if (nextRole !== undefined) {
    adminRecord.role = nextRole;
  }

  if (password !== undefined) {
    if (typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ message: "Password must be a non-empty string when provided." });
    }
    adminRecord.password_hash = await hashPassword(password);
  }

  await adminRecord.save();

  return res.status(200).json(serializeAdmin(adminRecord));
}

/**
 * @controller deleteAdminuser
 * @description Deletes an existing admin user
 * @route DELETE /api/admins/:id
 * @access Private
 */
export async function deleteAdminuser(req, res) {
  const id = parseAdminId(req.params.id);

  const adminRecord = await Admin.findByPk(id);
  if (!adminRecord) {
    return res.status(404).json({ message: "Admin user not found." });
  }

  await adminRecord.destroy();
  return res.status(204).send();
}
