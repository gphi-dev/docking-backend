import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listAdmins, createAdminuser, updateAdminuser } from "../controllers/admins.controller.js";

export const adminsRouter = Router();

adminsRouter.get("/", asyncHandler(listAdmins));
adminsRouter.post("/", asyncHandler(createAdminuser));

//PUT route
adminsRouter.put("/:id", asyncHandler(updateAdminuser));