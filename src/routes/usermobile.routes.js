import { Router } from "express";
import {
  listUsermobile,
  getUsermobileByPhone,
  createUsermobile,
  getUsermobileSubscribedGame,
  getUsersMaskedScoreList,
  getUsersMaskedScoreListByGame,
} from "../controllers/usermobile.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const usermobileRouter = Router();

// GET /api/usermobile - lists mobile users.
usermobileRouter.get("/", asyncHandler(listUsermobile));

// GET /api/usermobile/masked/scorelist - returns masked score-list data.
usermobileRouter.get("/masked/scorelist", asyncHandler(getUsersMaskedScoreList));

// GET /api/usermobile/masked/topscorer - returns masked top scorers by game query/body.
usermobileRouter.get("/masked/topscorer", asyncHandler(getUsersMaskedScoreListByGame));

// POST /api/usermobile/masked/topscorer - returns masked top scorers by posted game ID.
usermobileRouter.post("/masked/topscorer", asyncHandler(getUsersMaskedScoreListByGame));

// GET /api/usermobile/games/:gameId - lists verified mobile users subscribed to one game.
usermobileRouter.get("/games/:gameId", asyncHandler(getUsermobileSubscribedGame));

// GET /api/usermobile/:phone - fetches one mobile user by phone number.
usermobileRouter.get("/:phone", asyncHandler(getUsermobileByPhone));

// POST /api/usermobile - creates a mobile user record.
usermobileRouter.post("/", asyncHandler(createUsermobile));
