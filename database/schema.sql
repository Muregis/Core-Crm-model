-- Kenya CRM Database Schema
-- MySQL 8.0+ compatible

-- Create database
CREATE DATABASE IF NOT EXISTS kenya_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kenya_crm;

-- Users table for authentication and role management
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('admin', 'manager', 'sales_rep') NOT NULL DEFAULT 'sales_rep',
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_active (is_active)
);

-- Kenyan counties table
CREATE TABLE counties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);

-- Sub-counties table
CREATE TABLE sub_counties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    county_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (county_id) REFERENCES counties(id) ON DELETE CASCADE,
    INDEX idx_county (county_id),
    INDEX idx_name (name)
);

-- Business categories
CREATE TABLE business_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);

-- Customers table
CREATE TABLE customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    company_name VARCHAR(255),
    business_category_id INT,
    county_id INT,
    sub_county_id INT,
    physical_address TEXT,
    customer_type ENUM('individual', 'business', 'sacco', 'sme') DEFAULT 'individual',
    status ENUM('active', 'inactive', 'prospect') DEFAULT 'prospect',
    notes TEXT,
    assigned_sales_rep_id INT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_category_id) REFERENCES business_categories(id),
    FOREIGN KEY (county_id) REFERENCES counties(id),
    FOREIGN KEY (sub_county_id) REFERENCES sub_counties(id),
    FOREIGN KEY (assigned_sales_rep_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_name (first_name, last_name),
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_company (company_name),
    INDEX idx_status (status),
    INDEX idx_type (customer_type),
    INDEX idx_sales_rep (assigned_sales_rep_id),
    INDEX idx_county (county_id),
    INDEX idx_created_date (DATE(created_at))
);

-- Customer tags for segmentation
CREATE TABLE customer_tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#007bff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);

-- Customer tag relationships
CREATE TABLE customer_tag_relations (
    customer_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (customer_id, tag_id),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES customer_tags(id) ON DELETE CASCADE
);

-- Leads table
CREATE TABLE leads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    company_name VARCHAR(255),
    source ENUM('website', 'referral', 'cold_call', 'social_media', 'email', 'walk_in', 'other') NOT NULL,
    status ENUM('new', 'contacted', 'qualified', 'converted', 'lost') DEFAULT 'new',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    score INT DEFAULT 0,
    estimated_value DECIMAL(12, 2),
    county_id INT,
    business_category_id INT,
    assigned_sales_rep_id INT,
    notes TEXT,
    created_by INT NOT NULL,
    converted_to_customer_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (county_id) REFERENCES counties(id),
    FOREIGN KEY (business_category_id) REFERENCES business_categories(id),
    FOREIGN KEY (assigned_sales_rep_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (converted_to_customer_id) REFERENCES customers(id),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_score (score),
    INDEX idx_sales_rep (assigned_sales_rep_id),
    INDEX idx_source (source),
    INDEX idx_created_date (DATE(created_at))
);

-- Deal pipeline stages
CREATE TABLE deal_stages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    order_index INT NOT NULL,
    probability INT DEFAULT 0,
    color VARCHAR(7) DEFAULT '#007bff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order (order_index)
);

-- Deals/Sales pipeline
CREATE TABLE deals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    customer_id INT NOT NULL,
    lead_id INT,
    deal_stage_id INT NOT NULL,
    assigned_sales_rep_id INT NOT NULL,
    value DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    expected_close_date DATE,
    actual_close_date DATE,
    status ENUM('active', 'won', 'lost') DEFAULT 'active',
    lost_reason TEXT,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (deal_stage_id) REFERENCES deal_stages(id),
    FOREIGN KEY (assigned_sales_rep_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_customer (customer_id),
    INDEX idx_stage (deal_stage_id),
    INDEX idx_sales_rep (assigned_sales_rep_id),
    INDEX idx_status (status),
    INDEX idx_expected_close (expected_close_date),
    INDEX idx_created_date (DATE(created_at))
);

-- M-Pesa transactions
CREATE TABLE mpesa_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    deal_id INT,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    phone_number VARCHAR(20) NOT NULL,
    transaction_type ENUM('payment', 'deposit', 'withdrawal', 'transfer') DEFAULT 'payment',
    status ENUM('pending', 'completed', 'failed', 'reversed') DEFAULT 'pending',
    merchant_request_id VARCHAR(100),
    checkout_request_id VARCHAR(100),
    receipt_number VARCHAR(100),
    transaction_date DATETIME,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (deal_id) REFERENCES deals(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_customer (customer_id),
    INDEX idx_deal (deal_id),
    INDEX idx_status (status),
    INDEX idx_transaction_date (transaction_date),
    INDEX idx_created_date (DATE(created_at))
);

