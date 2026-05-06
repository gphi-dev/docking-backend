import { Router } from "express";
import {
  listUsermobile,
  getUsermobileByPhone,
  createUsermobile,
  getUsermobileSubscribedGame,
  getUsersMaskedScoreList,
  getUsersMaskedScoreListByGame,
} from "../controllers/usermobile.controller.js";
import { requireAdminPermission } from "../middleware/requireAdminPermission.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const usermobileRouter = Router();

// GET /api/usermobile - lists mobile users.
usermobileRouter.get("/", requireAdminPermission("subscribers.view"), asyncHandler(listUsermobile));

// GET /api/usermobile/masked/scorelist - returns masked score-list data.
usermobileRouter.get(
  "/masked/scorelist",
  requireAdminPermission("subscribers.view_scores"),
  asyncHandler(getUsersMaskedScoreList),
);

// GET /api/usermobile/masked/topscorer - returns masked top scorers by game query/body.
usermobileRouter.get(
  "/masked/topscorer",
  requireAdminPermission("subscribers.view_scores"),
  asyncHandler(getUsersMaskedScoreListByGame),
);

// POST /api/usermobile/masked/topscorer - returns masked top scorers by posted game ID.
usermobileRouter.post(
  "/masked/topscorer",
  requireAdminPermission("subscribers.view_scores"),
  asyncHandler(getUsersMaskedScoreListByGame),
);

// GET /api/usermobile/games/:gameId - lists verified mobile users subscribed to one game.
usermobileRouter.get(
  "/games/:gameId",
  requireAdminPermission("subscribers.view_by_game"),
  asyncHandler(getUsermobileSubscribedGame),
);

// GET /api/usermobile/:phone - fetches one mobile user by phone number.
usermobileRouter.get("/:phone", requireAdminPermission("subscribers.view"), asyncHandler(getUsermobileByPhone));

// POST /api/usermobile - creates a mobile user record.
usermobileRouter.post("/", requireAdminPermission("subscribers.create"), asyncHandler(createUsermobile));
