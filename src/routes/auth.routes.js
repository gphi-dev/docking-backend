import { Router } from "express";
import { loginAdmin } from "../controllers/auth.controller.js";
import { createOtpSession } from "../controllers/auth.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRouter = Router();

// POST /api/auth/login - authenticates an admin and returns an admin JWT.
authRouter.post("/login", asyncHandler(loginAdmin));

// POST /api/auth/game-login - starts a public mobile game OTP session.
authRouter.post("/game-login", createOtpSession);
