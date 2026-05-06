import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createAdminuser,
  deleteAdminuser,
  listAdmins,
  updateAdminuser,
} from "../controllers/admins.controller.js";
import { requireAdminPermission } from "../middleware/requireAdminPermission.js";

export const adminsRouter = Router();

// GET /api/admins - lists admin users for admin management.
adminsRouter.get("/", requireAdminPermission("admins.view"), asyncHandler(listAdmins));

// POST /api/admins - creates an admin user.
adminsRouter.post("/", requireAdminPermission("admins.create"), asyncHandler(createAdminuser));

// PUT /api/admins/:id - updates an admin user by ID.
adminsRouter.put("/:id", requireAdminPermission("admins.update"), asyncHandler(updateAdminuser));

// DELETE /api/admins/:id - deletes an admin user by ID.
adminsRouter.delete("/:id", requireAdminPermission("admins.delete"), asyncHandler(deleteAdminuser));
