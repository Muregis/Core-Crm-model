-- Migration 002: Multi-Tenant SaaS Tables (Credentials, Token Revocation, Refresh Tokens)
-- Compatible with MySQL 8.0+

USE kenya_crm;

-- Add slug and SaaS plan to tenants if not already present
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE AFTER name,
  ADD COLUMN IF NOT EXISTS kra_pin VARCHAR(50) NULL AFTER domain,
  ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'starter' AFTER kra_pin;

-- Tenant Credentials (M-Pesa Daraja and external provider encrypted vault)
CREATE TABLE IF NOT EXISTS tenant_credentials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    provider VARCHAR(50) NOT NULL,
    shortcode VARCHAR(50) NOT NULL,
    key_type VARCHAR(50) DEFAULT 'paybill',
    consumer_key_encrypted TEXT NOT NULL,
    consumer_secret_encrypted TEXT NOT NULL,
    passkey_encrypted TEXT NULL,
    iv VARCHAR(64) NOT NULL,
    is_sandbox BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_provider_shortcode (provider, shortcode),
    INDEX idx_tenant_provider (tenant_id, provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh Tokens for Token Rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token_hash (token_hash),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Token Blocklist for Instantaneous Revocation
CREATE TABLE IF NOT EXISTS token_blocklist (
    id INT PRIMARY KEY AUTO_INCREMENT,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_block_hash (token_hash),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
