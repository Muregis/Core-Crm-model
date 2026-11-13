-- Migration 008: Add formal technician and ops_coordinator roles to users table
-- Enables strict field-service RBAC: technicians are isolated from sales pipelines, M-Pesa vault, and gross margins.

ALTER TABLE users 
MODIFY COLUMN role ENUM('admin', 'manager', 'ops_coordinator', 'technician', 'sales_rep') NOT NULL DEFAULT 'sales_rep';
