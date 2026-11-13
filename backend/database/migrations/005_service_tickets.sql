-- Migration 005: Service Tickets and Properties (Field Service / Sawa Repairs Module)
-- Multi-tenant property maintenance lifecycle with technician scheduling, landlord approvals, and SLA tracking

CREATE TABLE IF NOT EXISTS properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    customer_id INT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT NULL,
    unit_count INT NOT NULL DEFAULT 1,
    notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_properties_tenant (tenant_id),
    KEY idx_properties_tenant_customer (tenant_id, customer_id),
    CONSTRAINT fk_properties_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_properties_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_properties_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    ticket_number VARCHAR(64) NOT NULL,
    property_id INT NULL,
    customer_id INT NULL,
    reported_by VARCHAR(255) NULL,
    category ENUM('plumbing','electrical','roofing','painting','general','solar','other') NOT NULL DEFAULT 'general',
    priority ENUM('emergency','standard','planned') NOT NULL DEFAULT 'standard',
    status ENUM('reported','triaged','scheduled','in_progress','awaiting_parts','resolved','verified','closed','reopened') NOT NULL DEFAULT 'reported',
    description TEXT NOT NULL,
    assigned_technician_id INT NULL,
    scheduled_at DATETIME NULL,
    started_at DATETIME NULL,
    resolved_at DATETIME NULL,
    closed_at DATETIME NULL,
    landlord_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    approval_threshold_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    approved_at DATETIME NULL,
    approved_by INT NULL,
    labour_hours DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    parts_cost_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_cost_kes DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    warranty_until DATE NULL,
    notes TEXT NULL,
    internal_notes TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tickets_tenant_number (tenant_id, ticket_number),
    KEY idx_tickets_tenant_status (tenant_id, status),
    KEY idx_tickets_tenant_priority (tenant_id, priority),
    KEY idx_tickets_tenant_property (tenant_id, property_id),
    KEY idx_tickets_tenant_customer (tenant_id, customer_id),
    KEY idx_tickets_tenant_technician (tenant_id, assigned_technician_id),
    KEY idx_tickets_created_at (created_at),
    CONSTRAINT fk_tickets_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_tickets_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
    CONSTRAINT fk_tickets_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_tickets_technician FOREIGN KEY (assigned_technician_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_tickets_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_tickets_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    ticket_id INT NOT NULL,
    from_status VARCHAR(32) NULL,
    to_status VARCHAR(32) NOT NULL,
    changed_by INT NULL,
    note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_tsh_tenant_ticket (tenant_id, ticket_id),
    CONSTRAINT fk_tsh_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_tsh_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_tsh_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE attachments ADD COLUMN ticket_id INT NULL;

ALTER TABLE tasks ADD COLUMN ticket_id INT NULL;
