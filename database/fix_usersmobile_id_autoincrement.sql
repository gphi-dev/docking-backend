-- Fixes: ER_NO_DEFAULT_FOR_FIELD / Field 'id' doesn't have a default value
-- Run against the same database as DB_NAME (e.g. main).
-- Safe to run once if usersmobile.id exists but is not AUTO_INCREMENT.

ALTER TABLE usersmobile
  MODIFY COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT;
