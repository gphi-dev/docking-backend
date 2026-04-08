import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Subscriber = sequelize.define(
  "Subscriber",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    game_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    phone_number: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
  },
  {
    tableName: "subscribers",
  },
);
