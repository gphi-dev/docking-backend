import { Router } from "express";
import {
  createPermission,
  createRole,
  deletePermission,
  deleteRole,
  getRbacOverview,
  listRolePermissions,
  listPermissions,
  listRoles,
  updatePermission,
  updateRole,
  updateRolePermission,
  updateRolePermissions,
} from "../controllers/rbac.controller.js";
import { requireAdminPermission, requireAnyAdminPermission } from "../middleware/requireAdminPermission.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const rbacRouter = Router();

// GET /api/rbac - full role/permission matrix for the RBAC management screen.
rbacRouter.get("/", requireAdminPermission("rbac.manage"), asyncHandler(getRbacOverview));

// GET /api/rbac/roles - role choices used by admin user create/update forms.
rbacRouter.get(
  "/roles",
  requireAnyAdminPermission(["rbac.manage", "admins.view", "admins.create", "admins.update"]),
  asyncHandler(listRoles),
);
rbacRouter.post("/roles", requireAdminPermission("rbac.manage"), asyncHandler(createRole));
rbacRouter.put("/roles/:roleId", requireAdminPermission("rbac.manage"), asyncHandler(updateRole));
rbacRouter.delete("/roles/:roleId", requireAdminPermission("rbac.manage"), asyncHandler(deleteRole));

// GET /api/rbac/permissions - raw permission catalog.
rbacRouter.get("/permissions", requireAdminPermission("rbac.manage"), asyncHandler(listPermissions));
rbacRouter.post("/permissions", requireAdminPermission("rbac.manage"), asyncHandler(createPermission));
rbacRouter.put("/permissions/:permissionId", requireAdminPermission("rbac.manage"), asyncHandler(updatePermission));
rbacRouter.delete("/permissions/:permissionId", requireAdminPermission("rbac.manage"), asyncHandler(deletePermission));

// PUT /api/rbac/roles/:roleId/permissions - saves allowed permissions for one role.
rbacRouter.get(
  "/roles/:roleId/permissions",
  requireAdminPermission("rbac.manage"),
  asyncHandler(listRolePermissions),
);
rbacRouter.put(
  "/roles/:roleId/permissions",
  requireAdminPermission("rbac.manage"),
  asyncHandler(updateRolePermissions),
);
rbacRouter.put(
  "/roles/:roleId/permissions/:permissionId",
  requireAdminPermission("rbac.manage"),
  asyncHandler(updateRolePermission),
);
