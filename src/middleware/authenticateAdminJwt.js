import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function authenticateAdminJwt(req, res, next) {
  const authorizationHeaderValue = req.header("Authorization");
  if (!authorizationHeaderValue || !authorizationHeaderValue.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  const jsonWebToken = authorizationHeaderValue.slice("Bearer ".length).trim();
  if (!jsonWebToken) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  try {
    const decodedPayload = jwt.verify(jsonWebToken, env.jwtSecret);
    if (!decodedPayload || typeof decodedPayload !== "object") {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    if (!decodedPayload.sub || !decodedPayload.username) {
      return res.status(401).json({ message: "Invalid token claims" });
    }

    req.admin = {
      id: Number(decodedPayload.sub),
      username: String(decodedPayload.username),
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
