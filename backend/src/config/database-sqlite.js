const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const dbDir = path.join(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(dbDir, 'kenya_crm.sqlite');

class Database {
  constructor() {
    this._readyResolve = null;
    this.ready = new Promise((resolve) => {
      this._readyResolve = resolve;
    });

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('SQLite connection error:', err);
        throw err;
      }
      logger.info('SQLite database connected');
      this.initTables();
    });
  }

  initTables() {
    this.db.serialize(() => {
      this.db.run('PRAGMA foreign_keys = ON');

      this.createTenantsTable();
      this.db.run("ALTER TABLE tenants ADD COLUMN industry TEXT DEFAULT 'general'", () => {});
      this.db.run("ALTER TABLE matters ADD COLUMN court_level TEXT", () => {});
      this.db.run("ALTER TABLE matters ADD COLUMN court_station TEXT", () => {});
      this.db.run("ALTER TABLE matters ADD COLUMN coram_title TEXT", () => {});
      this.db.run("ALTER TABLE matters ADD COLUMN party_role TEXT DEFAULT 'Plaintiff'", () => {});
      this.db.run("ALTER TABLE matters ADD COLUMN opposing_role TEXT DEFAULT 'Defendant'", () => {});
      this.db.run("ALTER TABLE matters ADD COLUMN hearing_purpose TEXT", () => {});
      this.db.run("ALTER TABLE matters ADD COLUMN disbursements_kes REAL DEFAULT 0", () => {});
      this.db.run("ALTER TABLE matters ADD COLUMN vat_amount_kes REAL DEFAULT 0", () => {});
      this.db.run("ALTER TABLE matters ADD COLUMN aro_scale TEXT", () => {});
      this.createUsersTable();
      this.createCountiesTable();
      this.createSubCountiesTable();
      this.createBusinessCategoriesTable();
      this.createCustomersTable();
      this.createCustomerTagsTable();
      this.createCustomerTagRelationsTable();
      this.createLeadsTable();
      this.createDealStagesTable();
      this.createDealsTable();
      this.createMpesaTransactionsTable();
      this.createCommunicationsTable();
      this.createTasksTable();
      this.createAttachmentsTable();
      this.createActivityLogTable();
      this.createSystemSettingsTable();
      this.createJobsTable();
      this.createTenantCredentialsTable();
      this.createRefreshTokensTable();
      this.createTokenBlocklistTable();
      this.createParcelsTable();
      this.createParcelStatusHistoryTable();
      this.createMattersTable();
      this.createMatterTimeEntriesTable();
      this.createParcelReservationsTable();
      this.createDealInstallmentsTable();
      this.createConveyancingMattersTable();
      this.createProductsTable();
      this.createInvoicesTable();
      this.createInvoiceItemsTable();
      this.createExpendituresTable();
      this.createSiteVisitsTable();
      this.createSiteVisitBookingsTable();

      this.db.run("ALTER TABLE mpesa_transactions ADD COLUMN invoice_id INTEGER", () => {});
      this.db.run("ALTER TABLE mpesa_transactions ADD COLUMN installment_id INTEGER", () => {});
      this.db.run("ALTER TABLE parcels ADD COLUMN reservation_expires_at TEXT", () => {});
      this.db.run("ALTER TABLE parcels ADD COLUMN project_name TEXT DEFAULT 'Phase 1'", () => {});

      this.db.run('SELECT 1', (err) => {
        if (err) logger.error('Schema ready check failed:', err);
        if (this._readyResolve) this._readyResolve();
      });
    });
  }

  createTenantsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        domain TEXT,
        kra_pin TEXT,
        plan TEXT DEFAULT 'starter',
        industry TEXT DEFAULT 'general',
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  createUsersTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'sales_rep',
        is_active INTEGER DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);
  }

  createCountiesTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS counties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  createSubCountiesTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sub_counties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        county_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (county_id) REFERENCES counties(id)
      )
    `);
  }

  createBusinessCategoriesTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS business_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  createCustomersTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT NOT NULL,
        company_name TEXT,
        business_category_id INTEGER,
        county_id INTEGER,
        sub_county_id INTEGER,
        physical_address TEXT,
        customer_type TEXT DEFAULT 'individual',
        status TEXT DEFAULT 'prospect',
        notes TEXT,
        assigned_sales_rep_id INTEGER,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (business_category_id) REFERENCES business_categories(id),
        FOREIGN KEY (county_id) REFERENCES counties(id),
        FOREIGN KEY (assigned_sales_rep_id) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
  }

  createCustomerTagsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS customer_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#007bff',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);
  }

  createCustomerTagRelationsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS customer_tag_relations (
        tenant_id INTEGER,
        customer_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (customer_id, tag_id),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES customer_tags(id) ON DELETE CASCADE
      )
    `);
  }

  createLeadsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT,
        phone TEXT NOT NULL,
        company_name TEXT,
        source TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        priority TEXT DEFAULT 'medium',
        score INTEGER DEFAULT 0,
        estimated_value REAL,
        county_id INTEGER,
        business_category_id INTEGER,
        assigned_sales_rep_id INTEGER,
        notes TEXT,
        created_by INTEGER NOT NULL,
        converted_to_customer_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (county_id) REFERENCES counties(id),
        FOREIGN KEY (business_category_id) REFERENCES business_categories(id),
        FOREIGN KEY (assigned_sales_rep_id) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (converted_to_customer_id) REFERENCES customers(id)
      )
    `);
  }

  createDealStagesTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS deal_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        name TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        probability INTEGER DEFAULT 0,
        color TEXT DEFAULT '#007bff',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, () => {
      this.db.get('SELECT COUNT(*) as count FROM deal_stages', (err, row) => {
        if (!err && row && row.count === 0) {
          const defaultStages = [
            ['Prospecting', 1, 10, '#6c757d'],
            ['Qualification', 2, 25, '#17a2b8'],
            ['Proposal', 3, 50, '#ffc107'],
            ['Negotiation', 4, 75, '#fd7e14'],
            ['Closed Won', 5, 100, '#28a745'],
            ['Closed Lost', 6, 0, '#dc3545']
          ];
          const stmt = this.db.prepare(
            'INSERT INTO deal_stages (name, order_index, probability, color) VALUES (?, ?, ?, ?)'
          );
          defaultStages.forEach((s) => stmt.run(s));
          stmt.finalize();
        }
      });
    });
  }

  createDealsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        customer_id INTEGER NOT NULL,
        lead_id INTEGER,
        deal_stage_id INTEGER NOT NULL,
        assigned_sales_rep_id INTEGER NOT NULL,
        value REAL NOT NULL,
        currency TEXT DEFAULT 'KES',
        expected_close_date TEXT,
        actual_close_date TEXT,
        status TEXT DEFAULT 'active',
        lost_reason TEXT,
        notes TEXT,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (deal_stage_id) REFERENCES deal_stages(id),
        FOREIGN KEY (assigned_sales_rep_id) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
  }

  createMpesaTransactionsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS mpesa_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        transaction_id TEXT,
        mpesa_receipt_number TEXT,
        receipt_number TEXT,
        customer_id INTEGER,
        deal_id INTEGER,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'KES',
        phone_number TEXT NOT NULL,
        transaction_type TEXT DEFAULT 'payment',
        status TEXT DEFAULT 'completed',
        merchant_request_id TEXT,
        checkout_request_id TEXT,
        transaction_date TEXT,
        transaction_time TEXT DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
  }

  createCommunicationsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS communications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        lead_id INTEGER,
        deal_id INTEGER,
        type TEXT NOT NULL,
        direction TEXT DEFAULT 'outbound',
        subject TEXT,
        content TEXT NOT NULL,
        duration_minutes INTEGER,
        status TEXT DEFAULT 'completed',
        scheduled_date TEXT,
        completed_date TEXT,
        next_follow_up TEXT,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
  }

  createTasksTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        customer_id INTEGER,
        lead_id INTEGER,
        deal_id INTEGER,
        assigned_to INTEGER NOT NULL,
        created_by INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        due_date TEXT,
        completed_date TEXT,
        task_type TEXT DEFAULT 'follow_up',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
  }

  createAttachmentsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        customer_id INTEGER,
        lead_id INTEGER,
        deal_id INTEGER,
        uploaded_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      )
    `);
  }

  createActivityLogTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
  }

  createSystemSettingsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  createJobsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        job_id TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'waiting',
        priority INTEGER DEFAULT 0,
        payload TEXT,
        result TEXT,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        error_message TEXT,
        worker_id TEXT,
        started_at TEXT,
        completed_at TEXT,
        failed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);
  }

  createTenantCredentialsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tenant_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        provider TEXT NOT NULL,
        shortcode TEXT NOT NULL,
        key_type TEXT DEFAULT 'paybill',
        consumer_key_encrypted TEXT NOT NULL,
        consumer_secret_encrypted TEXT NOT NULL,
        passkey_encrypted TEXT,
        iv TEXT NOT NULL,
        is_sandbox INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);
  }

  createRefreshTokensTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        revoked INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
  }

  createTokenBlocklistTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS token_blocklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  createParcelsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS parcels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        title_ref TEXT NOT NULL,
        plot_number TEXT,
        name TEXT,
        size_acres REAL,
        size_unit TEXT DEFAULT 'acres',
        county TEXT,
        ward TEXT,
        location_notes TEXT,
        zoning TEXT,
        status TEXT NOT NULL DEFAULT 'available',
        list_price_kes REAL,
        currency TEXT DEFAULT 'KES',
        deal_id INTEGER,
        owner_customer_id INTEGER,
        notes TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (owner_customer_id) REFERENCES customers(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE (tenant_id, title_ref)
      )
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_parcels_tenant_status ON parcels(tenant_id, status)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_parcels_tenant_county ON parcels(tenant_id, county)');
  }

  createParcelStatusHistoryTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS parcel_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        parcel_id INTEGER NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        changed_by INTEGER,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (parcel_id) REFERENCES parcels(id),
        FOREIGN KEY (changed_by) REFERENCES users(id)
      )
    `);
  }

  createMattersTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS matters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        case_number TEXT,
        title TEXT NOT NULL,
        client_id INTEGER NOT NULL,
        practice_area TEXT DEFAULT 'General Practice',
        court_name TEXT,
        court_level TEXT,
        court_station TEXT,
        coram_title TEXT,
        party_role TEXT DEFAULT 'Plaintiff',
        opposing_role TEXT DEFAULT 'Defendant',
        hearing_purpose TEXT,
        judge_or_arbitrator TEXT,
        opposing_party TEXT,
        opposing_counsel TEXT,
        billing_type TEXT DEFAULT 'fixed_fee',
        fee_amount_kes REAL,
        disbursements_kes REAL DEFAULT 0,
        vat_amount_kes REAL DEFAULT 0,
        aro_scale TEXT,
        hourly_rate_kes REAL,
        status TEXT NOT NULL DEFAULT 'active',
        priority TEXT DEFAULT 'medium',
        next_hearing_date TEXT,
        filing_deadline TEXT,
        assigned_advocate_id INTEGER,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (client_id) REFERENCES customers(id),
        FOREIGN KEY (assigned_advocate_id) REFERENCES users(id)
      )
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_matters_tenant_status ON matters(tenant_id, status)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_matters_tenant_client ON matters(tenant_id, client_id)');
  }

  createMatterTimeEntriesTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS matter_time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        matter_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        activity_type TEXT DEFAULT 'drafting',
        duration_minutes INTEGER NOT NULL,
        hourly_rate_kes REAL,
        billable_amount_kes REAL,
        date TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (matter_id) REFERENCES matters(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_matter_time_tenant ON matter_time_entries(tenant_id, matter_id)');
  }

  createParcelReservationsTable() {
    this.db.run(`
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
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_reservations_tenant ON parcel_reservations(tenant_id, status)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_reservations_parcel ON parcel_reservations(parcel_id)');
  }

  createDealInstallmentsTable() {
    this.db.run(`
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
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_installments_tenant ON deal_installments(tenant_id, deal_id)');
  }

  createConveyancingMattersTable() {
    this.db.run(`
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
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_conveyancing_tenant ON conveyancing_matters(tenant_id, stage)');
  }

  createProductsTable() {
    this.db.run(`
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
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id, status)');
  }

  createInvoicesTable() {
    this.db.run(`
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
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON invoices(tenant_id, status)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_invoices_tenant_customer ON invoices(tenant_id, customer_id)');
  }

  createInvoiceItemsTable() {
    this.db.run(`
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
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_invoice_items ON invoice_items(invoice_id)');
  }


    createExpendituresTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS expenditures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        amount_kes REAL NOT NULL,
        expense_date TEXT NOT NULL,
        assigned_user_id INTEGER,
        deal_id INTEGER,
        payment_method TEXT DEFAULT 'mpesa_b2b',
        receipt_ref TEXT,
        notes TEXT,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (assigned_user_id) REFERENCES users(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_expenditures_tenant ON expenditures(tenant_id, expense_date)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_expenditures_user ON expenditures(assigned_user_id)');
  }

  createSiteVisitsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS site_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        project_name TEXT NOT NULL,
        destination_county TEXT DEFAULT 'Kiambu',
        visit_date TEXT NOT NULL,
        departure_time TEXT DEFAULT '09:00 AM',
        departure_location TEXT DEFAULT 'Kencom House, Nairobi CBD',
        vehicle_type TEXT DEFAULT '33-Seater Executive Shuttle',
        total_seats INTEGER DEFAULT 33,
        booked_seats INTEGER DEFAULT 0,
        lead_marshal_id INTEGER,
        driver_name TEXT DEFAULT 'Mwangi Driver',
        driver_phone TEXT DEFAULT '+254711000999',
        status TEXT DEFAULT 'scheduled',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (lead_marshal_id) REFERENCES users(id)
      )
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_site_visits_tenant ON site_visits(tenant_id, visit_date)');
  }

  createSiteVisitBookingsTable() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS site_visit_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        site_visit_id INTEGER NOT NULL,
        customer_id INTEGER,
        visitor_name TEXT NOT NULL,
        visitor_phone TEXT NOT NULL,
        seats_booked INTEGER DEFAULT 1,
        pickup_point TEXT DEFAULT 'Kencom House, CBD',
        assigned_agent_id INTEGER,
        status TEXT DEFAULT 'confirmed',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (site_visit_id) REFERENCES site_visits(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (assigned_agent_id) REFERENCES users(id)
      )
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_site_bookings_visit ON site_visit_bookings(site_visit_id)');
  }

  forTenant(tenantId) {
    if (!tenantId) {
      throw new Error('Tenant safety violation: tenantId is required for scoped database operations');
    }
    const self = this;
    return {
      async query(sql, params = []) {
        const upper = sql.toUpperCase();
        const tenantTables = [
          'CUSTOMERS', 'LEADS', 'DEALS', 'TASKS', 'COMMUNICATIONS',
          'MPESA_TRANSACTIONS', 'JOBS', 'TENANT_CREDENTIALS', 'PARCELS', 'PARCEL_STATUS_HISTORY',
          'MATTERS', 'MATTER_TIME_ENTRIES', 'PARCEL_RESERVATIONS', 'DEAL_INSTALLMENTS', 'CONVEYANCING_MATTERS', 'PRODUCTS', 'INVOICES', 'INVOICE_ITEMS', 'EXPENDITURES', 'SITE_VISITS', 'SITE_VISIT_BOOKINGS'
        ];
        const touchesTenantTable = tenantTables.some((t) => upper.includes(t));
        if (touchesTenantTable && !upper.includes('TENANT_ID')) {
          throw new Error(
            `Tenant safety violation: query against tenant table lacks tenant_id constraint: ${sql}`
          );
        }
        return self.query(sql, params);
      },
      async run(sql, params = []) {
        return self.run(sql, params);
      }
    };
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('INSERT') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
        this.db.run(sql, params, function (err) {
          if (err) {
            logger.error('Database run error:', err);
            reject(err);
          } else {
            resolve({ insertId: this.lastID, affectedRows: this.changes });
          }
        });
      } else {
        this.db.all(sql, params, (err, rows) => {
          if (err) {
            logger.error('Database query error:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      }
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          logger.error('Database run error:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async transaction(callback) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        const transactionDb = {
          run: (sql, params) =>
            new Promise((res, rej) => {
              this.db.run(sql, params, function (err) {
                if (err) rej(err);
                else res({ id: this.lastID, changes: this.changes });
              });
            }),
          query: (sql, params) =>
            new Promise((res, rej) => {
              this.db.all(sql, params, (err, rows) => {
                if (err) rej(err);
                else res(rows);
              });
            })
        };
        try {
          const result = callback(transactionDb);
          this.db.run('COMMIT');
          resolve(result);
        } catch (error) {
          this.db.run('ROLLBACK');
          reject(error);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          logger.error('Database close error:', err);
          reject(err);
        } else {
          logger.info('Database connection closed');
          resolve();
        }
      });
    });
  }
}

module.exports = new Database();
