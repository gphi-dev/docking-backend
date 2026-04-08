import { Admin } from "../models/index.js";

export async function listAdmins(_req, res) {
  const admins = await Admin.findAll({
    attributes: ["id", "username", "created_at"],
    order: [["created_at", "ASC"]],
  });
  return res.json(admins);
}
