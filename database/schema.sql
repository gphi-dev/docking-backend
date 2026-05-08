-- MySQL schema for docking admin (run once per environment)
CREATE DATABASE IF NOT EXISTS docking_admin
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE docking_admin;

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name),
  UNIQUE KEY uq_roles_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  access_group VARCHAR(100) NOT NULL,
  action_name VARCHAR(150) NOT NULL,
  action_key VARCHAR(150) NOT NULL,
  endpoint VARCHAR(255) NULL,
  method VARCHAR(20) NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_action_key (action_key)
) ENGINE=InnoDB;

INSERT INTO permissions (access_group, action_name, action_key, endpoint, method, description)
VALUES
  ('Dashboard', 'View dashboard', 'dashboard.view', '/', 'GET', 'Open dashboard overview and summary cards.'),
  ('Games', 'View games', 'games.view', '/api/games', 'GET', 'List games and open game details.'),
  ('Games', 'Create games', 'games.create', '/api/games', 'POST', 'Create new game records.'),
  ('Games', 'Update games', 'games.update', '/api/games/:id', 'PUT', 'Edit game records and visual assets.'),
  ('Games', 'Delete games', 'games.delete', '/api/games/:id', 'DELETE', 'Delete game records.'),
  ('Rewards', 'View rewards', 'rewards.view', '/api/rewards', 'GET', 'List rewards and open reward details.'),
  ('Rewards', 'Create rewards', 'rewards.create', '/api/rewards', 'POST', 'Create game reward records.'),
  ('Rewards', 'Update rewards', 'rewards.update', '/api/rewards/:id', 'PUT/PATCH', 'Edit reward records and active status.'),
  ('Rewards', 'Delete rewards', 'rewards.delete', '/api/rewards/:id', 'DELETE', 'Delete game reward records.'),
  ('Admin Users', 'View admins', 'admins.view', '/api/admins', 'GET', 'List admin users and roles.'),
  ('Admin Users', 'Create admins', 'admins.create', '/api/admins', 'POST', 'Create new admin users.'),
  ('Admin Users', 'Update admins', 'admins.update', '/api/admins/:id', 'PUT', 'Update admin users and roles.'),
  ('Admin Users', 'Delete admins', 'admins.delete', '/api/admins/:id', 'DELETE', 'Delete admin users.'),
  ('Subscribers', 'View subscribers', 'subscribers.view', '/api/usermobile', 'GET', 'List subscriber mobile records.'),
  ('Subscribers', 'View subscribers by game', 'subscribers.view_by_game', '/api/usermobile/games/:gameId', 'GET', 'Open subscriber records for a selected game.'),
  ('Subscribers', 'View game subscribers', 'subscribers.view_game_subscribers', '/api/subscribers/games/:gameId', 'GET', 'Open paginated game subscriber records.'),
  ('RBAC', 'Manage RBAC', 'rbac.manage', '/api/rbac', 'PUT', 'Assign backend permissions to roles.')
ON DUPLICATE KEY UPDATE
  access_group = VALUES(access_group),
  action_name = VALUES(action_name),
  endpoint = VALUES(endpoint),
  method = VALUES(method),
  description = VALUES(description);

INSERT INTO roles (name, slug, description, is_active)
VALUES
  ('Super Admin', 'super-admin', 'Full access to all admin and RBAC features.', 1),
  ('Admin', 'admin', 'Default admin role.', 1)
ON DUPLICATE KEY UPDATE
  description = IFNULL(description, VALUES(description));

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(100) NULL,
  role VARCHAR(45) NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_username (username),
  KEY idx_admins_role_id (role_id)
) ENGINE=InnoDB;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS email VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS role VARCHAR(45) NULL,
  ADD COLUMN IF NOT EXISTS role_id BIGINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

SET @super_admin_role_id := (
  SELECT id
  FROM roles
  WHERE slug = 'super-admin'
  LIMIT 1
);

SET @admin_role_id := (
  SELECT id
  FROM roles
  WHERE slug = 'admin'
  LIMIT 1
);

