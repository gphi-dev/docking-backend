import { Router } from "express";
import {
  createGame,
  deleteGame,
  getGameByIdentifier,
  listGames,
  updateGame,
} from "../controllers/games.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const gamesRouter = Router();

// GET /api/games - admin catalog alias handled by listGames.
gamesRouter.get("/", asyncHandler(listGames));

// POST /api/games - creates a game record and generated slug.
gamesRouter.post("/", asyncHandler(createGame));

// PUT /api/games/:gameId - updates editable game fields by numeric ID.
gamesRouter.put("/:gameId", asyncHandler(updateGame));

// DELETE /api/games/:gameId - removes a game by numeric ID.
gamesRouter.delete("/:gameId", asyncHandler(deleteGame));

// GET /api/games/:identifier - fetches one game by numeric ID or slug.
gamesRouter.get("/:identifier", asyncHandler(getGameByIdentifier));
