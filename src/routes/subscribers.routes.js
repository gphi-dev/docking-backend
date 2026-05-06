import { Router } from "express";
import {
  listSubscribersForGame,
  listTenMostRecentSubscribersAcrossGames,
} from "../controllers/subscribers.controller.js";
import { requireAdminPermission } from "../middleware/requireAdminPermission.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const subscribersRouter = Router();

// GET /api/subscribers/recent - lists the most recent subscribers across games.
subscribersRouter.get(
  "/recent",
  requireAdminPermission("subscribers.view"),
  asyncHandler(listTenMostRecentSubscribersAcrossGames),
);

// GET /api/subscribers/games/:gameId - lists subscribers for one game.
subscribersRouter.get(
  "/games/:gameId",
  requireAdminPermission("subscribers.view_game_subscribers"),
  asyncHandler(listSubscribersForGame),
);
