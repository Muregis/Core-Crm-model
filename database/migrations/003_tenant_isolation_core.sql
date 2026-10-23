-- Migration 003: Tenant isolation on core business tables + jobs
-- Safe to re-run patterns for MySQL 8+
-- Aligns production MySQL with multi-tenant SQLite fallback and Product Document Phase 1

USE kenya_crm;

CREATE TABLE IF NOT EXISTS tenants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    domain VARCHAR(255) NULL,
    kra_pin VARCHAR(50) NULL,
    plan VARCHAR(50) DEFAULT 'starter',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tenants (id, name, slug, plan, status)
SELECT 1, 'Default Tenant', 'default', 'starter', 'active'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = 1);

DROP PROCEDURE IF EXISTS add_column_if_missing;
DELIMITER //
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition VARCHAR(512)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL add_column_if_missing('users', 'tenant_id', 'INT NULL AFTER id');
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;

CALL add_column_if_missing('customers', 'tenant_id', 'INT NULL AFTER id');
UPDATE customers SET tenant_id = 1 WHERE tenant_id IS NULL;

CALL add_column_if_missing('leads', 'tenant_id', 'INT NULL AFTER id');
UPDATE leads SET tenant_id = 1 WHERE tenant_id IS NULL;

CALL add_column_if_missing('deals', 'tenant_id', 'INT NULL AFTER id');
UPDATE deals SET tenant_id = 1 WHERE tenant_id IS NULL;

CALL add_column_if_missing('mpesa_transactions', 'tenant_id', 'INT NULL AFTER id');
UPDATE mpesa_transactions SET tenant_id = 1 WHERE tenant_id IS NULL;

CALL add_column_if_missing('communications', 'tenant_id', 'INT NULL AFTER id');
UPDATE communications SET tenant_id = 1 WHERE tenant_id IS NULL;

CALL add_column_if_missing('tasks', 'tenant_id', 'INT NULL AFTER id');
UPDATE tasks SET tenant_id = 1 WHERE tenant_id IS NULL;

CALL add_column_if_missing('activity_log', 'tenant_id', 'INT NULL AFTER id');
UPDATE activity_log SET tenant_id = 1 WHERE tenant_id IS NULL;

CALL add_column_if_missing('jobs', 'tenant_id', 'INT NULL AFTER id');

DROP PROCEDURE IF EXISTS add_column_if_missing;
