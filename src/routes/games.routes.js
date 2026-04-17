import { Router } from "express";
import {
  createGame,
  deleteGame,
  getGameById,
  getGameByIdentifier,
  listGames,
  updateGame,
} from "../controllers/games.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const gamesRouter = Router();

gamesRouter.get("/", asyncHandler(listGames));

gamesRouter.post("/", asyncHandler(createGame));
gamesRouter.put("/:gameId", asyncHandler(updateGame));
gamesRouter.delete("/:gameId", asyncHandler(deleteGame));

// Single GET route that handles both numeric ID and slug
gamesRouter.get("/:identifier", asyncHandler(getGameByIdentifier));
