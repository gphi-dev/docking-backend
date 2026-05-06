import { Op } from "sequelize";
import { Admin, Role } from "../models/index.js";
import { hashPassword } from "../utils/password.js";
import {
  isSuperAdminAdminRecord,
  isSuperAdminRoleRecord,
  isSuperAdminRoleValue,
  serializeId,
  serializeRole,
  SUPER_ADMIN_ROLE_NAME,
} from "../utils/rbac.js";

const ADMIN_USERNAME_MAX_LENGTH = 64;
const ADMIN_EMAIL_MAX_LENGTH = 100;
const ADMIN_ROLE_MAX_LENGTH = 45;
const ADMIN_STATUS_VALUES = new Set(["active", "inactive"]);
const LAST_SUPER_ADMIN_MESSAGE = "At least one active Super Admin account is required.";

const ADMIN_ROLE_INCLUDE = [
  {
    model: Role,
    as: "rbacRole",
    attributes: ["id", "name", "slug", "description", "is_active", "created_at", "updated_at"],
  },
];

function createBadRequestError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeRequiredString(rawValue, fieldName, maxLength) {
  if (typeof rawValue !== "string") {
    throw createBadRequestError(`${fieldName} is required.`);
  }

  const normalizedValue = rawValue.trim();
  if (!normalizedValue) {
    throw createBadRequestError(`${fieldName} is required.`);
  }

  if (normalizedValue.length > maxLength) {
    throw createBadRequestError(`${fieldName} must be ${maxLength} characters or less.`);
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
    throw createBadRequestError(`${fieldName} must be ${maxLength} characters or less.`);
  }

  return normalizedValue || null;
}

function normalizeOptionalStatus(rawValue) {
  if (rawValue === undefined) {
    return undefined;
  }

  const normalizedStatus = String(rawValue).trim().toLowerCase();
  if (!ADMIN_STATUS_VALUES.has(normalizedStatus)) {
    throw createBadRequestError("Status must be either active or inactive.");
  }

  return normalizedStatus;
}

function parsePositiveInteger(rawValue, fieldName) {
  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw createBadRequestError(`Invalid ${fieldName}.`);
  }

  return parsedValue;
}

function parseAdminId(rawValue) {
  return parsePositiveInteger(rawValue, "admin id");
}

