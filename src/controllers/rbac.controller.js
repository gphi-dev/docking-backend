import { Op } from "sequelize";
import { Admin, Permission, Role, RolePermission } from "../models/index.js";
import {
  isSuperAdminRoleRecord,
  normalizePermissionKeys,
  serializeId,
  serializePermission,
  serializeRole,
} from "../utils/rbac.js";

const ROLE_NAME_MAX_LENGTH = 100;
const ROLE_SLUG_MAX_LENGTH = 100;
const PERMISSION_ACCESS_GROUP_MAX_LENGTH = 100;
const PERMISSION_ACTION_NAME_MAX_LENGTH = 150;
const PERMISSION_ACTION_KEY_MAX_LENGTH = 150;
const PERMISSION_ENDPOINT_MAX_LENGTH = 255;
const PERMISSION_METHOD_MAX_LENGTH = 20;
const ADMIN_ROLE_SLUG = "admin";
const RBAC_MANAGE_PERMISSION_KEY = "rbac.manage";

const ROLE_PERMISSION_INCLUDE = [
  {
    model: RolePermission,
    as: "rolePermissions",
    attributes: ["id", "role_id", "permission_id", "is_allowed", "created_at", "updated_at"],
    include: [
      {
        model: Permission,
        as: "permission",
        attributes: [
          "id",
          "access_group",
          "action_name",
          "action_key",
          "endpoint",
          "method",
          "description",
          "created_at",
          "updated_at",
        ],
      },
    ],
  },
];

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeRequiredString(rawValue, fieldName, maxLength) {
  if (typeof rawValue !== "string") {
    throw createHttpError(`${fieldName} is required.`);
  }

  const normalizedValue = rawValue.trim();
  if (!normalizedValue) {
    throw createHttpError(`${fieldName} is required.`);
  }

  if (normalizedValue.length > maxLength) {
    throw createHttpError(`${fieldName} must be ${maxLength} characters or less.`);
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
    throw createHttpError(`${fieldName} must be ${maxLength} characters or less.`);
  }

  return normalizedValue || null;
}

function normalizeBoolean(rawValue, fieldName, options = {}) {
  const { required = false } = options;
  if (rawValue === undefined) {
    if (required) {
      throw createHttpError(`${fieldName} is required.`);
    }
    return undefined;
  }

  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (rawValue === 1 || rawValue === "1") {
    return true;
  }

  if (rawValue === 0 || rawValue === "0") {
    return false;
  }

  const normalizedValue = String(rawValue).trim().toLowerCase();
  if (["true", "yes", "active", "allowed"].includes(normalizedValue)) {
    return true;
  }
  if (["false", "no", "inactive", "denied"].includes(normalizedValue)) {
    return false;
  }

  throw createHttpError(`${fieldName} must be a boolean value.`);
}

function parsePositiveInteger(rawValue, fieldName) {
  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw createHttpError(`Invalid ${fieldName}.`);
  }

  return parsedValue;
}

function slugify(rawValue) {
  return String(rawValue)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRoleSlug(rawValue, fallbackName) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    const generatedSlug = slugify(fallbackName);
    if (!generatedSlug) {
      throw createHttpError("Role slug is required.");
    }
    return generatedSlug;
  }

  return normalizeRequiredString(String(rawValue), "Role slug", ROLE_SLUG_MAX_LENGTH);
}

function normalizePermissionMethod(rawValue) {
  const normalizedMethod = normalizeOptionalString(rawValue, "Permission method", PERMISSION_METHOD_MAX_LENGTH);
  return normalizedMethod ? normalizedMethod.toUpperCase() : normalizedMethod;
}

function serializeRolePermission(rolePermissionRecord) {
  return {
    id: serializeId(rolePermissionRecord.id),
    role_id: serializeId(rolePermissionRecord.role_id),
    permission_id: serializeId(rolePermissionRecord.permission_id),
    is_allowed: Boolean(rolePermissionRecord.is_allowed),
    created_at: rolePermissionRecord.created_at ?? rolePermissionRecord.createdAt ?? null,
    updated_at: rolePermissionRecord.updated_at ?? rolePermissionRecord.updatedAt ?? null,
    permission: serializePermission(rolePermissionRecord.permission),
  };
}

