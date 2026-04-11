import { Router } from "express";
import {
  listUsermobile,
  getUsermobileByPhone, 
  createUsermobile,
  getUsermobileSubscribedGame 
} from "../controllers/usermobile.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const usermobileRouter = Router();

// GET /api/usermobile
usermobileRouter.get("/", asyncHandler(listUsermobile));

// GET /api/usermobile/games/:gameId 
usermobileRouter.get("/games/:gameId", asyncHandler(getUsermobileSubscribedGame));

// GET /api/usermobile/:phone
usermobileRouter.get("/:phone", asyncHandler(getUsermobileByPhone)); 

// POST /api/usermobile 
usermobileRouter.post("/", asyncHandler(createUsermobile)); 