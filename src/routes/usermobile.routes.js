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

usermobileRouter.get("/", asyncHandler(listUsermobile));
usermobileRouter.get("/masked/scorelist", asyncHandler(getUsersMaskedScoreList));
usermobileRouter.post("/masked/topscorer", asyncHandler(getUsersMaskedScoreListByGame));
usermobileRouter.get("/games/:gameId", asyncHandler(getUsermobileSubscribedGame));
usermobileRouter.get("/:phone", asyncHandler(getUsermobileByPhone));
usermobileRouter.post("/", asyncHandler(createUsermobile));
