import { Router } from "express";
import {
  listSubscribersForGame,
  listTenMostRecentSubscribersAcrossGames,
} from "../controllers/subscribers.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const subscribersRouter = Router();

subscribersRouter.get("/recent", asyncHandler(listTenMostRecentSubscribersAcrossGames));
subscribersRouter.get("/games/:gameId", asyncHandler(listSubscribersForGame));
