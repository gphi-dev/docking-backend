import { sequelize } from "../config/database.js";
import { Admin, Role } from "../models/index.js";
import { env } from "../config/env.js";
import { hashPassword } from "../utils/password.js";

async function seedDefaultAdminIfEmpty() {
  await sequelize.authenticate();

  try {
    const [superAdminRole] = await Role.findOrCreate({
      where: { slug: "super-admin" },
      defaults: {
        name: "Super Admin",
        description: "Full access to all admin and RBAC features.",
        is_active: true,
      },
    });

    const existingAdminCount = await Admin.count();
    if (existingAdminCount > 0) {
      console.log("Admins already exist; skipping seed.");
      return;
    }

    const passwordHash = await hashPassword(env.seedAdminPassword);
    await Admin.create({
      username: env.seedAdminUsername,
      role: superAdminRole.name,
      role_id: superAdminRole.id,
      status: "active",
      password_hash: passwordHash,
    });

    console.log(`Seeded admin user "${env.seedAdminUsername}".`);
  } finally {
    await sequelize.close();
  }
}

seedDefaultAdminIfEmpty().catch(async (error) => {
  console.error("Failed to seed admin:", error);
  try {
    await sequelize.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
