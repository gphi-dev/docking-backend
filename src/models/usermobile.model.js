import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Usermobile = sequelize.define(
  "Usermobile",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    phone: {
      type: DataTypes.STRING(20), // Handles both numbers and strings like 'dummy_num_001'
      allowNull: false,
    },
    game_id: {
      type: DataTypes.STRING(50), // Handles both numbers and text like 'MarioBro'
      allowNull: false,
    },
    is_verified: {
      type: DataTypes.TINYINT(1),
      defaultValue: 0,
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    otp: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    otp_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "usersmobile",
    timestamps: true, // Sequelize automatically manages created_at and updated_at
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);