const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'kenya_crm.sqlite');

class Database {
  constructor() {
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
    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');

    // Create tables based on the MySQL schema
    this.createUsersTable();
    this.createCountiesTable();
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
  }

  createUsersTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'sales_rep',
        is_active INTEGER DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    this.db.run(sql);
  }

  createCountiesTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS counties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    this.db.run(sql);
  }

  createBusinessCategoriesTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS business_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    this.db.run(sql);
  }

  createCustomersTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        FOREIGN KEY (business_category_id) REFERENCES business_categories(id),
        FOREIGN KEY (county_id) REFERENCES counties(id),
        FOREIGN KEY (assigned_sales_rep_id) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `;
    this.db.run(sql);
  }

  createCustomerTagsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS customer_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#007bff',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    this.db.run(sql);
  }

  createCustomerTagRelationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS customer_tag_relations (
        customer_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (customer_id, tag_id),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES customer_tags(id) ON DELETE CASCADE
      )
    `;
    this.db.run(sql);
  }

  createLeadsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        FOREIGN KEY (county_id) REFERENCES counties(id),
        FOREIGN KEY (business_category_id) REFERENCES business_categories(id),
        FOREIGN KEY (assigned_sales_rep_id) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (converted_to_customer_id) REFERENCES customers(id)
      )
    `;
    this.db.run(sql);
  }

  createDealStagesTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS deal_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        probability INTEGER DEFAULT 0,
        color TEXT DEFAULT '#007bff',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    this.db.run(sql);
  }

  createDealsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (deal_stage_id) REFERENCES deal_stages(id),
        FOREIGN KEY (assigned_sales_rep_id) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `;
    this.db.run(sql);
  }

  createMpesaTransactionsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS mpesa_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT UNIQUE NOT NULL,
        customer_id INTEGER NOT NULL,
        deal_id INTEGER,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'KES',
        phone_number TEXT NOT NULL,
        transaction_type TEXT DEFAULT 'payment',
        status TEXT DEFAULT 'pending',
        merchant_request_id TEXT,
        checkout_request_id TEXT,
        receipt_number TEXT,
        transaction_date TEXT,
        notes TEXT,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `;
    this.db.run(sql);
  }

  createCommunicationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS communications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `;
    this.db.run(sql);
  }

  createTasksTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `;
    this.db.run(sql);
  }

  createAttachmentsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (deal_id) REFERENCES deals(id),
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      )
    `;
    this.db.run(sql);
  }

  createActivityLogTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;
    this.db.run(sql);
  }

  createSystemSettingsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
    this.db.run(sql);
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Database query error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
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
          run: (sql, params) => new Promise((res, rej) => {
            this.db.run(sql, params, function(err) {
              if (err) rej(err);
              else res({ id: this.lastID, changes: this.changes });
            });
          }),
          query: (sql, params) => new Promise((res, rej) => {
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
