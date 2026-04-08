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
  },
);
