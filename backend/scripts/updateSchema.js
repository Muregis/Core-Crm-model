const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/config/database-sqlite.js');
let content = fs.readFileSync(file, 'utf8');

const insertion = `
  createParcelReservationsTable() {
    this.db.run(\`
      CREATE TABLE IF NOT EXISTS parcel_reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        parcel_id INTEGER NOT NULL,
        customer_id INTEGER,
        deal_id INTEGER,
        letter_of_offer_ref TEXT,
        hold_duration_hours INTEGER DEFAULT 48,
        expires_at TEXT NOT NULL,
        status TEXT DEFAULT 'active_hold',
        deposit_required_kes REAL DEFAULT 0,
        notes TEXT,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (parcel_id) REFERENCES parcels(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    \`);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_reservations_tenant ON parcel_reservations(tenant_id, status)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_reservations_parcel ON parcel_reservations(parcel_id)');
  }

  createDealInstallmentsTable() {
    this.db.run(\`
      CREATE TABLE IF NOT EXISTS deal_installments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        deal_id INTEGER NOT NULL,
        parcel_id INTEGER,
        customer_id INTEGER NOT NULL,
        installment_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        due_date TEXT NOT NULL,
        amount_kes REAL NOT NULL,
        paid_amount_kes REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        mpesa_receipt_number TEXT,
        paid_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (parcel_id) REFERENCES parcels(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    \`);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_installments_tenant ON deal_installments(tenant_id, deal_id)');
  }

  createConveyancingMattersTable() {
    this.db.run(\`
      CREATE TABLE IF NOT EXISTS conveyancing_matters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        deal_id INTEGER,
        parcel_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        stage TEXT DEFAULT 'search_due_diligence',
        search_ref TEXT,
        search_status TEXT DEFAULT 'pending',
        beacon_cert_number TEXT,
        mutation_form_ref TEXT,
        lcb_board_name TEXT,
        lcb_hearing_date TEXT,
        lcb_consent_ref TEXT,
        valuation_amount_kes REAL DEFAULT 0,
        stamp_duty_amount_kes REAL DEFAULT 0,
        cgt_clearance_ref TEXT,
        title_deed_number TEXT,
        title_collection_date TEXT,
        assigned_advocate_id INTEGER,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (parcel_id) REFERENCES parcels(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (assigned_advocate_id) REFERENCES users(id)
      )
    \`);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_conveyancing_tenant ON conveyancing_matters(tenant_id, stage)');
  }

  createProductsTable() {
    this.db.run(\`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        sku TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        unit TEXT DEFAULT 'unit',
        unit_price_kes REAL NOT NULL,
        cost_price_kes REAL DEFAULT 0,
        tax_rate REAL DEFAULT 16.0,
        stock_quantity INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        UNIQUE (tenant_id, sku)
      )
    \`);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id, status)');
  }

  createInvoicesTable() {
    this.db.run(\`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        deal_id INTEGER,
        invoice_number TEXT NOT NULL,
        etims_cu_number TEXT,
        invoice_type TEXT DEFAULT 'invoice',
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        subtotal_kes REAL NOT NULL,
        vat_amount_kes REAL NOT NULL,
        total_amount_kes REAL NOT NULL,
        amount_paid_kes REAL DEFAULT 0,
        status TEXT DEFAULT 'sent',
        notes TEXT,
        qr_code_data TEXT,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE (tenant_id, invoice_number)
      )
    \`);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON invoices(tenant_id, status)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_invoices_tenant_customer ON invoices(tenant_id, customer_id)');
  }

  createInvoiceItemsTable() {
    this.db.run(\`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        invoice_id INTEGER NOT NULL,
        product_id INTEGER,
        item_description TEXT NOT NULL,
        quantity REAL DEFAULT 1,
        unit_price_kes REAL NOT NULL,
        tax_rate REAL DEFAULT 16.0,
        total_kes REAL NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      )
    \`);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_invoice_items ON invoice_items(invoice_id)');
  }
`;

const needle = "this.db.run('CREATE INDEX IF NOT EXISTS idx_matter_time_tenant ON matter_time_entries(tenant_id, matter_id)');";
const idx = content.indexOf(needle);
if (idx === -1) {
  console.error('Needle not found');
  process.exit(1);
}

const closingBraceIdx = content.indexOf('}', idx);
content = content.slice(0, closingBraceIdx + 1) + '\r\n' + insertion.replace(/\n/g, '\r\n') + content.slice(closingBraceIdx + 1);

const target2 = "'MATTERS', 'MATTER_TIME_ENTRIES'";
const replacement2 = "'MATTERS', 'MATTER_TIME_ENTRIES', 'PARCEL_RESERVATIONS', 'DEAL_INSTALLMENTS', 'CONVEYANCING_MATTERS', 'PRODUCTS', 'INVOICES', 'INVOICE_ITEMS'";
content = content.replace(target2, replacement2);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated database-sqlite.js with all 6 new tables!');
