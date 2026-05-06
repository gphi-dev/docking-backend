import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Permission = sequelize.define(
  "Permission",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    access_group: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    action_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    action_key: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    endpoint: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    method: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "permissions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
