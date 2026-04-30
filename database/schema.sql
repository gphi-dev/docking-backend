-- MySQL schema for docking admin (run once per environment)
CREATE DATABASE IF NOT EXISTS docking_admin
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE docking_admin;

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_username (username)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS games (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_id VARCHAR(45) NULL,
  game_url VARCHAR(255) NULL,
  gamesecretkey VARCHAR(45) NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(2048) NULL,
  background_url VARCHAR(2048) NULL,
  slug VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_games_game_url (game_url)
) ENGINE=InnoDB;

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS game_id VARCHAR(45) NULL,
  ADD COLUMN IF NOT EXISTS game_url VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS gamesecretkey VARCHAR(45) NULL,
  ADD COLUMN IF NOT EXISTS background_url VARCHAR(2048) NULL,
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255) NULL;

SET @games_game_url_index_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'games'
    AND COLUMN_NAME = 'game_url'
    AND NON_UNIQUE = 0
);
SET @games_game_url_index_sql := IF(
  @games_game_url_index_exists = 0,
  'CREATE UNIQUE INDEX uq_games_game_url ON games (game_url)',
  'SELECT 1'
);
PREPARE games_game_url_index_stmt FROM @games_game_url_index_sql;
EXECUTE games_game_url_index_stmt;
DEALLOCATE PREPARE games_game_url_index_stmt;

CREATE TABLE IF NOT EXISTS subscribers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_id INT UNSIGNED NOT NULL,
  phone_number VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_subscribers_game_id (game_id),
  KEY idx_subscribers_created_at (created_at),
  CONSTRAINT fk_subscribers_game
    FOREIGN KEY (game_id) REFERENCES games (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usersmobile (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone VARCHAR(20) NOT NULL,
  game_id VARCHAR(50) NOT NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  verified_at DATETIME NULL,
  otp VARCHAR(10) NULL,
  otp_expires_at DATETIME NULL,
  points INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

ALTER TABLE usersmobile
  ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 0;
