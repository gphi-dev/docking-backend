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
export const gameMobileVerification = asyncHandler(async (req, res) => {
  const { gameid, gamesecretkey, usermobilenumber } = req.body;

  // 1. Validate Payload
  if (!gameid || !gamesecretkey || !usermobilenumber) {
    return res.status(400).json({ 
      error: "Missing required fields: gameid, gamesecretkey, and usermobilenumber are required." 
    });
  }

  // 2. Generate Session Token
  const payload = {
    gameId: gameid,
    mobileNumber: usermobilenumber,
    role: "player" 
  };

  const token = jwt.sign(
    payload, 
    env.jwtSecret, 
    { expiresIn: env.jwtExpiresIn || "8h" }
  );

  // 3. Generate OTP
  const otpCode = generateOTP();

  // 4. Dispatch Notification and OTP concurrently
  const welcomeMessage = `Welcome to game ${gameid}! Your session has started.`;
  const otpMessage = `Your verification code is: ${otpCode}. It is valid for 5 minutes.`;
  
  const [notificationResult, otpResult] = await Promise.all([
    mockSmsProvider(usermobilenumber, welcomeMessage),
    mockSmsProvider(usermobilenumber, otpMessage)
  ]);

  // 5. Save session/OTP data to the database
  // We store the OTP and mobile number so we can verify it in the next endpoint
  await Session.create({
    gameId: gameid,
    mobileNumber: usermobilenumber,
    otp: otpCode,
    token: token, // Optional: Store to track active sessions
    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // OTP expires in 5 mins
  });


  // 6. Send Response
  return res.status(200).json({
    message: "Authentication successful. Verification OTP dispatched.",
    token,
    // otp: otpCode, // <--- This is what adds it to the response
    deliveryStatus: {
      notificationSent: notificationResult.success,
      otpSent: otpResult.success
    }
  });
});