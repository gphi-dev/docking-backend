import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Game = sequelize.define(
  "Game",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    game_id: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    gamesecretkey: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING(2048),
      allowNull: true,
    },
  },
  {
    tableName: "games",
  },
);
