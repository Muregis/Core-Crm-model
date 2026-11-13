-- Migration 007: Sawa Repairs Client Experience Layer & Self-Service Portal
-- Adds client-facing tracking tokens, approval tokens, emergency containment limits,
-- Property Maintenance Passport tokens, and preventive inspection packages.

ALTER TABLE tickets ADD COLUMN tracking_token VARCHAR(64) NULL;
ALTER TABLE tickets ADD COLUMN approval_token VARCHAR(64) NULL;
ALTER TABLE tickets ADD COLUMN emergency_auto_approve_limit_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE tickets ADD COLUMN first_time_fix BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tickets ADD COLUMN first_response_minutes INT NULL;
ALTER TABLE tickets ADD COLUMN on_site_minutes INT NULL;

ALTER TABLE properties ADD COLUMN passport_token VARCHAR(64) NULL;
ALTER TABLE properties ADD COLUMN default_approval_threshold_kes DECIMAL(12,2) NOT NULL DEFAULT 5000.00;
ALTER TABLE properties ADD COLUMN emergency_auto_containment_limit_kes DECIMAL(12,2) NOT NULL DEFAULT 8000.00;
ALTER TABLE properties ADD COLUMN airbnb_managed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN last_preventive_inspection_at DATETIME NULL;
ALTER TABLE properties ADD COLUMN next_preventive_inspection_due DATETIME NULL;

CREATE TABLE IF NOT EXISTS preventive_inspections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    property_id INT NOT NULL,
    package_type ENUM('airbnb_guest_ready', 'pre_rains_leak_defense', 'quarterly_systems_check') NOT NULL,
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    scheduled_date DATE NOT NULL,
    completed_at DATETIME NULL,
    inspector_user_id INT NULL,
    checklist_results TEXT NULL,
    overall_condition ENUM('excellent', 'good', 'needs_attention', 'critical') DEFAULT 'good',
    recommended_actions TEXT NULL,
    cost_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_preventive_tenant (tenant_id),
    KEY idx_preventive_property (tenant_id, property_id),
    CONSTRAINT fk_preventive_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_preventive_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT fk_preventive_inspector FOREIGN KEY (inspector_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
