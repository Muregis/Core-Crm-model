const db = require('../src/config/database');

async function seedAdvanced() {
  console.log('--- Seeding Advanced Real Estate & Commercial Core Modules ---');
  if (db.ready) await db.ready;

  // 1. REAL ESTATE PACK (Tenant 1: Rift Valley Land Holdings)
  const realEstateTenant = await db.query("SELECT id FROM tenants WHERE slug = 'rift-valley'");
  if (realEstateTenant.length > 0) {
    const tenantId = realEstateTenant[0].id;
    const landUsers = await db.query('SELECT id FROM users WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const landUserId = landUsers[0]?.id || 1;
    const landCusts = await db.query('SELECT id FROM customers WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const customerId = landCusts[0]?.id || 1;
    const landDeals = await db.query('SELECT id FROM deals WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const dealId = landDeals[0]?.id || 1;

    // A. Update existing parcels with project names
    await db.query("UPDATE parcels SET project_name = 'Longonot Breeze Phase 3' WHERE tenant_id = ? AND title_ref LIKE '%NAIVASHA%'", [tenantId]);
    await db.query("UPDATE parcels SET project_name = 'Acacia Heights Estate Phase 2' WHERE tenant_id = ? AND title_ref LIKE '%KAJIADO%'", [tenantId]);

    // B. Add more plots to create a visual estate grid matrix
    const countParcels = await db.query('SELECT COUNT(*) as cnt FROM parcels WHERE tenant_id = ?', [tenantId]);
    if (countParcels[0].cnt < 8) {
      const extraPlots = [
        ['Acacia Heights Estate Phase 2', 'KAJIADO/KITENGELA/8913', 'Plot 16', 'Prime Corner 1/8th Acre', 0.125, 'Kajiado', 'residential', 1650000, 'available'],
        ['Acacia Heights Estate Phase 2', 'KAJIADO/KITENGELA/8914', 'Plot 17', 'Acacia Front Row Plot', 0.125, 'Kajiado', 'residential', 1700000, 'available'],
        ['Acacia Heights Estate Phase 2', 'KAJIADO/KITENGELA/8915', 'Plot 18', 'Acacia Commercial Frontage', 0.25, 'Kajiado', 'commercial', 3200000, 'sold'],
        ['Acacia Heights Estate Phase 2', 'KAJIADO/KITENGELA/8916', 'Plot 19', 'Standard Residential 1/8th', 0.125, 'Kajiado', 'residential', 1500000, 'available'],
        ['Longonot Breeze Phase 3', 'NAIVASHA/BLOCK2/4511', 'Plot 43', 'Scenic Valley View 1/4 Acre', 0.25, 'Nakuru', 'residential', 1950000, 'reserved'],
        ['Longonot Breeze Phase 3', 'NAIVASHA/BLOCK2/4512', 'Plot 44', 'Corner Highway Lot', 0.5, 'Nakuru', 'commercial', 3800000, 'available']
      ];

      for (const [proj, title, plotNo, name, size, county, zoning, price, status] of extraPlots) {
        await db.query(
          `INSERT INTO parcels (
            tenant_id, project_name, title_ref, plot_number, name, size_acres,
            county, zoning, list_price_kes, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, proj, title, plotNo, name, size, county, zoning, price, status, landUserId]
        );
      }
      console.log('Seeded extra plots for estate grid matrix.');
    }

    // C. Seed Plot Reservation with active timed hold (48h)
    const plot15Rows = await db.query("SELECT id FROM parcels WHERE tenant_id = ? AND plot_number = 'Plot 15' LIMIT 1", [tenantId]);
    if (plot15Rows.length > 0) {
      const p15Id = plot15Rows[0].id;
      const expiresAt = new Date(Date.now() + 38 * 3600 * 1000).toISOString(); // 38 hours remaining
      await db.query("DELETE FROM parcel_reservations WHERE parcel_id = ?", [p15Id]);
      await db.query(
        `INSERT INTO parcel_reservations (
          tenant_id, parcel_id, customer_id, deal_id, letter_of_offer_ref,
          hold_duration_hours, expires_at, status, deposit_required_kes, notes, created_by
        ) VALUES (?, ?, ?, ?, 'LOO-2026-KIT15', 48, ?, 'active_hold', 280000, 'Letter of Offer signed by James Mwangi. Pending initial M-Pesa deposit.', ?)`,
        [tenantId, p15Id, customerId, dealId, expiresAt, landUserId]
      );
      await db.query("UPDATE parcels SET status = 'reserved', reservation_expires_at = ? WHERE id = ?", [expiresAt, p15Id]);
      console.log('Seeded active 48-hour reservation hold for Plot 15.');
    }

    // D. Seed "Lipa Mdogo Mdogo" Deal Installments
    const instCount = await db.query('SELECT COUNT(*) as cnt FROM deal_installments WHERE tenant_id = ?', [tenantId]);
    if (instCount[0].cnt === 0) {
      const installments = [
        [1, '10% Commitment Deposit', '2026-10-10', 185000, 185000, 'paid', 'QKD7289192'],
        [2, '1st Monthly Installment', '2026-11-10', 333000, 0, 'pending', null],
        [3, '2nd Monthly Installment', '2026-12-10', 333000, 0, 'pending', null],
        [4, '3rd Monthly Installment', '2027-01-10', 333000, 0, 'pending', null],
        [5, '4th Monthly Installment', '2027-02-10', 333000, 0, 'pending', null],
        [6, 'Final Title Completion (Balance)', '2027-03-10', 333000, 0, 'pending', null]
      ];

      for (const [num, title, due, amt, paid, stat, rec] of installments) {
        await db.query(
          `INSERT INTO deal_installments (
            tenant_id, deal_id, customer_id, installment_number, title,
            due_date, amount_kes, paid_amount_kes, status, mpesa_receipt_number, paid_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, dealId, customerId, num, title, due, amt, paid, stat, rec, paid ? '2026-10-10 14:32:00' : null]
        );
      }
      console.log('Seeded Lipa Mdogo Mdogo installment schedule.');
    }

    // E. Seed ArdhiSasa & Land Conveyancing Cases
    const convCount = await db.query('SELECT COUNT(*) as cnt FROM conveyancing_matters WHERE tenant_id = ?', [tenantId]);
    if (convCount[0].cnt === 0) {
      await db.query(
        `INSERT INTO conveyancing_matters (
          tenant_id, deal_id, parcel_id, customer_id, stage,
          search_ref, search_status, beacon_cert_number, mutation_form_ref,
          lcb_board_name, lcb_hearing_date, lcb_consent_ref,
          valuation_amount_kes, stamp_duty_amount_kes, notes
        ) VALUES (?, ?, ?, ?, 'lcb_consent', 'ARDHI-SRCH-2026-8812', 'verified', 'BC-SURV-KIT901', 'MUT-SURV-4410', 'Isinya Sub-County Land Control Board', '2026-11-18', 'LCB-APPL-2026-90', 2800000, 56000, 'Board hearing scheduled for 3rd Tuesday of November at Isinya Sub-County HQ.')`,
        [tenantId, dealId, plot15Rows[0]?.id || 1, customerId]
      );

      const p42 = await db.query("SELECT id FROM parcels WHERE tenant_id = ? AND title_ref LIKE '%NAIVASHA%' LIMIT 1", [tenantId]);
      if (p42.length > 0) {
        await db.query(
          `INSERT INTO conveyancing_matters (
            tenant_id, deal_id, parcel_id, customer_id, stage,
            search_ref, search_status, beacon_cert_number,
            valuation_amount_kes, stamp_duty_amount_kes, title_deed_number, notes
          ) VALUES (?, ?, ?, ?, 'stamp_duty_valuation', 'ARDHI-SRCH-NAI-3301', 'verified', 'BC-NAIV-12', 1250000, 25000, 'PENDING-ARDHI-ISSUE', 'Valuation completed by Chief Government Valuer. Awaiting KRA stamp duty slip generation.')`,
          [tenantId, dealId, p42[0].id, customerId]
        );
      }
      console.log('Seeded ArdhiSasa conveyancing pipeline cases.');
    }
  }

  // 2. COMMERCIAL CORE PACK (Tenant 3: Apex Commercial Supplies)
  const commercialTenant = await db.query("SELECT id FROM tenants WHERE slug = 'apex-commercial'");
  if (commercialTenant.length > 0) {
    const tenantId = commercialTenant[0].id;
    const commUsers = await db.query('SELECT id FROM users WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const commUserId = commUsers[0]?.id || 1;
    const commCusts = await db.query('SELECT id FROM customers WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const customerId = commCusts[0]?.id || 1;
    const commDeals = await db.query('SELECT id FROM deals WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const dealId = commDeals[0]?.id || 1;

    // A. Seed Product Catalog
    const prodCount = await db.query('SELECT COUNT(*) as cnt FROM products WHERE tenant_id = ?', [tenantId]);
    if (prodCount[0].cnt === 0) {
      const catalog = [
        ['Industrial Heavy-Duty Pressure Washer 3000 PSI', 'IND-WSH-3000', 'Cleaning Equipment', 'unit', 85000, 58000, 16.0, 14],
        ['Eco-Green Commercial Disinfectant (200L Drum)', 'CHM-DSF-200L', 'Chemicals & Sanitation', 'drum', 32000, 20000, 16.0, 40],
        ['Automatic Ride-On Floor Scrubber & Dryer', 'MCH-SCRUB-01', 'Industrial Machinery', 'unit', 240000, 175000, 16.0, 5],
        ['Hydraulic Pallet Hand Stacker (2.5 Ton)', 'LOG-PLT-25T', 'Material Handling', 'unit', 48000, 34000, 16.0, 22],
        ['Annual Preventive Maintenance SLA (Tier 1)', 'SRV-SLA-T1', 'Technical Services', 'annual_contract', 120000, 40000, 16.0, 999]
      ];

      for (const [name, sku, cat, unit, price, cost, tax, stock] of catalog) {
        await db.query(
          `INSERT INTO products (
            tenant_id, name, sku, category, unit, unit_price_kes,
            cost_price_kes, tax_rate, stock_quantity, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [tenantId, name, sku, cat, unit, price, cost, tax, stock]
        );
      }
      console.log('Seeded commercial product catalog.');
    }

    // B. Seed Invoices with KRA eTIMS & Debtor Aging
    const invCount = await db.query('SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = ?', [tenantId]);
    if (invCount[0].cnt === 0) {
      // Invoice 1: Partially paid, overdue by 18 days (0-30 days bucket)
      const inv1 = await db.query(
        `INSERT INTO invoices (
          tenant_id, customer_id, deal_id, invoice_number, etims_cu_number,
          invoice_type, issue_date, due_date, subtotal_kes, vat_amount_kes,
          total_amount_kes, amount_paid_kes, status, notes, qr_code_data, created_by
        ) VALUES (?, ?, ?, 'INV-2026-0001', 'KRA-ETIMS-047-FLN01-98A', 'invoice', '2026-09-15', '2026-10-05', 320000, 51200, 371200, 100000, 'partial', '30-day corporate credit facility. KES 100k received via M-Pesa.', 'KRA-ETIMS|INV:INV-2026-0001|CU:KRA-ETIMS-047-FLN01-98A|TOTAL:371200|VAT:51200', ?)`,
        [tenantId, customerId, dealId, commUserId]
      );
      const inv1Id = inv1.insertId;

      await db.query(
        `INSERT INTO invoice_items (tenant_id, invoice_id, item_description, quantity, unit_price_kes, tax_rate, total_kes)
         VALUES (?, ?, 'Eco-Green Commercial Disinfectant (200L Drum)', 10, 32000, 16.0, 371200)`,
        [tenantId, inv1Id]
      );

      // Invoice 2: Unpaid, overdue by 48 days (31-60 days bucket)
      const inv2 = await db.query(
        `INSERT INTO invoices (
          tenant_id, customer_id, deal_id, invoice_number, etims_cu_number,
          invoice_type, issue_date, due_date, subtotal_kes, vat_amount_kes,
          total_amount_kes, amount_paid_kes, status, notes, qr_code_data, created_by
        ) VALUES (?, ?, ?, 'INV-2026-0002', 'KRA-ETIMS-047-FLN02-44B', 'invoice', '2026-08-10', '2026-09-05', 480000, 76800, 556800, 0, 'sent', 'Warehouse pallet stacker delivery. Outstanding payment reminder dispatched.', 'KRA-ETIMS|INV:INV-2026-0002|CU:KRA-ETIMS-047-FLN02-44B|TOTAL:556800|VAT:76800', ?)`,
        [tenantId, customerId, dealId, commUserId]
      );
      const inv2Id = inv2.insertId;

      await db.query(
        `INSERT INTO invoice_items (tenant_id, invoice_id, item_description, quantity, unit_price_kes, tax_rate, total_kes)
         VALUES (?, ?, 'Hydraulic Pallet Hand Stacker (2.5 Ton)', 10, 48000, 16.0, 556800)`,
        [tenantId, inv2Id]
      );

      // Invoice 3: Itemized Quotation
      const qt1 = await db.query(
        `INSERT INTO invoices (
          tenant_id, customer_id, deal_id, invoice_number, etims_cu_number,
          invoice_type, issue_date, due_date, subtotal_kes, vat_amount_kes,
          total_amount_kes, amount_paid_kes, status, notes, qr_code_data, created_by
        ) VALUES (?, ?, ?, 'QT-2026-0001', 'KRA-ETIMS-QUOTATION-PRE', 'quote', '2026-10-20', '2026-11-20', 540000, 86400, 626400, 0, 'sent', 'Formal tender quotation for Q4 industrial cleaning equipment.', 'KRA-ETIMS-QUOTE', ?)`,
        [tenantId, customerId, dealId, commUserId]
      );
      const qt1Id = qt1.insertId;

      await db.query(
        `INSERT INTO invoice_items (tenant_id, invoice_id, item_description, quantity, unit_price_kes, tax_rate, total_kes)
         VALUES (?, ?, 'Automatic Ride-On Floor Scrubber & Dryer', 2, 240000, 16.0, 556800)`,
        [tenantId, qt1Id]
      );
      await db.query(
        `INSERT INTO invoice_items (tenant_id, invoice_id, item_description, quantity, unit_price_kes, tax_rate, total_kes)
         VALUES (?, ?, 'Eco-Green Commercial Disinfectant (200L Drum)', 2, 30000, 16.0, 69600)`,
        [tenantId, qt1Id]
      );

      console.log('Seeded KRA eTIMS invoices with 16% VAT and Debtor Aging data.');
    }
  }

  console.log('--- Advanced Seeding Complete ---');
}

seedAdvanced().then(() => process.exit(0)).catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
