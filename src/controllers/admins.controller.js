import { Admin } from "../models/index.js";
// Assuming you have a password hasher alongside verifyPassword
import { hashPassword } from "../utils/password.js"; 

export async function listAdmins(_req, res) {
  const admins = await Admin.findAll({
    attributes: ["id", "username", "created_at"],
    order: [["created_at", "ASC"]],
  });
  return res.json(admins);
}

/**
 * @controller createAdminuser
 * @description Creates a new admin user
 * @route POST /api/admins
 * @access Private (Should be protected by auth middleware in production)
 */
export async function createAdminuser(req, res) {
  const { username, password } = req.body;

  // Validate Payload
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  // Check if admin already exists
  const existingAdmin = await Admin.findOne({ where: { username } });
  if (existingAdmin) {
    return res.status(409).json({ message: "Username is already taken." });
  }

  // Hash Password
  const password_hash = await hashPassword(password);

  // Create Admin Record
  const newAdmin = await Admin.create({
    username,
    password_hash,
  });

  // Send Response (Strip out the password hash!)
  return res.status(201).json({
    id: newAdmin.id,
    username: newAdmin.username,
    created_at: newAdmin.createdAt, 
  });
}

/**
 * @controller updateAdminuser
 * @description Updates an existing admin user
 * @route PUT /api/admins/:id
 * @access Private
 */
export async function updateAdminuser(req, res) {
  const { id } = req.params;
  const { username, password } = req.body;

  // Find the existing admin
  const adminRecord = await Admin.findByPk(id);
  if (!adminRecord) {
    return res.status(404).json({ message: "Admin user not found." });
  }

  // If the username is changing, make sure it's not taken by someone else
  if (username && username !== adminRecord.username) {
    const existingAdmin = await Admin.findOne({ where: { username } });
    if (existingAdmin) {
      return res.status(409).json({ message: "Username is already taken." });
    }
    adminRecord.username = username;
  }

  // Update password only if the frontend sent a new one
  if (password) {
    adminRecord.password_hash = await hashPassword(password);
  }

  // Save changes to the database
  await adminRecord.save();

  // Return updated data
  return res.status(200).json({
    id: adminRecord.id,
    username: adminRecord.username,
    created_at: adminRecord.created_at || adminRecord.createdAt,
  });
}