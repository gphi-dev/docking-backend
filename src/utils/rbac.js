export const SUPER_ADMIN_ROLE_NAME = "Super Admin";
export const SUPER_ADMIN_ROLE_SLUG = "super-admin";

export function serializeId(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  const numericValue = Number(rawValue);
  return Number.isSafeInteger(numericValue) ? numericValue : String(rawValue);
}

export function normalizeRoleKey(rawValue) {
  if (typeof rawValue !== "string") {
    return "";
  }

  return rawValue
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function isSuperAdminRoleValue(rawValue) {
  return normalizeRoleKey(rawValue) === "super admin";
}

export function isSuperAdminRoleRecord(roleRecord) {
  if (!roleRecord) {
    return false;
  }

  return (
    isSuperAdminRoleValue(roleRecord.name) ||
    isSuperAdminRoleValue(roleRecord.slug)
  );
}

export function isSuperAdminAdminRecord(adminRecord) {
  if (!adminRecord) {
    return false;
  }

  if (adminRecord.rbacRole !== undefined || adminRecord.role_id !== undefined) {
    return isSuperAdminRoleRecord(adminRecord.rbacRole);
  }

  return isSuperAdminRoleValue(adminRecord.role);
}

export function serializeRole(roleRecord) {
  if (!roleRecord) {
    return null;
  }

  return {
    id: serializeId(roleRecord.id),
    name: roleRecord.name,
    slug: roleRecord.slug,
    description: roleRecord.description ?? null,
    is_active: Boolean(roleRecord.is_active),
    created_at: roleRecord.created_at ?? roleRecord.createdAt ?? null,
    updated_at: roleRecord.updated_at ?? roleRecord.updatedAt ?? null,
  };
}

export function serializePermission(permissionRecord) {
  if (!permissionRecord) {
    return null;
  }

  return {
    id: serializeId(permissionRecord.id),
    access_group: permissionRecord.access_group,
    action_name: permissionRecord.action_name,
    action_key: permissionRecord.action_key,
    endpoint: permissionRecord.endpoint ?? null,
    method: permissionRecord.method ?? null,
    description: permissionRecord.description ?? null,
    created_at: permissionRecord.created_at ?? permissionRecord.createdAt ?? null,
    updated_at: permissionRecord.updated_at ?? permissionRecord.updatedAt ?? null,
  };
}

export function serializeAllowedPermissionsFromRole(roleRecord) {
  return (roleRecord?.rolePermissions ?? [])
    .filter((rolePermission) => Boolean(rolePermission.is_allowed))
    .map((rolePermission) => serializePermission(rolePermission.permission))
    .filter(Boolean);
}

export function serializeAllowedPermissionKeysFromRole(roleRecord) {
  return serializeAllowedPermissionsFromRole(roleRecord).map((permission) => permission.action_key);
}

export function normalizePermissionKeys(rawPermissionKeys) {
  if (!Array.isArray(rawPermissionKeys)) {
    return [];
  }

  return [...new Set(
    rawPermissionKeys
      .map((permissionKey) => String(permissionKey ?? "").trim())
      .filter(Boolean),
  )];
}

export function roleHasPermission(roleRecord, permissionKey) {
  if (isSuperAdminRoleRecord(roleRecord)) {
    return true;
  }

  return serializeAllowedPermissionKeysFromRole(roleRecord).includes(permissionKey);
}
