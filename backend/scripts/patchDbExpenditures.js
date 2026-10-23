const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/config/database-sqlite.js');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('createExpendituresTable() {')) {
  const method = `  createExpendituresTable() {
    this.db.run(\`
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
    \`);
    this.db.run('CREATE INDEX IF NOT EXISTS idx_expenditures_tenant ON expenditures(tenant_id, expense_date)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_expenditures_user ON expenditures(assigned_user_id)');
  }

  forTenant(tenantId) {`;

  content = content.replace(/forTenant\s*\(\s*tenantId\s*\)\s*\{/, method);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully inserted createExpendituresTable() { method before forTenant');
} else {
  console.log('createExpendituresTable() { already present');
}
