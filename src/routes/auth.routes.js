import { Router } from "express";
import { loginAdmin } from "../controllers/auth.controller.js";
import { gameMobileVerification } from "../controllers/auth.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(loginAdmin));

// Public game login route (No auth middleware here!)
authRouter.post("/game-login", gameMobileVerification);
