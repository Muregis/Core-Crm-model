-- Kenya CRM MySQL Setup Script
-- Run this in MySQL Workbench to set up the database

-- Create database
CREATE DATABASE IF NOT EXISTS kenya_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (if not exists)
CREATE USER IF NOT EXISTS 'crm_user'@'localhost' IDENTIFIED BY 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON kenya_crm.* TO 'crm_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Switch to the new database
USE kenya_crm;

-- Show confirmation
SELECT 'Database kenya_crm created successfully' as status;
SELECT 'User crm_user created with privileges' as status;
