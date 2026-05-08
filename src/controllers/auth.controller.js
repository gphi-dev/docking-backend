import jwt from "jsonwebtoken";
import { Admin, Game, Permission, Role, RolePermission, Usermobile } from "../models/index.js";
import { env } from "../config/env.js";
import { verifyPassword } from "../utils/password.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  isSuperAdminAdminRecord,
  serializeAllowedPermissionKeysFromRole,
  serializeAllowedPermissionsFromRole,
  serializeId,
  serializePermission,
  serializeRole,
} from "../utils/rbac.js";

const ADMIN_AUTH_INCLUDE = [
  {
    model: Role,
    as: "rbacRole",
    attributes: ["id", "name", "slug", "description", "is_active", "created_at", "updated_at"],
    include: [
      {
        model: RolePermission,
        as: "rolePermissions",
        attributes: ["id", "permission_id", "is_allowed"],
        include: [
          {
            model: Permission,
            as: "permission",
            attributes: [
              "id",
              "access_group",
              "action_name",
              "action_key",
              "endpoint",
              "method",
              "description",
              "created_at",
              "updated_at",
            ],
          },
        ],
      },
    ],
  },
];

async function resolveAdminPermissions(adminRecord) {
  if (isSuperAdminAdminRecord(adminRecord)) {
    const permissions = await Permission.findAll({ order: [["access_group", "ASC"], ["action_name", "ASC"]] });
    return permissions.map((permissionRecord) => serializePermission(permissionRecord));
  }

  return serializeAllowedPermissionsFromRole(adminRecord.rbacRole);
}

async function findAdminForAuthById(adminId) {
  return Admin.findByPk(adminId, {
    include: ADMIN_AUTH_INCLUDE,
  });
}

async function serializeAdminAuthPayload(adminRecord) {
  const permissions = await resolveAdminPermissions(adminRecord);
  const permissionKeys = isSuperAdminAdminRecord(adminRecord)
    ? permissions.map((permission) => permission.action_key)
    : serializeAllowedPermissionKeysFromRole(adminRecord.rbacRole);
  const roleName = adminRecord.rbacRole?.name ?? adminRecord.role ?? null;

  return {
    id: adminRecord.id,
    username: adminRecord.username,
    email: adminRecord.email ?? null,
    role: roleName,
    role_id: serializeId(adminRecord.role_id),
    status: adminRecord.status,
    rbac_role: serializeRole(adminRecord.rbacRole),
    permissions,
    permission_keys: permissionKeys,
  };
}

