-- Kenya CRM Seed Data
-- Sample data for testing and demonstration

USE kenya_crm;

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active) VALUES
('admin@kenyacrm.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'Admin', 'User', '+254712345678', 'admin', TRUE),
('john.sales@kenyacrm.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'John', 'Sales', '+254712345679', 'sales_rep', TRUE),
('mary.manager@kenyacrm.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'Mary', 'Manager', '+254712345680', 'manager', TRUE),
('paul.rep@kenyacrm.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjQjQjQjQjQjQjQjQ', 'Paul', 'Rep', '+254712345681', 'sales_rep', TRUE);

-- Insert Kenyan counties
INSERT INTO counties (name, code) VALUES
('Nairobi', 'NBI'), ('Mombasa', 'MBA'), ('Kisumu', 'KSM'), ('Nakuru', 'NKU'),
('Eldoret', 'ELD'), ('Thika', 'THK'), ('Kitale', 'KIT'), ('Garissa', 'GRS'),
('Kakamega', 'KKA'), ('Nyeri', 'NYR'), ('Embu', 'EBU'), ('Meru', 'MRU'),
('Bungoma', 'BGM'), ('Machakos', 'MKS'), ('Kajiado', 'KJD'), ('Kericho', 'KRC'),
('Bomet', 'BMT'), ('Uasin Gishu', 'UGS'), ('Nandi', 'NDI'), ('Trans Nzoia', 'TNZ'),
('Turkana', 'TKN'), ('West Pokot', 'WPK'), ('Samburu', 'SBR'), ('Laikipia', 'LPQ'),
('Isiolo', 'ISL'), ('Marsabit', 'MSB'), ('Wajir', 'WJR'), ('Mandera', 'MDR'),
('Tana River', 'TRV'), ('Lamu', 'LMU'), ('Taita Taveta', 'TTT'), ('Kilifi', 'KLF'),
('Kwale', 'KWL'), ('Busia', 'BSA'), ('Siaya', 'SAY'), ('Homa Bay', 'HMB'),
('Migori', 'MGR'), ('Kisii', 'KSI'), ('Nyamira', 'NMR'), ('Vihiga', 'VHG'),
('Narok', 'NRK'), ('Baringo', 'BRG'), ('Elgeyo Marakwet', 'EMK'), ('Pokot', 'PKT'),
('Samburu North', 'SBN'), ('Samburu East', 'SBE'), ('Samburu West', 'SBW');

-- Insert sub-counties (sample for Nairobi)
INSERT INTO sub_counties (name, county_id) VALUES
('Westlands', 1), ('Dagoretti', 1), ('Langata', 1), ('Kasarani', 1),
('Embakasi', 1), ('Kamukunji', 1), ('Starehe', 1), ('Mathare', 1),
('Roysambu', 1), ('Kibera', 1);

-- Insert business categories
INSERT INTO business_categories (name, description) VALUES
('Agriculture', 'Farming and agricultural services'),
('Technology', 'IT services, software development, tech startups'),
('Manufacturing', 'Production and manufacturing companies'),
('Retail', 'Retail shops and supermarkets'),
('Hospitality', 'Hotels, restaurants, and tourism'),
('Healthcare', 'Hospitals, clinics, and medical services'),
('Education', 'Schools, colleges, and training institutions'),
('Construction', 'Building and construction services'),
('Transportation', 'Logistics and transport services'),
('Financial Services', 'Banks, SACCOs, and financial institutions'),
('Professional Services', 'Legal, accounting, and consulting services'),
('Media & Entertainment', 'Media companies and entertainment venues'),
('Real Estate', 'Property management and real estate'),
('Energy', 'Energy and utility services'),
('Telecommunications', 'Telecom and communication services'),
('Government', 'Government institutions and parastatals'),
('NGO', 'Non-governmental organizations'),
('Other', 'Other business categories');

-- Insert customer tags
INSERT INTO customer_tags (name, color) VALUES
('VIP', '#ff6b6b'), ('Hot Lead', '#feca57'), ('Cold Lead', '#48dbfb'),
('Repeat Customer', '#1dd1a1'), ('High Value', '#ff9ff3'), ('New', '#54a0ff'),
('Inactive', '#c8d6e5'), ('SACCO Member', '#00d2d3'), ('SME', '#ff6348'),
('Corporate', '#5f27cd'), ('Individual', '#00b894'), ('Government', '#6c5ce7');

-- Insert deal stages
INSERT INTO deal_stages (name, order_index, probability, color) VALUES
('Prospecting', 1, 10, '#e74c3c'),
('Qualification', 2, 25, '#e67e22'),
('Needs Analysis', 3, 40, '#f39c12'),
('Value Proposition', 4, 50, '#f1c40f'),
('Proposal', 5, 60, '#2ecc71'),
('Negotiation', 6, 75, '#3498db'),
('Closing', 7, 90, '#9b59b6'),
('Won', 8, 100, '#27ae60'),
('Lost', 9, 0, '#95a5a6');

-- Insert sample customers
INSERT INTO customers (first_name, last_name, email, phone, company_name, business_category_id, county_id, sub_county_id, physical_address, customer_type, status, assigned_sales_rep_id, created_by) VALUES
('James', 'Mwangi', 'james.mwangi@email.com', '+254712345690', 'Mwangi Enterprises', 2, 1, 1, 'Westlands, Nairobi', 'business', 'active', 2, 1),
('Grace', 'Wanjiru', 'grace.wanjiru@email.com', '+254712345691', 'Wanjiru Farm Supplies', 1, 2, NULL, 'Mombasa Old Town', 'business', 'active', 2, 1),
('Peter', 'Karanja', 'peter.karanja@email.com', '+254712345692', 'Karanja Tech Solutions', 2, 1, 2, 'Dagoretti, Nairobi', 'sme', 'active', 4, 1),
('Sarah', 'Ochieng', 'sarah.ochieng@email.com', '+254712345693', NULL, NULL, 3, NULL, 'Kisumu Town', 'individual', 'prospect', 4, 1),
('David', 'Kiprop', 'david.kiprop@email.com', '+254712345694', 'Kiprop Logistics', 9, 4, NULL, 'Nakuru Town', 'business', 'active', 2, 1),
('Esther', 'Njoroge', 'esther.njoroge@email.com', '+254712345695', 'Njoroge Restaurant', 5, 1, 3, 'Langata, Nairobi', 'sme', 'active', 4, 1),
('Michael', 'Odhiambo', 'michael.odhiambo@email.com', '+254712345696', NULL, NULL, 6, 3, NULL, 'Kisumu', 'individual', 'active', 2, 1),
('Lucy', 'Kamau', 'lucy.kamau@email.com', '+254712345697', 'Kamau Construction', 7, 1, 4, 'Kasarani, Nairobi', 'business', 'prospect', 4, 1),
('Samuel', 'Mutiso', 'samuel.mutiso@email.com', '+254712345698', 'Mutiso Transport', 9, 14, NULL, 'Machakos', 'sme', 'active', 2, 1),
('Rebecca', 'Chebet', 'rebecca.chebet@email.com', '+254712345699', 'Chebet Farm', 1, 13, NULL, 'Kericho', 'business', 'active', 4, 1);

-- Insert sample leads
INSERT INTO leads (first_name, last_name, email, phone, company_name, source, status, priority, score, estimated_value, county_id, business_category_id, assigned_sales_rep_id, notes, created_by) VALUES
('John', 'Kinyua', 'john.kinyua@email.com', '+254712345700', 'Kinyua Hardware', 'website', 'new', 'medium', 30, 150000.00, 1, 3, 2, 'Interested in CRM system for hardware business', 1),
('Alice', 'Wanjala', 'alice.wanjala@email.com', '+254712345701', NULL, 'referral', 'contacted', 'high', 60, 75000.00, 5, 2, 4, 'Referred by existing customer', 1),
('Robert', 'Thuo', 'robert.thuo@email.com', '+254712345702', 'Thuo Manufacturing', 'cold_call', 'qualified', 'medium', 45, 200000.00, 4, 3, 2, 'Manufacturing company with 50 employees', 1),
('Miriam', 'Achieng', 'miriam.achieng@email.com', '+254712345703', NULL, 'social_media', 'new', 'low', 20, 25000.00, 3, 5, 4, 'Small restaurant owner', 1),
('Joseph', 'Muriuki', 'joseph.muriuki@email.com', '+254712345704', 'Muriuki Farm', 'email', 'contacted', 'medium', 35, 100000.00, 13, 1, 2, 'Large scale farmer', 1);

-- Insert sample deals
INSERT INTO deals (title, customer_id, deal_stage_id, assigned_sales_rep_id, value, expected_close_date, status, notes, created_by) VALUES
('CRM System Implementation', 1, 3, 2, 250000.00, '2024-04-15', 'active', 'Full CRM implementation for Mwangi Enterprises', 1),
('Website Development', 3, 4, 4, 150000.00, '2024-03-30', 'active', 'E-commerce website for Karanja Tech', 1),
('Supply Chain Software', 5, 5, 2, 300000.00, '2024-04-20', 'active', 'Supply chain management system', 1),
('POS System', 6, 6, 4, 80000.00, '2024-03-25', 'won', 'Restaurant POS system installation', 1),
('Mobile App Development', 8, 2, 4, 200000.00, '2024-05-01', 'active', 'Customer mobile application', 1);

-- Insert sample M-Pesa transactions
INSERT INTO mpesa_transactions (transaction_id, customer_id, deal_id, amount, phone_number, transaction_type, status, receipt_number, transaction_date, created_by) VALUES
('SAF202403120001', 1, 1, 50000.00, '+254712345690', 'payment', 'completed', 'QWE123ABC', '2024-03-12 10:30:00', 1),
('SAF202403110002', 3, 2, 75000.00, '+254712345692', 'payment', 'completed', 'RTY456DEF', '2024-03-11 14:15:00', 1),
('SAF202403100003', 5, 3, 100000.00, '+254712345694', 'payment', 'completed', 'UIO789GHI', '2024-03-10 09:45:00', 1),
('SAF202403090004', 6, 4, 80000.00, '+254712345695', 'payment', 'completed', 'JKL012MNO', '2024-03-09 16:20:00', 1),
('SAF202403080005', 1, NULL, 25000.00, '+254712345690', 'payment', 'completed', 'PQR345STU', '2024-03-08 11:10:00', 1);

-- Insert sample communications
INSERT INTO communications (customer_id, type, direction, subject, content, status, created_by) VALUES
(1, 'call', 'outbound', 'Initial CRM Demo', 'Conducted initial demo of CRM system features', 'completed', 2),
(1, 'email', 'outbound', 'CRM Proposal', 'Sent detailed proposal with pricing', 'completed', 2),
(3, 'meeting', 'outbound', 'Requirements Gathering', 'Meeting to discuss website requirements', 'completed', 4),
(5, 'call', 'inbound', 'Supply Chain Inquiry', 'Customer called about supply chain software', 'completed', 2),
(6, 'whatsapp', 'outbound', 'POS System Info', 'Sent POS system information via WhatsApp', 'completed', 4);

-- Insert sample tasks
INSERT INTO tasks (title, description, customer_id, assigned_to, created_by, status, priority, due_date, task_type) VALUES
('Follow up on CRM proposal', 'Follow up with customer regarding CRM proposal', 1, 2, 1, 'pending', 'medium', '2024-03-15 10:00:00', 'follow_up'),
('Prepare website mockups', 'Create initial mockups for website project', 3, 4, 1, 'in_progress', 'high', '2024-03-14 15:00:00', 'demo'),
('Schedule supply chain demo', 'Schedule demo for supply chain software', 5, 2, 1, 'pending', 'medium', '2024-03-16 11:00:00', 'meeting'),
('Send POS invoice', 'Send invoice for completed POS installation', 6, 4, 1, 'completed', 'low', '2024-03-13 09:00:00', 'email'),
('Prepare mobile app proposal', 'Create proposal for mobile app development', 8, 4, 1, 'pending', 'high', '2024-03-17 14:00:00', 'proposal');

-- Insert customer tag relationships
INSERT INTO customer_tag_relations (customer_id, tag_id) VALUES
(1, 2), (1, 5), (1, 10), -- Mwangi Enterprises: Hot Lead, High Value, Corporate
(2, 1), (2, 4), -- Wanjiru Farm Supplies: VIP, Repeat Customer
(3, 9), (3, 10), -- Karanja Tech Solutions: SME, Corporate
(4, 6), -- Sarah Ochieng: New
(5, 5), (5, 10), -- Kiprop Logistics: High Value, Corporate
(6, 9), -- Njoroge Restaurant: SME
(7, 11), -- Michael Odhiambo: Individual
(8, 2), (8, 9), -- Kamau Construction: Hot Lead, SME
(9, 9), -- Mutiso Transport: SME
(10, 1), (10, 4); -- Chebet Farm: VIP, Repeat Customer

-- Insert system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('company_name', 'Kenya CRM Solutions', 'Company name for the application'),
('company_email', 'info@kenyacrm.com', 'Company contact email'),
('company_phone', '+254700000000', 'Company contact phone'),
('default_currency', 'KES', 'Default currency for the system'),
('date_format', 'DD/MM/YYYY', 'Default date format'),
('time_format', '24h', 'Time format (12h or 24h)'),
('mpesa_enabled', 'true', 'Enable M-Pesa integration'),
('whatsapp_enabled', 'true', 'Enable WhatsApp integration'),
('backup_frequency', 'daily', 'Database backup frequency'),
('session_timeout', '8', 'Session timeout in hours'),
('max_file_size', '10485760', 'Maximum file upload size in bytes'),
('email_notifications', 'true', 'Enable email notifications'),
('sms_notifications', 'false', 'Enable SMS notifications'),
('dark_mode_default', 'false', 'Default dark mode setting');

-- Insert sample activity log
INSERT INTO activity_log (user_id, action, entity_type, entity_id, new_values, ip_address, user_agent) VALUES
(1, 'CREATE', 'customer', 1, '{"first_name": "James", "last_name": "Mwangi", "email": "james.mwangi@email.com"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(1, 'CREATE', 'customer', 2, '{"first_name": "Grace", "last_name": "Wanjiru", "email": "grace.wanjiru@email.com"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
(2, 'UPDATE', 'customer', 1, '{"status": "active"}', '192.168.1.100', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'),
(4, 'CREATE', 'deal', 2, '{"title": "Website Development", "value": "150000.00"}', '192.168.1.102', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15');

-- Update statistics
ANALYZE TABLE users, counties, sub_counties, business_categories, customers, customer_tags, customer_tag_relations, leads, deal_stages, deals, mpesa_transactions, communications, tasks, attachments, activity_log, system_settings;