function isDefaultAdminRoleRecord(roleRecord) {
  const roleSlug = String(roleRecord?.slug || "").trim().toLowerCase();
  const roleName = String(roleRecord?.name || "").trim().toLowerCase();
  return roleSlug === ADMIN_ROLE_SLUG || roleName === ADMIN_ROLE_SLUG;
}

function assertAdminCannotManageRbac(roleRecord, allowedPermissionKeys) {
  if (!isDefaultAdminRoleRecord(roleRecord)) {
    return;
  }

  if (allowedPermissionKeys.includes(RBAC_MANAGE_PERMISSION_KEY)) {
    throw createHttpError("Admin role cannot be allowed to manage RBAC.", 409);
  }
}

function serializeRbacRole(roleRecord, allPermissions = []) {
  const rolePermissionRows = (roleRecord.rolePermissions ?? [])
    .map((rolePermissionRecord) => serializeRolePermission(rolePermissionRecord))
    .filter((rolePermission) => rolePermission.permission);
  const allowedPermissionKeys = isSuperAdminRoleRecord(roleRecord)
    ? allPermissions.map((permissionRecord) => permissionRecord.action_key)
    : rolePermissionRows
      .filter((rolePermission) => rolePermission.is_allowed)
      .map((rolePermission) => rolePermission.permission.action_key);

  return {
    ...serializeRole(roleRecord),
    role_permissions: rolePermissionRows,
    allowed_permission_keys: allowedPermissionKeys,
  };
}

function buildPolicy(roles, allPermissions) {
  return roles.reduce((policy, roleRecord) => {
    policy[String(roleRecord.id)] = serializeRbacRole(roleRecord, allPermissions).allowed_permission_keys;
    return policy;
  }, {});
}

async function getRolesWithPermissions(where = {}) {
  return Role.findAll({
    where,
    include: ROLE_PERMISSION_INCLUDE,
    order: [
      ["id", "ASC"],
      [{ model: RolePermission, as: "rolePermissions" }, { model: Permission, as: "permission" }, "access_group", "ASC"],
      [{ model: RolePermission, as: "rolePermissions" }, { model: Permission, as: "permission" }, "action_name", "ASC"],
    ],
  });
}

async function getPermissions() {
  return Permission.findAll({
    order: [["access_group", "ASC"], ["action_name", "ASC"]],
  });
}

async function assertUniqueRoleFields({ id, name, slug }) {
  const duplicateRole = await Role.findOne({
    where: {
      [Op.or]: [{ name }, { slug }],
      ...(id ? { id: { [Op.ne]: id } } : {}),
    },
  });

  if (duplicateRole) {
    throw createHttpError("Role name or slug is already taken.", 409);
  }
}

async function assertUniquePermissionActionKey(actionKey, id = null) {
  const duplicatePermission = await Permission.findOne({
    where: {
      action_key: actionKey,
      ...(id ? { id: { [Op.ne]: id } } : {}),
    },
  });

  if (duplicatePermission) {
    throw createHttpError("Permission action_key is already taken.", 409);
  }
}

async function findRoleOr404(roleId) {
  const roleRecord = await Role.findByPk(roleId);
  if (!roleRecord) {
    throw createHttpError("Role not found.", 404);
  }

  return roleRecord;
}

async function findPermissionOr404(permissionId) {
  const permissionRecord = await Permission.findByPk(permissionId);
  if (!permissionRecord) {
    throw createHttpError("Permission not found.", 404);
  }

  return permissionRecord;
}

function serializeRolePermissionMatrixRow(permissionRecord, rolePermissionRecord, roleRecord) {
  return {
    ...serializePermission(permissionRecord),
    role_permission_id: serializeId(rolePermissionRecord?.id),
    is_allowed: isSuperAdminRoleRecord(roleRecord) || Boolean(rolePermissionRecord?.is_allowed),
  };
}

async function buildRolePermissionsPayload(roleId) {
  const roleRecord = await findRoleOr404(roleId);
  const [permissions, rolePermissions] = await Promise.all([
    getPermissions(),
    RolePermission.findAll({ where: { role_id: roleId } }),
  ]);

  const rolePermissionByPermissionId = new Map(
    rolePermissions.map((rolePermission) => [
      String(rolePermission.permission_id),
      rolePermission,
    ]),
  );

  return {
    role: serializeRole(roleRecord),
    permissions: permissions.map((permissionRecord) => (
      serializeRolePermissionMatrixRow(
        permissionRecord,
        rolePermissionByPermissionId.get(String(permissionRecord.id)),
        roleRecord,
      )
    )),
  };
}