/**
 * @helper generateOTP
 * @description Generates a random 6-digit OTP for verification
 * @returns {string} 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

function parsePoints(rawValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return 0;
  }

  const points = Number.parseInt(String(rawValue), 10);
  if (!Number.isFinite(points)) {
    return null;
  }

  return points;
}

function parseIsVerified(rawValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return 0;
  }

  if (typeof rawValue === "boolean") {
    return rawValue ? 1 : 0;
  }

  const normalizedValue = String(rawValue).trim().toLowerCase();
  if (["1", "true", "yes", "verified"].includes(normalizedValue)) {
    return 1;
  }
  if (["0", "false", "no", "unverified"].includes(normalizedValue)) {
    return 0;
  }

  return null;
}

function parseNickname(rawValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return null;
  }

  const nickname = String(rawValue).trim();
  if (nickname.length > 55) {
    return null;
  }

  return nickname;
}

function readGameSecretKeyPayload(body) {
  if (Object.prototype.hasOwnProperty.call(body ?? {}, "gamesecretkey")) {
    return body.gamesecretkey;
  }

  if (Object.prototype.hasOwnProperty.call(body ?? {}, "game_secret_key")) {
    return body.game_secret_key;
  }

  return undefined;
}

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
 * @route POST /api/auth/login
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
    const adminRecord = await Admin.findOne({
      where: { username },
      include: ADMIN_AUTH_INCLUDE,
    });
    if (!adminRecord) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (adminRecord.status !== "active") {
      return res.status(403).json({ message: "Admin account is inactive." });
    }
    if (adminRecord.rbacRole && !adminRecord.rbacRole.is_active) {
      return res.status(403).json({ message: "Admin role is inactive." });
    }

    // 3. Verify Password
    const passwordMatches = await verifyPassword(password, adminRecord.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const admin = await serializeAdminAuthPayload(adminRecord);

    // 4. Generate Token
    const token = jwt.sign(
      {
        username: adminRecord.username,
      },
      env.jwtSecret,
      {
        subject: String(adminRecord.id),
        expiresIn: env.jwtExpiresIn,
      }
    );

    // 5. Send Response
    return res.status(200).json({
      token,
      admin,
    });
  } catch (error) {
    // Specific fallback for uninitialized database tables during local development
    const mysqlErrorCode = error?.parent?.code || error?.original?.code;
    if (mysqlErrorCode === "ER_NO_SUCH_TABLE" || mysqlErrorCode === "ER_BAD_FIELD_ERROR") {
      return res.status(503).json({
        message: "Database tables are missing. From the backend folder run: npm run db:schema && npm run db:seed-admin",
      });
    }
    // Let the asyncHandler catch anything else
    throw error;
  }
});

export const getCurrentAdmin = asyncHandler(async (req, res) => {
  const adminRecord = await findAdminForAuthById(req.admin?.id);
  if (!adminRecord) {
    return res.status(401).json({ message: "Admin account no longer exists" });
  }

  if (adminRecord.status !== "active") {
    return res.status(403).json({ message: "Admin account is inactive." });
  }
  if (adminRecord.rbacRole && !adminRecord.rbacRole.is_active) {
    return res.status(403).json({ message: "Admin role is inactive." });
  }

  const admin = await serializeAdminAuthPayload(adminRecord);
  return res.json({ admin });
});

/**
 * @description Authenticates a game session, generates a JWT, and dispatches a mock SMS and OTP
 * @route POST /api/auth/game-login
 * @access Public
 */
