import { Router } from "express";
import {
  listUsermobile,
  getGameByPhone,
  createUsermobile 
} from "../controllers/usermobile.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const usermobileRouter = Router();

// GET /usermobile
usermobileRouter.get("/", asyncHandler(listUsermobile));

// GET /usermobile/:phone
usermobileRouter.get("/:phone", asyncHandler(getGameByPhone));

// POST /usermobile <-- This handles creating the user!
usermobileRouter.post("/usermobile", asyncHandler(createUsermobile));