UPDATE admins
SET role_id = CASE
  WHEN LOWER(TRIM(COALESCE(role, ''))) = 'admin' THEN @admin_role_id
  ELSE @super_admin_role_id
END
WHERE role_id IS NULL OR role_id = 0;

ALTER TABLE admins
  MODIFY COLUMN role_id BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active';

SET @admins_role_id_index_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'admins'
    AND INDEX_NAME = 'idx_admins_role_id'
);
SET @admins_role_id_index_sql := IF(
  @admins_role_id_index_exists = 0,
  'CREATE INDEX idx_admins_role_id ON admins (role_id)',
  'SELECT 1'
);
PREPARE admins_role_id_index_stmt FROM @admins_role_id_index_sql;
EXECUTE admins_role_id_index_stmt;
DEALLOCATE PREPARE admins_role_id_index_stmt;

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  is_allowed TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_role_permission (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO role_permissions (role_id, permission_id, is_allowed)
SELECT roles.id, permissions.id,
  CASE
    WHEN permissions.action_key IN (
      'dashboard.view',
      'games.view',
      'games.create',
      'games.update',
      'rewards.view',
      'rewards.create',
      'rewards.update',
      'subscribers.view',
      'subscribers.view_by_game',
      'subscribers.view_game_subscribers'
    ) THEN 1
    ELSE 0
  END
FROM roles
CROSS JOIN permissions
WHERE roles.slug = 'admin'
ON DUPLICATE KEY UPDATE
  is_allowed = role_permissions.is_allowed;

UPDATE role_permissions
JOIN roles ON roles.id = role_permissions.role_id
JOIN permissions ON permissions.id = role_permissions.permission_id
SET role_permissions.is_allowed = 0
WHERE roles.slug = 'admin'
  AND permissions.action_key = 'rbac.manage';

INSERT INTO role_permissions (role_id, permission_id, is_allowed)
SELECT @super_admin_role_id, permissions.id, 1
FROM permissions
WHERE @super_admin_role_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  is_allowed = VALUES(is_allowed);

CREATE TABLE IF NOT EXISTS games (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_id INT NOT NULL,
  game_url VARCHAR(255) NULL,
  gamesecretkey VARCHAR(45) NULL,
  is_landscape VARCHAR(10) NOT NULL DEFAULT 'False',
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(2048) NULL,
  background_url VARCHAR(2048) NULL,
  slug VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_games_game_id (game_id),
  UNIQUE KEY uq_games_game_url (game_url)
) ENGINE=InnoDB;

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS game_id INT NOT NULL,
  ADD COLUMN IF NOT EXISTS game_url VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS gamesecretkey VARCHAR(45) NULL,
  ADD COLUMN IF NOT EXISTS is_landscape VARCHAR(10) NOT NULL DEFAULT 'False',
  ADD COLUMN IF NOT EXISTS background_url VARCHAR(2048) NULL,
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255) NULL;

ALTER TABLE games
  MODIFY COLUMN is_landscape VARCHAR(10) NOT NULL DEFAULT 'False';

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

-- rewards.game_id references games.game_id in the existing MySQL setup.
CREATE TABLE IF NOT EXISTS rewards (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  game_id INT NOT NULL,
  picture VARCHAR(255) NULL,
  description TEXT NULL,
  prize VARCHAR(255) NOT NULL,
  holdings INT UNSIGNED NOT NULL DEFAULT 0,
  probability DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rewards_game_id (game_id),
  KEY idx_rewards_game_active (game_id, is_active),
  CONSTRAINT fk_rewards_game_id
    FOREIGN KEY (game_id) REFERENCES games (game_id)
    ON DELETE CASCADE,
  CONSTRAINT chk_rewards_holdings
    CHECK (holdings >= 0),
  CONSTRAINT chk_rewards_probability
    CHECK (probability >= 0 AND probability <= 100)
) ENGINE=InnoDB;

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
  nickname VARCHAR(55) NULL,
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
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(55) NULL,
  ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 0;
