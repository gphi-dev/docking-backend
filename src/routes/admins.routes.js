import { Router } from "express";
import { listAdmins } from "../controllers/admins.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminsRouter = Router();

adminsRouter.get("/", asyncHandler(listAdmins));