function readRolePermissionUpdates(body) {
  const rawPermissions = Array.isArray(body?.permissions)
    ? body.permissions
    : body?.role_permissions;

  if (!Array.isArray(rawPermissions)) {
    return null;
  }

  return rawPermissions.map((permissionPayload) => {
    if (!permissionPayload || typeof permissionPayload !== "object" || Array.isArray(permissionPayload)) {
      throw createHttpError("Each permission update must be an object.");
    }

    return {
      permission_id: parsePositiveInteger(
        permissionPayload?.permission_id ?? permissionPayload?.id,
        "permission id",
      ),
      is_allowed: normalizeBoolean(permissionPayload?.is_allowed, "is_allowed", { required: true }),
    };
  });
}

async function updateRolePermissionKeys(roleId, allowedPermissionKeys) {
  const permissions = await Permission.findAll({
    where: {
      action_key: {
        [Op.in]: allowedPermissionKeys.length > 0 ? allowedPermissionKeys : ["__none__"],
      },
    },
  });
  const foundPermissionKeys = new Set(permissions.map((permissionRecord) => permissionRecord.action_key));
  const unknownPermissionKeys = allowedPermissionKeys.filter((permissionKey) => !foundPermissionKeys.has(permissionKey));
  if (unknownPermissionKeys.length > 0) {
    throw createHttpError(`Unknown permission key: ${unknownPermissionKeys[0]}`);
  }

  const allPermissions = await Permission.findAll({ attributes: ["id", "action_key"] });
  const allowedPermissionKeySet = new Set(allowedPermissionKeys);

  await Promise.all(
    allPermissions.map((permissionRecord) =>
      RolePermission.upsert({
        role_id: roleId,
        permission_id: permissionRecord.id,
        is_allowed: allowedPermissionKeySet.has(permissionRecord.action_key),
      }),
    ),
  );
}

export async function getRbacOverview(_req, res) {
  const [roles, permissions] = await Promise.all([
    getRolesWithPermissions(),
    getPermissions(),
  ]);

  return res.json({
    roles: roles.map((roleRecord) => serializeRbacRole(roleRecord, permissions)),
    permissions: permissions.map((permissionRecord) => serializePermission(permissionRecord)),
    policy: buildPolicy(roles, permissions),
  });
}

export async function listRoles(_req, res) {
  const roles = await Role.findAll({ order: [["id", "DESC"]] });
  return res.json(roles.map((roleRecord) => serializeRole(roleRecord)));
}

export async function createRole(req, res) {
  const name = normalizeRequiredString(req.body?.name, "Role name", ROLE_NAME_MAX_LENGTH);
  const slug = normalizeRoleSlug(req.body?.slug, name);
  const description = normalizeOptionalString(req.body?.description, "Role description", 65535);
  const is_active = normalizeBoolean(req.body?.is_active, "is_active") ?? true;

  await assertUniqueRoleFields({ name, slug });

  const roleRecord = await Role.create({
    name,
    slug,
    description,
    is_active,
  });

  return res.status(201).json(serializeRole(roleRecord));
}

export async function updateRole(req, res) {
  const roleId = parsePositiveInteger(req.params.roleId, "role id");
  const roleRecord = await findRoleOr404(roleId);
  const nextName = req.body?.name !== undefined
    ? normalizeRequiredString(req.body.name, "Role name", ROLE_NAME_MAX_LENGTH)
    : undefined;
  const nextSlug = req.body?.slug !== undefined
    ? normalizeRoleSlug(req.body.slug, nextName ?? roleRecord.name)
    : undefined;
  const nextDescription = normalizeOptionalString(req.body?.description, "Role description", 65535);
  const nextIsActive = normalizeBoolean(req.body?.is_active, "is_active");

  if (isSuperAdminRoleRecord(roleRecord)) {
    if (nextName !== undefined || nextSlug !== undefined) {
      throw createHttpError("Super Admin role name and slug cannot be changed.", 409);
    }
    if (nextIsActive === false) {
      throw createHttpError("Super Admin role cannot be deactivated.", 409);
    }
  }

  await assertUniqueRoleFields({
    id: roleId,
    name: nextName ?? roleRecord.name,
    slug: nextSlug ?? roleRecord.slug,
  });

  if (nextName !== undefined) {
    roleRecord.name = nextName;
  }
  if (nextSlug !== undefined) {
    roleRecord.slug = nextSlug;
  }
  if (nextDescription !== undefined) {
    roleRecord.description = nextDescription;
  }
  if (nextIsActive !== undefined) {
    roleRecord.is_active = nextIsActive;
  }

  await roleRecord.save();
  return res.json(serializeRole(roleRecord));
}

