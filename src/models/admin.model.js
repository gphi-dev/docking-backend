import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Admin = sequelize.define(
  "Admin",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    tableName: "admins",
    // ADD THESE LINES TO FIX THE CRASH:
    timestamps: true,
    createdAt: "created_at", // Maps Sequelize's createdAt to your DB's created_at
    updatedAt: false,        // Tells Sequelize not to look for an updatedAt column
  }
);