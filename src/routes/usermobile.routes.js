import { Router } from "express";
import {
  listUsermobile,
<<<<<<< HEAD
  getUsermobileByPhone,
  createUsermobile,
  getUsermobileSubscribedGame,
  getUsersMaskedScoreList,
  getUsersMaskedScoreListByGame,
=======
  getUsermobileByPhone, 
  createUsermobile,
  getUsermobileSubscribedGame,
  getUsersMaskedScoreList,
  getUsersMaskedScoreListByGame
>>>>>>> 5d2b32343389eb6bb0a81dc4e362816a68cde237
} from "../controllers/usermobile.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const usermobileRouter = Router();

<<<<<<< HEAD
usermobileRouter.get("/", asyncHandler(listUsermobile));
usermobileRouter.get("/masked/scorelist", asyncHandler(getUsersMaskedScoreList));
usermobileRouter.post("/masked/topscorer", asyncHandler(getUsersMaskedScoreListByGame));
usermobileRouter.get("/games/:gameId", asyncHandler(getUsermobileSubscribedGame));
usermobileRouter.get("/:phone", asyncHandler(getUsermobileByPhone));
usermobileRouter.post("/", asyncHandler(createUsermobile));
=======
// GET /api/usermobile
usermobileRouter.get("/", asyncHandler(listUsermobile));

// GET /api/usermobile/masked/scorelist
usermobileRouter.get("/masked/scorelist", asyncHandler(getUsersMaskedScoreList));

// POST /api/usermobile//masked/topscorer
usermobileRouter.post("/masked/topscorer", asyncHandler(getUsersMaskedScoreListByGame));

// GET /api/usermobile/games/:gameId 
usermobileRouter.get("/games/:gameId", asyncHandler(getUsermobileSubscribedGame));

// GET /api/usermobile/:phone
usermobileRouter.get("/:phone", asyncHandler(getUsermobileByPhone)); 

// POST /api/usermobile 
usermobileRouter.post("/", asyncHandler(createUsermobile)); 
>>>>>>> 5d2b32343389eb6bb0a81dc4e362816a68cde237