export async function deleteRole(req, res) {
  const roleId = parsePositiveInteger(req.params.roleId, "role id");
  const roleRecord = await findRoleOr404(roleId);

  if (isSuperAdminRoleRecord(roleRecord)) {
    throw createHttpError("Super Admin role cannot be deleted.", 409);
  }

  const assignedAdminCount = await Admin.count({ where: { role_id: roleId } });
  if (assignedAdminCount > 0) {
    throw createHttpError("Role is assigned to one or more admins.", 409);
  }

  await roleRecord.destroy();
  return res.status(204).send();
}

export async function listPermissions(_req, res) {
  const permissions = await getPermissions();
  return res.json(permissions.map((permissionRecord) => serializePermission(permissionRecord)));
}

export async function createPermission(req, res) {
  const access_group = normalizeRequiredString(
    req.body?.access_group,
    "Permission access_group",
    PERMISSION_ACCESS_GROUP_MAX_LENGTH,
  );
  const action_name = normalizeRequiredString(
    req.body?.action_name,
    "Permission action_name",
    PERMISSION_ACTION_NAME_MAX_LENGTH,
  );
  const action_key = normalizeRequiredString(
    req.body?.action_key,
    "Permission action_key",
    PERMISSION_ACTION_KEY_MAX_LENGTH,
  );
  const endpoint = normalizeOptionalString(req.body?.endpoint, "Permission endpoint", PERMISSION_ENDPOINT_MAX_LENGTH);
  const method = normalizePermissionMethod(req.body?.method);
  const description = normalizeOptionalString(req.body?.description, "Permission description", 65535);

  await assertUniquePermissionActionKey(action_key);

  const permissionRecord = await Permission.create({
    access_group,
    action_name,
    action_key,
    endpoint,
    method,
    description,
  });

  return res.status(201).json(serializePermission(permissionRecord));
}

export async function updatePermission(req, res) {
  const permissionId = parsePositiveInteger(req.params.permissionId, "permission id");
  const permissionRecord = await findPermissionOr404(permissionId);
  const nextAccessGroup = req.body?.access_group !== undefined
    ? normalizeRequiredString(req.body.access_group, "Permission access_group", PERMISSION_ACCESS_GROUP_MAX_LENGTH)
    : undefined;
  const nextActionName = req.body?.action_name !== undefined
    ? normalizeRequiredString(req.body.action_name, "Permission action_name", PERMISSION_ACTION_NAME_MAX_LENGTH)
    : undefined;
  const nextActionKey = req.body?.action_key !== undefined
    ? normalizeRequiredString(req.body.action_key, "Permission action_key", PERMISSION_ACTION_KEY_MAX_LENGTH)
    : undefined;
  const nextEndpoint = normalizeOptionalString(req.body?.endpoint, "Permission endpoint", PERMISSION_ENDPOINT_MAX_LENGTH);
  const nextMethod = normalizePermissionMethod(req.body?.method);
  const nextDescription = normalizeOptionalString(req.body?.description, "Permission description", 65535);

  if (nextActionKey !== undefined && nextActionKey !== permissionRecord.action_key) {
    await assertUniquePermissionActionKey(nextActionKey, permissionId);
  }

  if (nextAccessGroup !== undefined) {
    permissionRecord.access_group = nextAccessGroup;
  }
  if (nextActionName !== undefined) {
    permissionRecord.action_name = nextActionName;
  }
  if (nextActionKey !== undefined) {
    permissionRecord.action_key = nextActionKey;
  }
  if (nextEndpoint !== undefined) {
    permissionRecord.endpoint = nextEndpoint;
  }
  if (nextMethod !== undefined) {
    permissionRecord.method = nextMethod;
  }
  if (nextDescription !== undefined) {
    permissionRecord.description = nextDescription;
  }

  await permissionRecord.save();
  return res.json(serializePermission(permissionRecord));
}

