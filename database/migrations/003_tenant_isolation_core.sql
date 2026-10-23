-- Migration 003: Tenant isolation on core business tables + jobs
-- Compatible with backend/scripts/migrate.js (semicolon-split, no DELIMITER)
-- Idempotent: duplicate-column errors are treated as success by the hardened runner

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

INSERT IGNORE INTO tenants (id, name, slug, plan, status) VALUES (1, 'Default Tenant', 'default', 'starter', 'active');

ALTER TABLE users ADD COLUMN tenant_id INT NULL AFTER id;
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE customers ADD COLUMN tenant_id INT NULL AFTER id;
UPDATE customers SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE leads ADD COLUMN tenant_id INT NULL AFTER id;
UPDATE leads SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE deals ADD COLUMN tenant_id INT NULL AFTER id;
UPDATE deals SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE mpesa_transactions ADD COLUMN tenant_id INT NULL AFTER id;
UPDATE mpesa_transactions SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE communications ADD COLUMN tenant_id INT NULL AFTER id;
UPDATE communications SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE tasks ADD COLUMN tenant_id INT NULL AFTER id;
UPDATE tasks SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE activity_log ADD COLUMN tenant_id INT NULL AFTER id;
UPDATE activity_log SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE jobs ADD COLUMN tenant_id INT NULL AFTER id;