-- Communications table (calls, emails, SMS, WhatsApp)
CREATE TABLE communications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    lead_id INT,
    deal_id INT,
    type ENUM('call', 'email', 'sms', 'whatsapp', 'meeting', 'note') NOT NULL,
    direction ENUM('inbound', 'outbound') DEFAULT 'outbound',
    subject VARCHAR(255),
    content TEXT NOT NULL,
    duration_minutes INT,
    status ENUM('completed', 'scheduled', 'cancelled', 'missed') DEFAULT 'completed',
    scheduled_date DATETIME,
    completed_date DATETIME,
    next_follow_up DATETIME,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (deal_id) REFERENCES deals(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_customer (customer_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_scheduled (scheduled_date),
    INDEX idx_follow_up (next_follow_up),
    INDEX idx_created_date (DATE(created_at))
);

-- Tasks and follow-ups
CREATE TABLE tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    customer_id INT,
    lead_id INT,
    deal_id INT,
    assigned_to INT NOT NULL,
    created_by INT NOT NULL,
    status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    due_date DATETIME,
    completed_date DATETIME,
    task_type ENUM('call', 'email', 'meeting', 'follow_up', 'demo', 'proposal', 'other') DEFAULT 'follow_up',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (deal_id) REFERENCES deals(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_assigned (assigned_to),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_due_date (due_date),
    INDEX idx_type (task_type),
    INDEX idx_created_date (DATE(created_at))
);

-- Attachments for customers, leads, deals
CREATE TABLE attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    customer_id INT,
    lead_id INT,
    deal_id INT,
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (deal_id) REFERENCES deals(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    INDEX idx_customer (customer_id),
    INDEX idx_lead (lead_id),
    INDEX idx_deal (deal_id),
    INDEX idx_uploaded (uploaded_by),
    INDEX idx_created_date (DATE(created_at))
);

-- Activity log for audit trail
CREATE TABLE activity_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type ENUM('customer', 'lead', 'deal', 'task', 'communication', 'user') NOT NULL,
    entity_id INT NOT NULL,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user (user_id),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_action (action),
    INDEX idx_created_date (DATE(created_at))
);

-- System settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (setting_key)
);

-- Create indexes for performance optimization
CREATE INDEX idx_customers_full_name ON customers(first_name, last_name);
CREATE INDEX idx_deals_value ON deals(value);
CREATE INDEX idx_mpesa_amount ON mpesa_transactions(amount);
CREATE INDEX idx_tasks_due_soon ON tasks(due_date, status) WHERE status != 'completed';

-- Create views for common queries
CREATE VIEW customer_summary AS
SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.company_name,
    c.status,
    c.customer_type,
    c.county_id,
    co.name as county_name,
    bc.name as business_category,
    CONCAT(u.first_name, ' ', u.last_name) as sales_rep_name,
    COUNT(DISTINCT d.id) as deal_count,
    COALESCE(SUM(d.value), 0) as total_deal_value,
    COUNT(DISTINCT mt.id) as transaction_count,
    COALESCE(SUM(mt.amount), 0) as total_paid,
    c.created_at
FROM customers c
LEFT JOIN counties co ON c.county_id = co.id
LEFT JOIN business_categories bc ON c.business_category_id = bc.id
LEFT JOIN users u ON c.assigned_sales_rep_id = u.id
LEFT JOIN deals d ON c.id = d.customer_id AND d.status = 'won'
LEFT JOIN mpesa_transactions mt ON c.id = mt.customer_id AND mt.status = 'completed'
GROUP BY c.id;

CREATE VIEW sales_performance AS
SELECT 
    u.id as user_id,
    CONCAT(u.first_name, ' ', u.last_name) as sales_rep_name,
    u.email,
    COUNT(DISTINCT c.id) as customer_count,
    COUNT(DISTINCT d.id) as deal_count,
    COUNT(DISTINCT CASE WHEN d.status = 'won' THEN d.id END) as won_deals,
    COALESCE(SUM(CASE WHEN d.status = 'won' THEN d.value ELSE 0 END), 0) as total_revenue,
    COALESCE(AVG(CASE WHEN d.status = 'won' THEN d.value ELSE NULL END), 0) as avg_deal_value,
    COUNT(DISTINCT l.id) as lead_count,
    COUNT(DISTINCT CASE WHEN l.status = 'converted' THEN l.id END) as converted_leads
FROM users u
LEFT JOIN customers c ON u.id = c.assigned_sales_rep_id
LEFT JOIN deals d ON u.id = d.assigned_sales_rep_id
LEFT JOIN leads l ON u.id = l.assigned_sales_rep_id
WHERE u.role IN ('sales_rep', 'manager', 'admin')
GROUP BY u.id;