function slugifyRoleName(rawValue) {
  return String(rawValue)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function findRoleByNameOrSlug(rawRoleValue) {
  const normalizedRoleValue = String(rawRoleValue ?? "").trim();
  if (!normalizedRoleValue) {
    return null;
  }

  const slug = slugifyRoleName(normalizedRoleValue);
  return Role.findOne({
    where: {
      [Op.or]: [
        { name: normalizedRoleValue },
        { slug: normalizedRoleValue },
        { slug },
      ],
    },
  });
}

async function findDefaultAdminRole() {
  const adminRoleBySlug = await Role.findOne({ where: { slug: "admin", is_active: true } });
  if (adminRoleBySlug) {
    return adminRoleBySlug;
  }

  const adminRoleByName = await Role.findOne({ where: { name: "Admin", is_active: true } });
  if (adminRoleByName) {
    return adminRoleByName;
  }

  return Role.findOne({ where: { is_active: true }, order: [["id", "ASC"]] });
}

async function resolveRoleForPayload(body, options = {}) {
  const { required = false } = options;
  const hasRoleId = Object.prototype.hasOwnProperty.call(body ?? {}, "role_id");
  const hasLegacyRole = Object.prototype.hasOwnProperty.call(body ?? {}, "role");

  if (hasRoleId && body.role_id !== undefined && body.role_id !== null && String(body.role_id).trim() !== "") {
    const roleId = parsePositiveInteger(body.role_id, "role id");
    const roleRecord = await Role.findByPk(roleId);
    if (!roleRecord) {
      throw createBadRequestError("Role not found.");
    }
    if (!roleRecord.is_active) {
      throw createBadRequestError("Role is inactive.");
    }
    return roleRecord;
  }

  if (hasLegacyRole && body.role !== undefined && body.role !== null && String(body.role).trim() !== "") {
    const roleRecord = await findRoleByNameOrSlug(body.role);
    if (!roleRecord) {
      throw createBadRequestError("Role not found.");
    }
    if (!roleRecord.is_active) {
      throw createBadRequestError("Role is inactive.");
    }
    return roleRecord;
  }

  if (!required) {
    return undefined;
  }

  const defaultRole = await findDefaultAdminRole();
  if (!defaultRole) {
    throw createBadRequestError("A role_id is required.");
  }

  return defaultRole;
}

async function findAdminByIdWithRole(id) {
  return Admin.findByPk(id, { include: ADMIN_ROLE_INCLUDE });
}

async function countActiveSuperAdmins() {
  const admins = await Admin.findAll({
    attributes: ["id", "role", "role_id", "status"],
    include: ADMIN_ROLE_INCLUDE,
  });

  return admins.filter((adminRecord) => (
    adminRecord.status === "active" && isSuperAdminAdminRecord(adminRecord)
  )).length;
}

async function isLastActiveSuperAdminAccount() {
  const superAdminCount = await countActiveSuperAdmins();
  return superAdminCount <= 1;
}

function serializeAdmin(adminRecord) {
  const roleRecord = adminRecord.rbacRole ?? null;
  const displayRole = roleRecord?.name ?? adminRecord.role ?? null;

  return {
    id: adminRecord.id,
    username: adminRecord.username,
    email: adminRecord.email ?? null,
    role: displayRole,
    role_id: serializeId(adminRecord.role_id),
    status: adminRecord.status ?? "active",
    rbac_role: serializeRole(roleRecord),
    created_at: adminRecord.created_at ?? adminRecord.createdAt ?? null,
    updated_at: adminRecord.updated_at ?? adminRecord.updatedAt ?? null,
  };
}

function willRemainActiveSuperAdmin(adminRecord, nextRoleRecord, nextStatus) {
  const roleAfterUpdate = nextRoleRecord ?? adminRecord.rbacRole ?? null;
  const statusAfterUpdate = nextStatus ?? adminRecord.status ?? "active";

  if (roleAfterUpdate) {
    return statusAfterUpdate === "active" && isSuperAdminRoleRecord(roleAfterUpdate);
  }

  if (adminRecord.role_id !== undefined) {
    return false;
  }

  return statusAfterUpdate === "active" && isSuperAdminRoleValue(adminRecord.role);
}

export async function listAdmins(_req, res) {
  const admins = await Admin.findAll({
    attributes: ["id", "username", "email", "role", "role_id", "status", "created_at", "updated_at"],
    include: ADMIN_ROLE_INCLUDE,
    order: [["created_at", "ASC"]],
  });
  return res.json(admins.map((adminRecord) => serializeAdmin(adminRecord)));
}

/**
 * @controller createAdminuser
 * @description Creates a new admin user
 * @route POST /api/admins
 * @access Private
 */
export async function createAdminuser(req, res) {
  const username = normalizeRequiredString(req.body?.username, "Username", ADMIN_USERNAME_MAX_LENGTH);
  const password = req.body?.password;
  const email = normalizeOptionalString(req.body?.email, "Email", ADMIN_EMAIL_MAX_LENGTH);
  const legacyRole = normalizeOptionalString(req.body?.role, "Role", ADMIN_ROLE_MAX_LENGTH);
  const status = normalizeOptionalStatus(req.body?.status) ?? "active";
  const roleRecord = await resolveRoleForPayload(req.body, { required: true });

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
    role: legacyRole ?? roleRecord.name ?? SUPER_ADMIN_ROLE_NAME,
    role_id: roleRecord.id,
    status,
    password_hash,
  });

  const createdAdmin = await findAdminByIdWithRole(newAdmin.id);
  return res.status(201).json(serializeAdmin(createdAdmin));
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
  const nextLegacyRole = normalizeOptionalString(req.body?.role, "Role", ADMIN_ROLE_MAX_LENGTH);
  const nextStatus = normalizeOptionalStatus(req.body?.status);
  const nextRoleRecord = await resolveRoleForPayload(req.body, { required: false });
  const password = req.body?.password;

  const adminRecord = await findAdminByIdWithRole(id);
  if (!adminRecord) {
    return res.status(404).json({ message: "Admin user not found." });
  }

  if (
    adminRecord.status === "active" &&
    isSuperAdminAdminRecord(adminRecord) &&
    !willRemainActiveSuperAdmin(adminRecord, nextRoleRecord, nextStatus)
  ) {
    if (await isLastActiveSuperAdminAccount()) {
      return res.status(409).json({ message: LAST_SUPER_ADMIN_MESSAGE });
    }
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
  if (nextRoleRecord !== undefined) {
    adminRecord.role_id = nextRoleRecord.id;
    adminRecord.role = nextLegacyRole ?? nextRoleRecord.name;
  } else if (nextLegacyRole !== undefined) {
    adminRecord.role = nextLegacyRole;
  }
  if (nextStatus !== undefined) {
    adminRecord.status = nextStatus;
  }

  if (password !== undefined) {
    if (typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ message: "Password must be a non-empty string when provided." });
    }
    adminRecord.password_hash = await hashPassword(password);
  }

  await adminRecord.save();

  const updatedAdmin = await findAdminByIdWithRole(id);
  return res.status(200).json(serializeAdmin(updatedAdmin));
}

/**
 * @controller deleteAdminuser
 * @description Deletes an existing admin user
 * @route DELETE /api/admins/:id
 * @access Private
 */
export async function deleteAdminuser(req, res) {
  const id = parseAdminId(req.params.id);

  const adminRecord = await findAdminByIdWithRole(id);
  if (!adminRecord) {
    return res.status(404).json({ message: "Admin user not found." });
  }

  if (adminRecord.status === "active" && isSuperAdminAdminRecord(adminRecord)) {
    if (await isLastActiveSuperAdminAccount()) {
      return res.status(409).json({ message: LAST_SUPER_ADMIN_MESSAGE });
    }
  }

  await adminRecord.destroy();
  return res.status(204).send();
}
