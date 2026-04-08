import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
// import authRouter from "./routes/auth.routes.js";
import { gamesRouter } from "./routes/games.routes.js";
import { subscribersRouter } from "./routes/subscribers.routes.js";
import { adminsRouter } from "./routes/admins.routes.js";
import { authenticateAdminJwt } from "./middleware/authenticateAdminJwt.js";

export function createApp() {
  const app = express();

  const corsOptions =
    env.corsOrigins.length > 0
      ? { origin: env.corsOrigins }
      : env.nodeEnv === "development"
        ? { origin: "http://localhost:5173" }
        : false;

  if (corsOptions) {
    app.use(cors(corsOptions));
  }

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);

  app.use("/api/games", authenticateAdminJwt, gamesRouter);
  app.use("/api/subscribers", authenticateAdminJwt, subscribersRouter);
  app.use("/api/admins", authenticateAdminJwt, adminsRouter);

  app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    const statusCode = Number(error.statusCode || error.status || 500);
    const safeStatusCode = Number.isFinite(statusCode) && statusCode >= 400 && statusCode < 600 ? statusCode : 500;
    const message =
      safeStatusCode === 500 ? "Internal server error" : error.message || "Request failed";
    return res.status(safeStatusCode).json({ message });
  });

  return app;
}
