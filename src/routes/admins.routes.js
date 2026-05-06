import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createAdminuser,
  deleteAdminuser,
  listAdmins,
  updateAdminuser,
} from "../controllers/admins.controller.js";
import { requireAnyAdminPermission } from "../middleware/requireAdminPermission.js";

export const adminsRouter = Router();

// GET /api/admins - lists admin users for admin management.
adminsRouter.get("/", requireAnyAdminPermission(["rbac.manage", "admins.view"]), asyncHandler(listAdmins));

// POST /api/admins - creates an admin user.
adminsRouter.post("/", requireAnyAdminPermission(["rbac.manage", "admins.create"]), asyncHandler(createAdminuser));

// PUT /api/admins/:id - updates an admin user by ID.
adminsRouter.put("/:id", requireAnyAdminPermission(["rbac.manage", "admins.update"]), asyncHandler(updateAdminuser));

// DELETE /api/admins/:id - deletes an admin user by ID.
adminsRouter.delete("/:id", requireAnyAdminPermission(["rbac.manage", "admins.delete"]), asyncHandler(deleteAdminuser));
