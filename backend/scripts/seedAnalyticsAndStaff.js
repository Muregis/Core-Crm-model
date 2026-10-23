const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

async function seed() {
  console.log('Seeding team members, productivity metrics, and expenditures...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Helper to ensure user exists
  async function ensureUser(tenantId, email, firstName, lastName, role, phone) {
    const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return existing[0].id;
    const res = await db.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, email, passwordHash, firstName, lastName, role, phone]
    );
    return res.insertId;
  }

  // Helper to ensure deal exists
  async function ensureDeal(tenantId, title, customerId, stageId, value, status, userId) {
    const existing = await db.query('SELECT id FROM deals WHERE tenant_id = ? AND title = ?', [tenantId, title]);
    if (existing.length > 0) return existing[0].id;
    const res = await db.query(
      `INSERT INTO deals (tenant_id, title, customer_id, deal_stage_id, value, currency, status, assigned_sales_rep_id, created_by)
       VALUES (?, ?, ?, ?, ?, 'KES', ?, ?, ?)`,
      [tenantId, title, customerId, stageId, value, status, userId, userId]
    );
    return res.insertId;
  }

  // Helper to ensure expense exists
  async function ensureExpense(tenantId, category, title, amountKes, expenseDate, userId, paymentMethod, receiptRef, notes) {
    const existing = await db.query('SELECT id FROM expenditures WHERE tenant_id = ? AND title = ?', [tenantId, title]);
    if (existing.length > 0) return existing[0].id;
    const res = await db.query(
      `INSERT INTO expenditures (
        tenant_id, category, title, amount_kes, expense_date,
        assigned_user_id, payment_method, receipt_ref, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, category, title, amountKes, expenseDate, userId, paymentMethod, receiptRef, notes, userId]
    );
    return res.insertId;
  }

  // 1. TENANT 1: REAL ESTATE (Safari Real Estate Ltd)
  const t1 = await db.query("SELECT id FROM tenants WHERE slug = 'safari-real-estate' OR id = 1");
  if (t1.length > 0) {
    const tenantId = t1[0].id;
    const adminUser = await db.query('SELECT id FROM users WHERE tenant_id = ? AND role = "admin" LIMIT 1', [tenantId]);
    const adminId = adminUser[0]?.id || 1;

    // Staff 1: Grace Njeri (Top Performer - Bonus Candidate)
    const graceId = await ensureUser(tenantId, 'grace.njeri@safarirealestate.co.ke', 'Grace', 'Njeri', 'sales_rep', '+254722114477');
    // Staff 2: Kevin Omondi (Solid Contributor)
    const kevinId = await ensureUser(tenantId, 'kevin.omondi@safarirealestate.co.ke', 'Kevin', 'Omondi', 'sales_rep', '+254733889900');
    // Staff 3: Brian Mutua (Underperformer - Layoff / Restructure Risk)
    const brianId = await ensureUser(tenantId, 'brian.mutua@safarirealestate.co.ke', 'Brian', 'Mutua', 'sales_rep', '+254719556633');

    // Customer
    const custs = await db.query('SELECT id FROM customers WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const custId = custs[0]?.id || 1;

    // Deals for Grace (Won deals totaling KES 4.5M -> High ROI Multiplier)
    await ensureDeal(tenantId, 'Acacia Heights Plot 18 Commercial Lot Sale', custId, 5, 2500000, 'won', graceId);
    await ensureDeal(tenantId, 'Scenic Valley View 1/4 Acre Lot Close', custId, 5, 2000000, 'won', graceId);
    await ensureDeal(tenantId, 'Kitengela Prime Commercial Hub Lot', custId, 3, 3200000, 'active', graceId);

    // Deals for Kevin (Won KES 1.85M -> Solid 2.2x ROI)
    await ensureDeal(tenantId, 'Acacia Greens Plot 44 Full Purchase', custId, 5, 1850000, 'won', kevinId);
    await ensureDeal(tenantId, 'Juja Farm 1/4 Acre Investment Lot', custId, 4, 1500000, 'active', kevinId);

    // Deals for Brian (0 Won deals, inactive pipeline -> Negative ROI)
    await ensureDeal(tenantId, 'Kamulu Inactive Inquiry Lot', custId, 1, 650000, 'active', brianId);

    // Expenditures for Real Estate
    await ensureExpense(tenantId, 'payroll', 'Grace Njeri - Sales Consultant Base Salary & Retainer', 80000, '2026-10-01', graceId, 'bank_transfer', 'PAY-2026-10-01', 'Monthly fixed retainer');
    await ensureExpense(tenantId, 'commissions', 'Grace Njeri - Acacia Phase 1 Sales Commission (2.5%)', 112500, '2026-10-15', graceId, 'mpesa_b2b', 'COMM-GN-2026-10', 'Commission payout on completed title handover');
    await ensureExpense(tenantId, 'payroll', 'Kevin Omondi - Field Tour Guide & Agent Base Salary', 70000, '2026-10-01', kevinId, 'bank_transfer', 'PAY-2026-10-02', 'Monthly fixed retainer');
    await ensureExpense(tenantId, 'payroll', 'Brian Mutua - Junior Agent Base & Fuel Advance', 75000, '2026-10-01', brianId, 'mpesa_b2b', 'PAY-2026-10-03', 'Monthly salary + field allowance');
    await ensureExpense(tenantId, 'marketing_leads', 'Facebook & Google Real Estate Ads - Isinya Phase 2', 125000, '2026-10-05', adminId, 'mpesa_b2b', 'FB-ADS-2026-10', 'Digital lead generation campaigns');
    await ensureExpense(tenantId, 'operations_logistics', 'Land Rover Site Visit Fuel & Maintenance Fleet Fleet', 68000, '2026-10-12', adminId, 'mpesa_b2b', 'TOTAL-EXP-441', 'Client site tour transport from Nairobi CBD to Kitengela');
    await ensureExpense(tenantId, 'legal_regulatory', 'Sub-County Land Control Board (LCB) Filing Fees', 45000, '2026-10-08', adminId, 'bank_transfer', 'LCB-GOV-9812', 'Statutory board sitting & gazette fee for 5 plots');
    console.log('Seeded Safari Real Estate staff & expenditures.');
  }

  // 2. TENANT 2: LEGAL PRACTICE (Nairobi Advocates LLP)
  const t2 = await db.query("SELECT id FROM tenants WHERE slug = 'nairobi-law' OR id = 2");
  if (t2.length > 0) {
    const tenantId = t2[0].id;
    const adminUser = await db.query('SELECT id FROM users WHERE tenant_id = ? AND role = "admin" LIMIT 1', [tenantId]);
    const adminId = adminUser[0]?.id || 2;

    const philipId = await ensureUser(tenantId, 'philip.oraro@nairobilaw.co.ke', 'Philip', 'Oraro', 'manager', '+254711334455');
    const chebetId = await ensureUser(tenantId, 'faith.chebet@nairobilaw.co.ke', 'Faith', 'Chebet', 'sales_rep', '+254722881199');
    const dennisId = await ensureUser(tenantId, 'dennis.wekesa@nairobilaw.co.ke', 'Dennis', 'Wekesa', 'sales_rep', '+254799001122');

    const custs = await db.query('SELECT id FROM customers WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const custId = custs[0]?.id || 1;

    // Deals for Philip (High Court Retainers Won KES 2.8M)
    await ensureDeal(tenantId, 'Commercial Bank Injunction Retainer (High Court Comm Div)', custId, 5, 1800000, 'won', philipId);
    await ensureDeal(tenantId, 'Constitutional Petition No. E044 of 2026 Retainer', custId, 5, 1000000, 'won', philipId);

    // Deals for Faith (Conveyancing Retainers Won KES 950K)
    await ensureDeal(tenantId, 'Commercial Land Title Conveyance Retainer (KAJ/8915)', custId, 5, 950000, 'won', chebetId);
    await ensureDeal(tenantId, 'Sectional Properties Act Conversion Brief', custId, 3, 600000, 'active', chebetId);

    // Deals for Dennis (0 won)
    await ensureDeal(tenantId, 'Legal Aid Initial Consultation File', custId, 1, 150000, 'active', dennisId);

    // Expenditures for Legal Practice
    await ensureExpense(tenantId, 'payroll', 'Philip Oraro - Senior Associate Monthly Remuneration', 150000, '2026-10-01', philipId, 'bank_transfer', 'SAL-PO-2026-10', 'Senior associate fixed remuneration');
    await ensureExpense(tenantId, 'payroll', 'Faith Chebet - Conveyancing Advocate Remuneration', 95000, '2026-10-01', chebetId, 'bank_transfer', 'SAL-FC-2026-10', 'Associate monthly salary');
    await ensureExpense(tenantId, 'payroll', 'Dennis Wekesa - Legal Assistant Monthly Allowance', 65000, '2026-10-01', dennisId, 'bank_transfer', 'SAL-DW-2026-10', 'Legal clerk stipend and transport');
    await ensureExpense(tenantId, 'legal_regulatory', 'Judiciary e-Filing Fee Account Float Top-Up', 50000, '2026-10-04', adminId, 'mpesa_b2b', 'EFILING-FLOAT-99', 'Milimani High Court e-filing statutory stamp');
    await ensureExpense(tenantId, 'office_overhead', 'Upper Hill Chambers Office Rent & High-Speed Internet', 180000, '2026-10-02', adminId, 'bank_transfer', 'RENT-OCT-2026', 'Law firm executive suite monthly lease');
    console.log('Seeded Nairobi Advocates staff & expenditures.');
  }

  // 3. TENANT 3: COMMERCIAL CORE (Apex Commercial Supplies Ltd)
  const t3 = await db.query("SELECT id FROM tenants WHERE slug = 'apex-commercial' OR id = 3");
  if (t3.length > 0) {
    const tenantId = t3[0].id;
    const adminUser = await db.query('SELECT id FROM users WHERE tenant_id = ? AND role = "admin" LIMIT 1', [tenantId]);
    const adminId = adminUser[0]?.id || 3;

    const sarahId = await ensureUser(tenantId, 'sarah.ochieng@apexsupplies.co.ke', 'Sarah', 'Ochieng', 'sales_rep', '+254722558833');
    const davidId = await ensureUser(tenantId, 'david.mutua@apexsupplies.co.ke', 'David', 'Mutua', 'sales_rep', '+254733441188');
    const jamesId = await ensureUser(tenantId, 'james.kibet@apexsupplies.co.ke', 'James', 'Kibet', 'sales_rep', '+254711990044');

    const custs = await db.query('SELECT id FROM customers WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const custId = custs[0]?.id || 1;

    // Deals for Sarah (Won KES 5.6M -> Top Performer)
    await ensureDeal(tenantId, 'Annual FMCG Bulk Supply Agreement 2026/27', custId, 5, 3450000, 'won', sarahId);
    await ensureDeal(tenantId, 'Hospitality Chain Sanitation Machinery Contract', custId, 5, 2150000, 'won', sarahId);

    // Deals for David (Won KES 1.28M -> Solid)
    await ensureDeal(tenantId, 'Industrial Cleaning Equipment Supply Tender', custId, 5, 1280000, 'won', davidId);
    await ensureDeal(tenantId, 'Hydraulic Pallet Hand Stackers Procurement', custId, 3, 850000, 'active', davidId);

    // Deals for James (0 won)
    await ensureDeal(tenantId, 'Small Hardware Inbound Inquiry', custId, 1, 240000, 'active', jamesId);

    // Expenditures for Commercial
    await ensureExpense(tenantId, 'payroll', 'Sarah Ochieng - Senior Account Exec Salary', 110000, '2026-10-01', sarahId, 'bank_transfer', 'SAL-SO-2026-10', 'Enterprise sales exec base salary');
    await ensureExpense(tenantId, 'commissions', 'Sarah Ochieng - Q3 FMCG Contract Closing Bonus', 150000, '2026-10-15', sarahId, 'mpesa_b2b', 'BONUS-SO-2026', 'Executive performance bonus on KES 5.6M contract');
    await ensureExpense(tenantId, 'payroll', 'David Mutua - B2B Commercial Sales Rep Salary', 80000, '2026-10-01', davidId, 'bank_transfer', 'SAL-DM-2026-10', 'Commercial sales salary');
    await ensureExpense(tenantId, 'payroll', 'James Kibet - Inbound Telemarketer Salary', 65000, '2026-10-01', jamesId, 'bank_transfer', 'SAL-JK-2026-10', 'Telesales rep monthly wage');
    await ensureExpense(tenantId, 'operations_logistics', 'Warehouse Heavy Truck Logistics & Dispatch Fuel', 140000, '2026-10-10', adminId, 'mpesa_b2b', 'LOG-DISP-881', 'Bulk transport from Industrial Area to client sites');
    await ensureExpense(tenantId, 'marketing_leads', 'Kenya Association of Manufacturers (KAM) Expo Booth', 95000, '2026-10-06', adminId, 'bank_transfer', 'KAM-EXPO-2026', 'B2B trade exhibition booth sponsorship');
    console.log('Seeded Apex Commercial Supplies staff & expenditures.');
  }

  console.log('Analytics & staff seeding successfully completed.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
