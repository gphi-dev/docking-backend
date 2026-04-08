import { Router } from "express";
import {
  createGame,
  deleteGame,
  getGameById,
  listGames,
  updateGame,
} from "../controllers/games.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const gamesRouter = Router();

gamesRouter.get("/", asyncHandler(listGames));
gamesRouter.get("/:gameId", asyncHandler(getGameById));
gamesRouter.post("/", asyncHandler(createGame));
gamesRouter.put("/:gameId", asyncHandler(updateGame));
gamesRouter.delete("/:gameId", asyncHandler(deleteGame));
