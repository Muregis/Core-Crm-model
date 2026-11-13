-- Migration 006: Sawa Repairs Company Plan Metrics & Sawa Care Contracts
-- Unit economics (call-out fees, travel costs, parts margin, gross margin),
-- SLA response tracking, warranty claim flags, and Sawa Care managed contracts.

ALTER TABLE tickets ADD COLUMN callout_fee_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE tickets ADD COLUMN callout_fee_waived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tickets ADD COLUMN emergency_premium_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE tickets ADD COLUMN travel_cost_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE tickets ADD COLUMN labour_cost_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE tickets ADD COLUMN labour_billed_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE tickets ADD COLUMN parts_markup_percentage DECIMAL(5,2) NOT NULL DEFAULT 20.00;
ALTER TABLE tickets ADD COLUMN parts_billed_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE tickets ADD COLUMN invoice_amount_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE tickets ADD COLUMN gross_margin_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE tickets ADD COLUMN margin_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00;
ALTER TABLE tickets ADD COLUMN sla_response_due_at DATETIME NULL;
ALTER TABLE tickets ADD COLUMN responded_at DATETIME NULL;
ALTER TABLE tickets ADD COLUMN is_sla_breached BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tickets ADD COLUMN is_warranty_claim BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS sawa_care_contracts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    customer_id INT NOT NULL,
    tier ENUM('home','portfolio','corporate') NOT NULL DEFAULT 'home',
    status ENUM('prospect','active','paused','cancelled') NOT NULL DEFAULT 'prospect',
    start_date DATE NULL,
    end_date DATE NULL,
    monthly_retainer_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    included_properties_count INT NOT NULL DEFAULT 1,
    priority_sla_tier VARCHAR(50) NOT NULL DEFAULT 'standard',
    quarterly_inspection_scheduled DATE NULL,
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_sawa_care_tenant (tenant_id),
    KEY idx_sawa_care_customer (tenant_id, customer_id),
    CONSTRAINT fk_sawa_care_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_sawa_care_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_sawa_care_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
