import { Router } from "express";
import { getCurrentAdmin, loginAdmin } from "../controllers/auth.controller.js";
import { createOtpSession } from "../controllers/auth.controller.js";
import { authenticateAdminJwt } from "../middleware/authenticateAdminJwt.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRouter = Router();

// POST /api/auth/login - authenticates an admin and returns an admin JWT.
authRouter.post("/login", asyncHandler(loginAdmin));

// GET /api/auth/me - returns live admin profile and permissions for the current token.
authRouter.get("/me", authenticateAdminJwt, asyncHandler(getCurrentAdmin));

// POST /api/auth/game-login - starts a public mobile game OTP session.
authRouter.post("/game-login", createOtpSession);