export async function createOtpSession(req, res) {
  let phone = req.body?.phone;
  const game_id = req.body?.game_id;
  const gamesecretkey = readGameSecretKeyPayload(req.body);
  const points = parsePoints(req.body?.points);
  const isVerified = parseIsVerified(req.body?.is_verified);
  const nickname = parseNickname(req.body?.nickname);
  // Initial existence checks
  if (!phone) {
    return res.status(400).json({ 
      success: false, 
      errorCode: "ERR_MISSING_PHONE", 
      message: "phone is required" 
    });
  }

  if (!game_id) {
    return res.status(400).json({ 
      success: false, 
      errorCode: "ERR_MISSING_GAME_ID", 
      message: "game_id is required" 
    });
  }

  if (gamesecretkey === undefined || gamesecretkey === null || String(gamesecretkey).trim() === "") {
    return res.status(400).json({
      success: false,
      errorCode: "ERR_MISSING_GAME_SECRET_KEY",
      message: "gamesecretkey is required"
    });
  }

  if (points === null) {
    return res.status(400).json({
      success: false,
      errorCode: "ERR_INVALID_POINTS",
      message: "points must be a valid integer"
    });
  }

  if (isVerified === null) {
    return res.status(400).json({
      success: false,
      errorCode: "ERR_INVALID_IS_VERIFIED",
      message: "is_verified must be 1, 0, true, or false"
    });
  }

  if (req.body?.nickname !== undefined && nickname === null && String(req.body.nickname).trim() !== "") {
    return res.status(400).json({
      success: false,
      errorCode: "ERR_INVALID_NICKNAME",
      message: "nickname must be 55 characters or fewer"
    });
  }

  // PHONE VALIDATION & TRANSFORMATION
  // Convert to string (in case a raw number was sent) and trim whitespace
  phone = String(phone).trim();

  // If the user inputted a leading 0, remove it
  if (phone.startsWith("0")) {
    phone = phone.slice(1);
  }

  // Check if the resulting string contains ONLY numbers (0-9)
  const isOnlyNumbers = /^\d+$/.test(phone);
  if (!isOnlyNumbers) {
    return res.status(400).json({ 
      success: false, 
      errorCode: "ERR_INVALID_PHONE_FORMAT", 
      message: "Phone must contain only numbers" 
    });
  }

  // Check if it is exactly 10 digits long (after removing the 0)
  if (phone.length !== 10) {
    return res.status(400).json({ 
      success: false, 
      errorCode: "ERR_INVALID_PHONE_LENGTH", 
      message: "Phone must be exactly 10 digits (excluding the zero)" 
    });
  }

  if (!phone.startsWith("9")) {
    return res.status(400).json({
      success: false,
      errorCode: "ERR_INVALID_PHONE_PREFIX",
      message: "Phone must start with 9"
    });
  }

  try {
    const game = await Game.findOne({
      attributes: ["id", "game_id", "gamesecretkey"],
      where: {
        game_id: game_id,
      },
    });

    if (!game) {
      return res.status(404).json({
        success: false,
        errorCode: "ERR_GAME_NOT_FOUND",
        message: "Game not found"
      });
    }

    if (String(game.gamesecretkey ?? "").trim() !== String(gamesecretkey).trim()) {
      return res.status(401).json({
        success: false,
        errorCode: "ERR_INVALID_GAME_SECRET_KEY",
        message: "gamesecretkey does not match game_id"
      });
    }

    // VALIDATION: Check if phone + game_id already exists
    const existingUser = await Usermobile.findOne({
      where: {
        phone: phone, // This is now the clean, 10-digit version without the '0'
        game_id: game_id
      }
    });

    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        errorCode: "ERR_PHONE_ALREADY_USED", 
        message: "Phone number already used for this game" 
      });
    }

    // Generate OTP and calculate expiration
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); 
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); 

    // Save session/OTP data to the database
    const createdSession = await Usermobile.create({
      phone: phone, // Saves the transformed 10-digit number
      nickname: nickname,
      game_id: game_id,
      is_verified: isVerified,
      verified_at: isVerified ? new Date() : null,
      otp: otpCode,
      otp_expires_at: expiresAt,
      points: points,
    });

    // Generate the JWT (Bearer Token)
    const secretKey = process.env.JWT_SECRET || "temporary_development_secret_key";
    
    const tokenPayload = {
      sessionId: createdSession.id,
      phone: createdSession.phone,
      nickname: createdSession.nickname,
      game_id: createdSession.game_id,
      is_verified: createdSession.is_verified
    };

    const token = jwt.sign(tokenPayload, secretKey, { expiresIn: '5m' });

    // Return the success response
    return res.status(201).json({
      success: true,
      successCode: "SUCCESS_SESSION_CREATED",
      data: [
        {
          game_id: createdSession.game_id,
          nickname: createdSession.nickname,
          points: createdSession.points,
          is_verified: createdSession.is_verified
        }
      ],
      token: token                
    });
  } catch (error) {
    console.error("Error saving OTP session:", error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        errorCode: "ERR_DB_VALIDATION_2001",
        message: "Invalid data provided to the database.",
        details: error.errors?.map(err => err.message) 
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        errorCode: "ERR_DB_DUPLICATE_2002",
        message: "This record already exists in the database."
      });
    }

    if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeConnectionRefusedError') {
      return res.status(503).json({
        success: false,
        errorCode: "ERR_DB_CONNECTION_5001",
        message: "Service temporarily unavailable due to database connection issues."
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(500).json({
        success: false,
        errorCode: "ERR_JWT_GENERATION_5002",
        message: "Failed to generate authentication token."
      });
    }

    return res.status(500).json({ 
      success: false, 
      errorCode: "ERR_INTERNAL_SERVER_5000", 
      message: "An unexpected internal server error occurred while creating the session." 
    });
  }
}
