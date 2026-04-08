import bcrypt from "bcryptjs";

const saltRounds = 12;

export async function hashPassword(plainTextPassword) {
  return bcrypt.hash(plainTextPassword, saltRounds);
}

export async function verifyPassword(plainTextPassword, passwordHash) {
  return bcrypt.compare(plainTextPassword, passwordHash);
}
