-- Migration 009: Driver-Based Pricing Configuration, Snapshotting & Financial Observability (v2.0)
-- Eliminates hardcoded constants; implements effective-dated pricing drivers, immutable ticket snapshots,
-- and dynamic financial break-even modeling.

-- 1. Effective-dated pricing and cost drivers table
CREATE TABLE IF NOT EXISTS pricing_config (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  `key` VARCHAR(64) NOT NULL,
  value DECIMAL(12, 4) NOT NULL,
  unit VARCHAR(32) NOT NULL DEFAULT 'KES',
  category VARCHAR(32) NOT NULL DEFAULT 'pricing', -- 'pricing', 'sla', 'cost', 'financial'
  description VARCHAR(255) NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pricing_tenant_key (tenant_id, `key`),
  INDEX idx_pricing_dates (effective_from, effective_to)
);

-- 2. Audit history table for pricing driver changes
CREATE TABLE IF NOT EXISTS pricing_config_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  config_id BIGINT NOT NULL,
  `key` VARCHAR(64) NOT NULL,
  old_value DECIMAL(12, 4) NULL,
  new_value DECIMAL(12, 4) NOT NULL,
  old_effective_to DATE NULL,
  new_effective_from DATE NOT NULL,
  changed_by INT NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pch_tenant (tenant_id, `key`)
);

-- 3. Add immutable snapshot columns and working capital fields to tickets table
ALTER TABLE tickets 
  ADD COLUMN callout_fee_applied DECIMAL(10, 2) DEFAULT 2000,
  ADD COLUMN emergency_premium_applied DECIMAL(10, 2) DEFAULT 1000,
  ADD COLUMN labour_rate_applied DECIMAL(10, 2) DEFAULT 1200,
  ADD COLUMN parts_markup_pct_applied DECIMAL(6, 2) DEFAULT 20,
  ADD COLUMN travel_allowance_applied DECIMAL(10, 2) DEFAULT 500,
  ADD COLUMN pricing_config_version VARCHAR(32) DEFAULT 'v2.0',
  ADD COLUMN quote_expires_at TIMESTAMP NULL,
  ADD COLUMN parts_deposit_required_kes DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN parts_deposit_collected_kes DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN is_sla_warning INT DEFAULT 0;
