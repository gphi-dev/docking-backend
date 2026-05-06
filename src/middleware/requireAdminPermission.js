import {
  isSuperAdminRoleRecord,
} from "../utils/rbac.js";

function hasRequiredPermission(admin, permissionKey) {
  if (!permissionKey) {
    return true;
  }

  if (isSuperAdminRoleRecord(admin?.rbac_role)) {
    return true;
  }

  return Array.isArray(admin?.permissions) && admin.permissions.includes(permissionKey);
}

export function requireAdminPermission(permissionKey) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: "Admin authentication is required." });
    }

    if (!hasRequiredPermission(req.admin, permissionKey)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }

    return next();
  };
}

export function requireAnyAdminPermission(permissionKeys) {
  const normalizedPermissionKeys = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];

  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: "Admin authentication is required." });
    }

    const hasAccess = normalizedPermissionKeys.some((permissionKey) =>
      hasRequiredPermission(req.admin, permissionKey),
    );

    if (!hasAccess) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }

    return next();
  };
}
