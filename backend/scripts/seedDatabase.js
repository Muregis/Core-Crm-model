const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

async function seed() {
  console.log('--- Starting CRM Multi-Profession Database Seeder ---');

  if (db.ready) {
    await db.ready;
  }

  async function syncStagesAndSeedDeals(tenantId, industry, customerId, repUserId) {
    let stageDefs;
    if (industry === 'real_estate') {
      stageDefs = [
        ['Buyer Inquiry & Qualification', 1, 20, '#6c757d'],
        ['Site Visit Scheduled', 2, 40, '#17a2b8'],
        ['Letter of Offer Issued', 3, 60, '#ffc107'],
        ['Sale Agreement & Deposit', 4, 80, '#fd7e14'],
        ['Title Transfer / Closed Won', 5, 100, '#28a745'],
        ['Deal Cancelled', 6, 0, '#dc3545']
      ];
    } else if (industry === 'legal') {
      stageDefs = [
        ['Consultation & Intake', 1, 20, '#6c757d'],
        ['Pleadings & Demand Letter', 2, 40, '#17a2b8'],
        ['Court Filing & Mention', 3, 60, '#ffc107'],
        ['Hearing & Submissions', 4, 80, '#fd7e14'],
        ['Judgment / Settled', 5, 100, '#28a745'],
        ['Withdrawn / Dismissed', 6, 0, '#dc3545']
      ];
    } else {
      stageDefs = [
        ['Prospecting & Inbound', 1, 10, '#6c757d'],
        ['Lead Qualification', 2, 25, '#17a2b8'],
        ['Quotation / Proposal', 3, 50, '#ffc107'],
        ['Contract Negotiation', 4, 75, '#fd7e14'],
        ['Closed Won / PO Issued', 5, 100, '#28a745'],
        ['Closed Lost', 6, 0, '#dc3545']
      ];
    }

    // 1. Sync stages cleanly
    let existingStages = await db.query('SELECT * FROM deal_stages WHERE tenant_id = ? ORDER BY order_index ASC', [tenantId]);
    if (existingStages.length === 0) {
      for (const [name, order, prob, color] of stageDefs) {
        await db.query(
          'INSERT INTO deal_stages (tenant_id, name, order_index, probability, color) VALUES (?, ?, ?, ?, ?)',
          [tenantId, name, order, prob, color]
        );
      }
    } else {
      for (let i = 0; i < stageDefs.length; i++) {
        const [name, order, prob, color] = stageDefs[i];
        if (existingStages[i]) {
          await db.query(
            'UPDATE deal_stages SET name = ?, order_index = ?, probability = ?, color = ? WHERE id = ?',
            [name, order, prob, color, existingStages[i].id]
          );
        } else {
          await db.query(
            'INSERT INTO deal_stages (tenant_id, name, order_index, probability, color) VALUES (?, ?, ?, ?, ?)',
            [tenantId, name, order, prob, color]
          );
        }
      }
    }
    const currentStages = await db.query('SELECT * FROM deal_stages WHERE tenant_id = ? ORDER BY order_index ASC', [tenantId]);

    // 2. Check if deals exist for this tenant
    const dealCount = await db.query('SELECT COUNT(*) as cnt FROM deals WHERE tenant_id = ?', [tenantId]);
    if (dealCount[0].cnt === 0 && customerId && repUserId) {
      if (industry === 'real_estate') {
        await db.query(`
          INSERT INTO deals (tenant_id, title, customer_id, deal_stage_id, assigned_sales_rep_id, value, currency, expected_close_date, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId, 'Acacia Greens Plot #44 Purchase', customerId, currentStages[1].id, repUserId,
          1850000, 'KES', '2026-11-20', 'Buyer scheduled for Saturday site visit and beacon verification.', repUserId
        ]);
        await db.query(`
          INSERT INTO deals (tenant_id, title, customer_id, deal_stage_id, assigned_sales_rep_id, value, currency, expected_close_date, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId, 'Juja Farm 1/4 Acre Investment Lot', customerId, currentStages[2].id, repUserId,
          950000, 'KES', '2026-12-05', 'Letter of offer generated. Awaiting 20% down payment.', repUserId
        ]);
        await db.query(`
          INSERT INTO deals (tenant_id, title, customer_id, deal_stage_id, assigned_sales_rep_id, value, currency, expected_close_date, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId, 'Naivasha Longonot Breeze Plot #42 Sale', customerId, currentStages[3].id, repUserId,
          1250000, 'KES', '2026-11-15', 'Sale agreement signed, awaiting final installment for title deed transfer.', repUserId
        ]);
        console.log(`Seeded 3 real estate land deals for tenant ${tenantId}.`);
      } else if (industry === 'legal') {
        await db.query(`
          INSERT INTO deals (tenant_id, title, customer_id, deal_stage_id, assigned_sales_rep_id, value, currency, expected_close_date, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId, 'Commercial Litigation Retainer - Gachagua v Equity Bank', customerId, currentStages[1].id, repUserId,
          350000, 'KES', '2026-11-20', 'Pleadings drafted, waiting for pre-trial bundle conference (Order 11 CPR).', repUserId
        ]);
        await db.query(`
          INSERT INTO deals (tenant_id, title, customer_id, deal_stage_id, assigned_sales_rep_id, value, currency, expected_close_date, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId, 'Constitutional Petition Retainer - Leasehold Revocation Challenge (Art. 40 CoK)', customerId, currentStages[2].id, repUserId,
          600000, 'KES', '2026-11-28', 'Petition filed at Milimani High Court Constitutional Division. Mention date allocated.', repUserId
        ]);
        await db.query(`
          INSERT INTO deals (tenant_id, title, customer_id, deal_stage_id, assigned_sales_rep_id, value, currency, expected_close_date, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId, 'Conveyancing & Land Title Registration Retainer (KAJ/KAPUTIEI/1104)', customerId, currentStages[4].id, repUserId,
          450000, 'KES', '2026-12-04', 'Interlocutory notice of motion hearing at Kajiado ELC.', repUserId
        ]);
        console.log(`Seeded 3 legal retainer briefs for tenant ${tenantId}.`);
      } else {
        await db.query(`
          INSERT INTO deals (tenant_id, title, customer_id, deal_stage_id, assigned_sales_rep_id, value, currency, expected_close_date, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId, 'Annual FMCG Bulk Supply Agreement 2026/27', customerId, currentStages[3].id, repUserId,
          3450000, 'KES', '2026-11-30', 'Quarterly delivery schedule, 30-day invoice credit terms.', repUserId
        ]);
        await db.query(`
          INSERT INTO deals (tenant_id, title, customer_id, deal_stage_id, assigned_sales_rep_id, value, currency, expected_close_date, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId, 'Industrial Cleaning Equipment Supply', customerId, currentStages[4].id, repUserId,
          1280000, 'KES', '2026-10-15', 'Closed won and delivered. Payment received via M-Pesa & Bank wire.', repUserId
        ]);
        await db.query(`
          INSERT INTO deals (tenant_id, title, customer_id, deal_stage_id, assigned_sales_rep_id, value, currency, expected_close_date, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId, 'Warehouse Pallet & Racking System Tender', customerId, currentStages[2].id, repUserId,
          2150000, 'KES', '2026-12-10', 'Technical and financial quotation submitted. Evaluation pending.', repUserId
        ]);
        console.log(`Seeded 3 commercial B2B deals for tenant ${tenantId}.`);
      }
    }
  }

  // 1. Seed Counties
  const existingCounties = await db.query('SELECT COUNT(*) as cnt FROM counties');
  if (existingCounties[0].cnt === 0) {
    const kenyanCounties = [
      ['Mombasa', '001'], ['Kwale', '002'], ['Kilifi', '003'], ['Tana River', '004'], ['Lamu', '005'],
      ['Taita Taveta', '006'], ['Garissa', '007'], ['Wajir', '008'], ['Mandera', '009'], ['Marsabit', '010'],
      ['Isiolo', '011'], ['Meru', '012'], ['Tharaka-Nithi', '013'], ['Embu', '014'], ['Kitui', '015'],
      ['Machakos', '016'], ['Makueni', '017'], ['Nyandarua', '018'], ['Nyeri', '019'], ['Kirinyaga', '020'],
      ['Murang\'a', '021'], ['Kiambu', '022'], ['Turkana', '023'], ['West Pokot', '024'], ['Samburu', '025'],
      ['Trans Nzoia', '026'], ['Uasin Gishu', '027'], ['Elgeyo Marakwet', '028'], ['Nandi', '029'], ['Baringo', '030'],
      ['Laikipia', '031'], ['Nakuru', '032'], ['Narok', '033'], ['Kajiado', '034'], ['Kericho', '035'],
      ['Bomet', '036'], ['Kakamega', '037'], ['Vihiga', '038'], ['Bungoma', '039'], ['Busia', '040'],
      ['Siaya', '041'], ['Kisumu', '042'], ['Homa Bay', '043'], ['Migori', '044'], ['Kisii', '045'],
      ['Nyamira', '046'], ['Nairobi', '047']
    ];

    for (const [name, code] of kenyanCounties) {
      await db.query('INSERT INTO counties (name, code) VALUES (?, ?)', [name, code]);
    }
    console.log(`Seeded ${kenyanCounties.length} Kenyan counties.`);
  }

  // 2. Seed Business Categories
  const existingCategories = await db.query('SELECT COUNT(*) as cnt FROM business_categories');
  if (existingCategories[0].cnt === 0) {
    const categories = [
      ['Real Estate & Property', 'Land sellers, developers, and property managers'],
      ['Legal Practice & Litigation', 'Law firms, conveyancers, and legal advocates'],
      ['Financial Services & SACCOs', 'Microfinance, SACCOs, and credit societies'],
      ['Agribusiness & Farming', 'Farm produce, livestock, and machinery dealers'],
      ['Professional Services', 'Consultancies, tax advisors, and auditors']
    ];
    for (const [name, desc] of categories) {
      await db.query('INSERT INTO business_categories (name, description) VALUES (?, ?)', [name, desc]);
    }
    console.log('Seeded business categories.');
  }

  // =========================================================================
  // PROFESSION 1: Real Estate & Land Selling Company
  // =========================================================================
  let realEstateTenant = await db.query("SELECT * FROM tenants WHERE slug = 'rift-valley'");
  let landTenantId;
  if (realEstateTenant.length === 0) {
    const tenantRes = await db.query(`
      INSERT INTO tenants (name, slug, domain, kra_pin, plan, industry, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'Rift Valley Land Holdings Ltd',
      'rift-valley',
      'riftvalleyland.co.ke',
      'P051234567Z',
      'enterprise',
      'real_estate',
      'active'
    ]);
    landTenantId = tenantRes.insertId;
  } else {
    landTenantId = realEstateTenant[0].id;
    await db.query("UPDATE tenants SET industry = 'real_estate', name = 'Rift Valley Land Holdings Ltd' WHERE id = ?", [landTenantId]);
  }

  // Real Estate Admin User
  let landUser = await db.query('SELECT * FROM users WHERE email = ?', ['admin@corecrm.co.ke']);
  let landUserId;
  const passwordHash = await bcrypt.hash('Password123!', 10);
  if (landUser.length === 0) {
    const userRes = await db.query(`
      INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      landTenantId,
      'admin@corecrm.co.ke',
      passwordHash,
      'David',
      'Kiprono',
      '+254712345678',
      'admin',
      1
    ]);
    landUserId = userRes.insertId;
  } else {
    landUserId = landUser[0].id;
  }

  // Real estate customer & deals
  let landCust = await db.query('SELECT id FROM customers WHERE tenant_id = ? LIMIT 1', [landTenantId]);
  let landCustId;
  if (landCust.length === 0) {
    const cRes = await db.query(`
      INSERT INTO customers (
        tenant_id, first_name, last_name, email, phone, company_name,
        customer_type, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      landTenantId, 'James', 'Mwangi', 'james.mwangi@email.com', '+254712345690',
      'Mwangi Enterprises Ltd', 'business', 'active',
      'Interested in acquiring 2 plots in Kitengela Acacia Greens Phase 2.', landUserId
    ]);
    landCustId = cRes.insertId;
  } else {
    landCustId = landCust[0].id;
  }

  // Real estate parcels
  const parcelCount = await db.query('SELECT COUNT(*) as cnt FROM parcels WHERE tenant_id = ?', [landTenantId]);
  if (parcelCount[0].cnt === 0) {
    await db.query(`
      INSERT INTO parcels (
        tenant_id, title_ref, plot_number, name, size_acres,
        county, zoning, list_price_kes, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      landTenantId, 'NAIVASHA/BLOCK2/4510', 'Plot 42', 'Longonot Breeze Phase 3', 0.125,
      'Nakuru', 'residential', 1250000, 'available',
      'Ready freehold title deed, water and electricity on site.', landUserId
    ]);
    await db.query(`
      INSERT INTO parcels (
        tenant_id, title_ref, plot_number, name, size_acres,
        county, zoning, list_price_kes, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      landTenantId, 'KAJIADO/KITENGELA/8912', 'Plot 15', 'Acacia Heights Estate', 0.25,
      'Kajiado', 'mixed_use', 2800000, 'reserved',
      '50% deposit paid by James Mwangi. Pending completion.', landUserId
    ]);
  }

  await syncStagesAndSeedDeals(landTenantId, 'real_estate', landCustId, landUserId);

  // =========================================================================
  // PROFESSION 2: Law Firm & Advocates (Legal Practice)
  // =========================================================================
  let legalTenant = await db.query("SELECT * FROM tenants WHERE slug = 'nairobi-advocates'");
  let legalTenantId;
  if (legalTenant.length === 0) {
    const tenantRes = await db.query(`
      INSERT INTO tenants (name, slug, domain, kra_pin, plan, industry, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'Nairobi Advocates & Legal Consultants LLP',
      'nairobi-advocates',
      'nairobilaw.co.ke',
      'P059988776A',
      'enterprise',
      'legal',
      'active'
    ]);
    legalTenantId = tenantRes.insertId;
    console.log(`Created Law Firm tenant 'nairobi-advocates' with ID ${legalTenantId}.`);

    const legalStages = [
      ['Consultation / Intake', 1, 20],
      ['Pleadings & Demand Letter', 2, 40],
      ['Court Filing & Mention', 3, 60],
      ['Hearing & Submissions', 4, 80],
      ['Judgment / Settled', 5, 100],
      ['Withdrawn / Dismissed', 6, 0]
    ];
    for (const [sName, sOrder, sProb] of legalStages) {
      await db.query(`
        INSERT INTO deal_stages (tenant_id, name, order_index, probability)
        VALUES (?, ?, ?, ?)
      `, [legalTenantId, sName, sOrder, sProb]);
    }
  } else {
    legalTenantId = legalTenant[0].id;
    await db.query("UPDATE tenants SET industry = 'legal' WHERE id = ?", [legalTenantId]);
  }

  // Law Firm Admin User
  let legalUser = await db.query('SELECT * FROM users WHERE email = ?', ['counsel@nairobilaw.co.ke']);
  let legalUserId;
  if (legalUser.length === 0) {
    const userRes = await db.query(`
      INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      legalTenantId,
      'counsel@nairobilaw.co.ke',
      passwordHash,
      'Wanjiku',
      'Kamau, SC',
      '+254722556677',
      'admin',
      1
    ]);
    legalUserId = userRes.insertId;
  } else {
    legalUserId = legalUser[0].id;
  }

  // Law Firm Clients
  const legalCustCount = await db.query('SELECT COUNT(*) as cnt FROM customers WHERE tenant_id = ?', [legalTenantId]);
  let legalCustId;
  if (legalCustCount[0].cnt === 0) {
    const cRes = await db.query(`
      INSERT INTO customers (
        tenant_id, first_name, last_name, email, phone, company_name,
        customer_type, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      legalTenantId, 'Karanja', 'Gachagua', 'karanja@gachagua-enterprises.co.ke', '+254711223344',
      'Gachagua Commercial Properties Ltd', 'business', 'active',
      'Commercial tenancy dispute client.', legalUserId
    ]);
    legalCustId = cRes.insertId;

    // Law Firm Legal Matters (Compliant with Constitution of Kenya 2010 Articles 159-170)
    await db.query(`
      INSERT INTO matters (
        tenant_id, client_id, case_number, title, practice_area,
        court_name, court_level, court_station, coram_title, party_role, opposing_role, hearing_purpose,
        judge_or_arbitrator, opposing_party, opposing_counsel,
        billing_type, aro_scale, fee_amount_kes, vat_amount_kes, disbursements_kes, hourly_rate_kes,
        next_hearing_date, filing_deadline, status, assigned_advocate_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      legalTenantId, legalCustId, 'HCCC NO. E098 OF 2026', 'Gachagua Properties Ltd v. Equity Bank Kenya Ltd', 'Commercial Litigation',
      'High Court Commercial & Tax Division', 'Superior Courts of Record (Articles 162-165, CoK 2010)',
      'Milimani Law Courts, Nairobi', 'Hon. Lady Justice Chepkwony, J', 'Plaintiff', 'Defendant',
      'Pre-Trial Conference (Order 11 CPR)', 'Hon. Lady Justice Chepkwony, J',
      'Equity Bank Kenya Ltd', 'Oraro & Company Advocates',
      'fixed_fee', 'Schedule 6 - Litigation (High Court / Subordinate)',
      350000, 56000, 25000, null, '2026-11-20 10:00:00', '2026-11-10',
      'active', legalUserId, 'Pre-trial bundle compliance under Order 11 Civil Procedure Rules.'
    ]);
    await db.query(`
      INSERT INTO matters (
        tenant_id, client_id, case_number, title, practice_area,
        court_name, court_level, court_station, coram_title, party_role, opposing_role, hearing_purpose,
        judge_or_arbitrator, opposing_party, opposing_counsel,
        billing_type, aro_scale, fee_amount_kes, vat_amount_kes, disbursements_kes, hourly_rate_kes,
        next_hearing_date, filing_deadline, status, assigned_advocate_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      legalTenantId, legalCustId, 'ELC NO. E542 OF 2026', 'In the Matter of Title KAJ/KAPUTIEI/1104', 'Conveyancing & Land Law',
      'Environment and Land Court (ELC)', 'Superior Courts of Record (Articles 162-165, CoK 2010)',
      'Kajiado Law Courts', 'Hon. Lady Justice Komingoi, J', 'Ex-Parte Applicant', 'Respondent',
      'Hearing of Interlocutory Application (Notice of Motion)', 'Hon. Lady Justice Komingoi, J',
      'Registrar of Titles & Survey of Kenya', 'State Law Office (Attorney General)',
      'fixed_fee', 'Schedule 1 - Conveyancing, Sales & Purchases',
      450000, 72000, 35000, null, '2026-12-04 09:30:00', '2026-11-25',
      'active', legalUserId, 'Application for temporary injunction restraining alienation of Title KAJ/KAPUTIEI/1104.'
    ]);
    await db.query(`
      INSERT INTO matters (
        tenant_id, client_id, case_number, title, practice_area,
        court_name, court_level, court_station, coram_title, party_role, opposing_role, hearing_purpose,
        judge_or_arbitrator, opposing_party, opposing_counsel,
        billing_type, aro_scale, fee_amount_kes, vat_amount_kes, disbursements_kes, hourly_rate_kes,
        next_hearing_date, filing_deadline, status, assigned_advocate_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      legalTenantId, legalCustId, 'PETITION NO. E112 OF 2026', 'Gachagua & 2 Others v. Attorney General & National Land Commission', 'Constitutional & Judicial Review',
      'High Court Constitutional & Human Rights Division', 'Superior Courts of Record (Articles 162-165, CoK 2010)',
      'Milimani Law Courts, Nairobi', 'Hon. Mr. Justice Mwita, J', 'Petitioner', 'Respondent',
      'Mention for Directions / Compliance (Order 11 CPR)', 'Hon. Mr. Justice Mwita, J',
      'Attorney General & National Land Commission', 'State Law Office',
      'fixed_fee', 'Section 45 Advocates Act - Formal Written Fee Agreement',
      600000, 96000, 15000, null, '2026-11-28 09:00:00', '2026-11-15',
      'active', legalUserId, 'Constitutional petition challenging arbitrary revocation of leasehold title under Art. 40 CoK 2010.'
    ]);

    // Law firm tasks
    await db.query(`
      INSERT INTO tasks (
        tenant_id, title, description, priority, status, due_date, assigned_to, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      legalTenantId, 'Prepare witness statement of Mr. Karanja (Order 11 CPR)',
      'Draft affidavit and index trial bundle for HCCC NO. E098 OF 2026', 'urgent', 'pending',
      '2026-11-12', legalUserId, legalUserId
    ]);
  }

  // Always update existing legal matters to ensure constitutional alignment
  await db.query(`
    UPDATE matters SET
      court_level = 'Superior Courts of Record (Articles 162-165, CoK 2010)',
      court_station = 'Milimani Law Courts, Nairobi',
      party_role = 'Plaintiff',
      opposing_role = 'Defendant',
      hearing_purpose = 'Pre-Trial Conference (Order 11 CPR)',
      aro_scale = 'Schedule 6 - Litigation (High Court / Subordinate)',
      disbursements_kes = 25000,
      vat_amount_kes = 56000
    WHERE tenant_id = ? AND case_number LIKE '%HCCC%'
  `, [legalTenantId]);

  await db.query(`
    UPDATE matters SET
      court_level = 'Superior Courts of Record (Articles 162-165, CoK 2010)',
      court_station = 'Kajiado Law Courts',
      party_role = 'Ex-Parte Applicant',
      opposing_role = 'Respondent',
      hearing_purpose = 'Hearing of Interlocutory Application (Notice of Motion)',
      aro_scale = 'Schedule 1 - Conveyancing, Sales & Purchases',
      disbursements_kes = 35000,
      vat_amount_kes = 72000
    WHERE tenant_id = ? AND case_number LIKE '%ELC%'
  `, [legalTenantId]);

  let legalCust = await db.query('SELECT id FROM customers WHERE tenant_id = ? LIMIT 1', [legalTenantId]);
  legalCustId = legalCustId || legalCust[0]?.id;
  await syncStagesAndSeedDeals(legalTenantId, 'legal', legalCustId, legalUserId);

  // =========================================================================
  // PROFESSION 3: Commercial Core (General SME / Trading / B2B)
  // =========================================================================
  let commercialTenant = await db.query("SELECT * FROM tenants WHERE slug = 'apex-commercial'");
  let commercialTenantId;
  if (commercialTenant.length === 0) {
    const tenantRes = await db.query(`
      INSERT INTO tenants (name, slug, domain, kra_pin, plan, industry, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'Apex Commercial Supplies Ltd',
      'apex-commercial',
      'apexsupplies.co.ke',
      'P051122334K',
      'growth',
      'general',
      'active'
    ]);
    commercialTenantId = tenantRes.insertId;
    console.log(`Created Commercial Core tenant 'apex-commercial' with ID ${commercialTenantId}.`);

    const commercialStages = [
      ['Prospecting & Inbound', 1, 10],
      ['Lead Qualification', 2, 25],
      ['Quotation / Proposal', 3, 50],
      ['Contract Negotiation', 4, 75],
      ['Closed Won / PO Issued', 5, 100],
      ['Closed Lost', 6, 0]
    ];
    for (const [sName, sOrder, sProb] of commercialStages) {
      await db.query(`
        INSERT INTO deal_stages (tenant_id, name, order_index, probability)
        VALUES (?, ?, ?, ?)
      `, [commercialTenantId, sName, sOrder, sProb]);
    }
  } else {
    commercialTenantId = commercialTenant[0].id;
    await db.query("UPDATE tenants SET industry = 'general' WHERE id = ?", [commercialTenantId]);
  }

  // Commercial Core User
  let commercialUser = await db.query('SELECT * FROM users WHERE email = ?', ['director@apexsupplies.co.ke']);
  let commercialUserId;
  if (commercialUser.length === 0) {
    const userRes = await db.query(`
      INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      commercialTenantId,
      'director@apexsupplies.co.ke',
      passwordHash,
      'Kamau',
      'Gitau',
      '+254733445566',
      'admin',
      1
    ]);
    commercialUserId = userRes.insertId;
  } else {
    commercialUserId = commercialUser[0].id;
  }

  // Commercial Core Customers & Deals
  const commercialCustCount = await db.query('SELECT COUNT(*) as cnt FROM customers WHERE tenant_id = ?', [commercialTenantId]);
  if (commercialCustCount[0].cnt === 0) {
    const custRes = await db.query(`
      INSERT INTO customers (
        tenant_id, first_name, last_name, email, phone, company_name,
        customer_type, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      commercialTenantId, 'Sarah', 'Ochieng', 'sarah@fairlane-distributors.co.ke', '+254722889900',
      'Fairlane Wholesale Distributors Ltd', 'business', 'active',
      'Major retail distributor account in Nairobi.', commercialUserId
    ]);
    const custId = custRes.insertId;

    await db.query(`
      INSERT INTO deals (
        tenant_id, title, customer_id, deal_stage_id, assigned_sales_rep_id, value,
        currency, expected_close_date, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      commercialTenantId, 'Annual FMCG Bulk Supply Agreement 2026/27', custId, 4, commercialUserId,
      3450000, 'KES', '2026-11-30',
      'Quarterly delivery schedule, 30-day invoice credit terms.', commercialUserId
    ]);

    await db.query(`
      INSERT INTO deals (
        tenant_id, title, customer_id, deal_stage_id, assigned_sales_rep_id, value,
        currency, expected_close_date, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      commercialTenantId, 'Industrial Cleaning Equipment Supply', custId, 5, commercialUserId,
      1280000, 'KES', '2026-10-15',
      'Closed won and delivered. Payment received via M-Pesa & Bank wire.', commercialUserId
    ]);

    await db.query(`
      INSERT INTO tasks (
        tenant_id, title, description, priority, status, due_date, assigned_to, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      commercialTenantId, 'Dispatch quarterly product catalogue to Fairlane Distributors',
      'Send revised price index and discounts for bulk orders.', 'high', 'pending',
      '2026-11-05', commercialUserId, commercialUserId
    ]);
  }

  let commCust = await db.query('SELECT id FROM customers WHERE tenant_id = ? LIMIT 1', [commercialTenantId]);
  let commCustId = commCust[0]?.id;
  await syncStagesAndSeedDeals(commercialTenantId, 'general', commCustId, commercialUserId);

  console.log('--- Multi-Profession Database Seeding Complete ---');
  console.log('🏢 REAL ESTATE TENANT:');
  console.log('   Company:   Rift Valley Land Holdings Ltd');
  console.log('   Email:     admin@corecrm.co.ke');
  console.log('   Password:  Password123!');
  console.log('   Special:   Sees Land & Plots ONLY (No legal matters)');
  console.log('--------------------------------------------------');
  console.log('⚖️ LAW FIRM TENANT (CoK 2010 & Advocates Act Compliant):');
  console.log('   Company:   Nairobi Advocates & Legal Consultants LLP');
  console.log('   Email:     counsel@nairobilaw.co.ke');
  console.log('   Password:  Password123!');
  console.log('   Special:   Sees Legal Matters & Court Hearings ONLY (No land parcels)');
  console.log('--------------------------------------------------');
  console.log('💼 COMMERCIAL CORE TENANT (Trading & General SME):');
  console.log('   Company:   Apex Commercial Supplies Ltd');
  console.log('   Email:     director@apexsupplies.co.ke');
  console.log('   Password:  Password123!');
  console.log('   Special:   Sees Commercial Deals, Accounts & Leads (No plots, no legal)');
  console.log('--------------------------------------------------');
}

seed().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
