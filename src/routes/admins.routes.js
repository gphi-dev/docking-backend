import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listAdmins, createAdminuser, updateAdminuser } from "../controllers/admins.controller.js";

export const adminsRouter = Router();

// GET /api/admins - lists admin users for admin management.
adminsRouter.get("/", asyncHandler(listAdmins));

// POST /api/admins - creates an admin user.
adminsRouter.post("/", asyncHandler(createAdminuser));

// PUT /api/admins/:id - updates an admin user by ID.
adminsRouter.put("/:id", asyncHandler(updateAdminuser));
