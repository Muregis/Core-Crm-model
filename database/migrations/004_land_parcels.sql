-- Land Inventory pack (Phase 1)
-- SQLite creates these tables in database-sqlite.js; this migration is for MySQL.

CREATE TABLE IF NOT EXISTS parcels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  title_ref VARCHAR(120) NOT NULL,
  plot_number VARCHAR(120) NULL,
  name VARCHAR(255) NULL,
  size_acres DECIMAL(12,4) NULL,
  size_unit VARCHAR(20) NOT NULL DEFAULT 'acres',
  county VARCHAR(100) NULL,
  ward VARCHAR(100) NULL,
  location_notes TEXT NULL,
  zoning VARCHAR(100) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'available',
  list_price_kes DECIMAL(18,2) NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'KES',
  deal_id INT NULL,
  owner_customer_id INT NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_parcels_tenant_title (tenant_id, title_ref),
  KEY idx_parcels_tenant_status (tenant_id, status),
  KEY idx_parcels_tenant_county (tenant_id, county),
  CONSTRAINT fk_parcels_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS parcel_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  parcel_id INT NOT NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NOT NULL,
  changed_by INT NULL,
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_psh_tenant_parcel (tenant_id, parcel_id),
  CONSTRAINT fk_psh_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_psh_parcel FOREIGN KEY (parcel_id) REFERENCES parcels(id)
);
