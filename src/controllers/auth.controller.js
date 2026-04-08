import jwt from "jsonwebtoken";
import { Admin } from "../models/index.js";
import { env } from "../config/env.js";
import { verifyPassword } from "../utils/password.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * @helper generateOTP
 * @description Generates a random 6-digit OTP for verification
 * @returns {string} 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * @service mockSmsProvider
 * @description Simulates sending an SMS notification. 
 * (In production, extract this to src/services/sms.service.js)
 * @param {string} mobile - The recipient's mobile number
 * @param {string} text - The text message to send
 * @returns {Promise<Object>} Mock delivery receipt
 */
const mockSmsProvider = async (mobile, text) => {
  console.log(`[MOCK SMS API] Sending to ${mobile}...`);
  console.log(`[MOCK SMS API] Message: "${text}"`);
  
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 500)); 
  
  return {
    success: true,
    providerId: `mock-sms-${Date.now()}`,
    deliveredTo: mobile
  };
};

/**
 * @controller loginAdmin
 * @description Authenticates an admin user and issues a JWT
 * @route POST /api/admin/login
 * @access Public
 */
export const loginAdmin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // 1. Validate Payload
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  try {
    // 2. Fetch Admin Record
    const adminRecord = await Admin.findOne({ where: { username } });
    if (!adminRecord) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 3. Verify Password
    const passwordMatches = await verifyPassword(password, adminRecord.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // 4. Generate Token
    const token = jwt.sign(
      { username: adminRecord.username },
      env.jwtSecret,
      {
        subject: String(adminRecord.id),
        expiresIn: env.jwtExpiresIn,
      }
    );

    // 5. Send Response
    return res.status(200).json({
      token,
      admin: {
        id: adminRecord.id,
        username: adminRecord.username,
      },
    });
  } catch (error) {
    // Specific fallback for uninitialized database tables during local development
    const mysqlErrorCode = error?.parent?.code || error?.original?.code;
    if (mysqlErrorCode === "ER_NO_SUCH_TABLE") {
      return res.status(503).json({
        message: "Database tables are missing. From the backend folder run: npm run db:schema && npm run db:seed-admin",
      });
    }
    // Let the asyncHandler catch anything else
    throw error;
  }
});

/**
 * @controller gameMobileVerification
 * @description Authenticates a game session, generates a JWT, and dispatches a mock SMS and OTP
 * @route POST /api/auth/game-login
 * @access Public
 */
import { UserMobile } from "../models/usersmobile.model.js";

export async function createOtpSession(req, res) {
  const phone = req.body?.phone;
  const game_id = req.body?.game_id;

  // 1. Validate required inputs
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ message: "phone is required" });
  }

  if (!game_id) {
    return res.status(400).json({ message: "game_id is required" });
  }

  try {
    // 2. Generate OTP and calculate expiration
    // Generates a random 6-digit string
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); 
    
    // OTP expires in 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); 

    // 3. Save session/OTP data to the database
    const createdSession = await UserMobile.create({
      phone: phone,
      game_id: game_id,
      is_verified: 0, // Default to 0 based on image
      verified_at: null,
      otp: otpCode,
      otp_expires_at: expiresAt,
    });

    return res.status(201).json(createdSession);
  } catch (error) {
    console.error("Error saving OTP session:", error);
    return res.status(500).json({ message: "Internal server error while creating session" });
  }
}