export async function deletePermission(req, res) {
  const permissionId = parsePositiveInteger(req.params.permissionId, "permission id");
  const permissionRecord = await findPermissionOr404(permissionId);
  await permissionRecord.destroy();
  return res.status(204).send();
}

export async function listRolePermissions(req, res) {
  const roleId = parsePositiveInteger(req.params.roleId, "role id");
  return res.json(await buildRolePermissionsPayload(roleId));
}

export async function updateRolePermissions(req, res) {
  const roleId = parsePositiveInteger(req.params.roleId, "role id");
  const roleRecord = await findRoleOr404(roleId);

  if (isSuperAdminRoleRecord(roleRecord)) {
    throw createHttpError("Super Admin permissions are always fully allowed.", 409);
  }

  const rawPermissionKeyList = req.body?.allowed_permission_keys ?? req.body?.permission_keys ?? req.body?.permissions;
  const isPermissionKeyList = Array.isArray(rawPermissionKeyList)
    && rawPermissionKeyList.every((permissionKey) => typeof permissionKey === "string");
  const allowedPermissionKeys = normalizePermissionKeys(rawPermissionKeyList);
  if (Array.isArray(req.body?.allowed_permission_keys) || Array.isArray(req.body?.permission_keys) || isPermissionKeyList) {
    assertAdminCannotManageRbac(roleRecord, allowedPermissionKeys);
    await updateRolePermissionKeys(roleId, allowedPermissionKeys);
    return res.json(await buildRolePermissionsPayload(roleId));
  }

  const rolePermissionUpdates = readRolePermissionUpdates(req.body);
  if (!rolePermissionUpdates) {
    throw createHttpError("permissions must be an array.");
  }

  const permissionIds = [...new Set(rolePermissionUpdates.map((update) => update.permission_id))];
  const existingPermissions = await Permission.findAll({ where: { id: { [Op.in]: permissionIds } } });
  if (existingPermissions.length !== permissionIds.length) {
    throw createHttpError("One or more permissions were not found.");
  }
  const permissionKeyById = new Map(
    existingPermissions.map((permissionRecord) => [String(permissionRecord.id), permissionRecord.action_key]),
  );
  const requestedAllowedPermissionKeys = rolePermissionUpdates
    .filter((rolePermissionUpdate) => rolePermissionUpdate.is_allowed)
    .map((rolePermissionUpdate) => permissionKeyById.get(String(rolePermissionUpdate.permission_id)))
    .filter(Boolean);
  assertAdminCannotManageRbac(roleRecord, requestedAllowedPermissionKeys);

  await Promise.all(rolePermissionUpdates.map((rolePermissionUpdate) => (
    RolePermission.upsert({
      role_id: roleId,
      permission_id: rolePermissionUpdate.permission_id,
      is_allowed: rolePermissionUpdate.is_allowed,
    })
  )));

  return res.json(await buildRolePermissionsPayload(roleId));
}

export async function updateRolePermission(req, res) {
  const roleId = parsePositiveInteger(req.params.roleId, "role id");
  const permissionId = parsePositiveInteger(req.params.permissionId, "permission id");
  const [roleRecord, permissionRecord] = await Promise.all([
    findRoleOr404(roleId),
    findPermissionOr404(permissionId),
  ]);

  if (isSuperAdminRoleRecord(roleRecord)) {
    throw createHttpError("Super Admin permissions are always fully allowed.", 409);
  }

  const is_allowed = normalizeBoolean(req.body?.is_allowed, "is_allowed", { required: true });
  if (is_allowed && isDefaultAdminRoleRecord(roleRecord) && permissionRecord.action_key === RBAC_MANAGE_PERMISSION_KEY) {
    throw createHttpError("Admin role cannot be allowed to manage RBAC.", 409);
  }

  await RolePermission.upsert({
    role_id: roleId,
    permission_id: permissionId,
    is_allowed,
  });

  return res.json(await buildRolePermissionsPayload(roleId));
}
