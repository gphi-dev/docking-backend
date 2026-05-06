import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Admin, Permission, Role, RolePermission } from "../models/index.js";
import {
  isSuperAdminAdminRecord,
  serializeAllowedPermissionKeysFromRole,
  serializeId,
  serializeRole,
} from "../utils/rbac.js";

const ADMIN_AUTH_INCLUDE = [
  {
    model: Role,
    as: "rbacRole",
    attributes: ["id", "name", "slug", "description", "is_active", "created_at", "updated_at"],
    include: [
      {
        model: RolePermission,
        as: "rolePermissions",
        attributes: ["id", "permission_id", "is_allowed"],
        include: [
          {
            model: Permission,
            as: "permission",
            attributes: ["id", "action_key"],
          },
        ],
      },
    ],
  },
];

async function resolveLivePermissionKeys(adminRecord) {
  if (isSuperAdminAdminRecord(adminRecord)) {
    const permissions = await Permission.findAll({ attributes: ["action_key"] });
    return permissions.map((permissionRecord) => permissionRecord.action_key);
  }

  return serializeAllowedPermissionKeysFromRole(adminRecord.rbacRole);
}

export async function authenticateAdminJwt(req, res, next) {
  const authorizationHeaderValue = req.header("Authorization");
  if (!authorizationHeaderValue || !authorizationHeaderValue.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  const jsonWebToken = authorizationHeaderValue.slice("Bearer ".length).trim();
  if (!jsonWebToken) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  let decodedPayload;
  try {
    decodedPayload = jwt.verify(jsonWebToken, env.jwtSecret);
    if (!decodedPayload || typeof decodedPayload !== "object") {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    if (!decodedPayload.sub || !decodedPayload.username) {
      return res.status(401).json({ message: "Invalid token claims" });
    }

  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  try {
    const adminRecord = await Admin.findByPk(decodedPayload.sub, {
      attributes: ["id", "username", "email", "role", "role_id", "status"],
      include: ADMIN_AUTH_INCLUDE,
    });

    if (!adminRecord) {
      return res.status(401).json({ message: "Admin account no longer exists" });
    }

    if (adminRecord.status !== "active") {
      return res.status(403).json({ message: "Admin account is inactive." });
    }
    if (adminRecord.rbacRole && !adminRecord.rbacRole.is_active) {
      return res.status(403).json({ message: "Admin role is inactive." });
    }

    const permissionKeys = await resolveLivePermissionKeys(adminRecord);

    req.admin = {
      id: Number(adminRecord.id),
      username: adminRecord.username,
      email: adminRecord.email ?? null,
      role: adminRecord.role ?? adminRecord.rbacRole?.name ?? null,
      role_id: serializeId(adminRecord.role_id),
      status: adminRecord.status,
      rbac_role: serializeRole(adminRecord.rbacRole),
      permissions: permissionKeys,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}
