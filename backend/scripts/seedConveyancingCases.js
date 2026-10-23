const db = require('../src/config/database');

async function seed() {
  try {
    console.log('Seeding ArdhiSasa conveyancing pipeline cases for tenant 1...');
    await db.query('DELETE FROM conveyancing_matters WHERE tenant_id = 1');

    const cases = [
      {
        tenant_id: 1,
        parcel_id: 3, // Plot 16
        customer_id: 1, // James Mwangi
        stage: 'search_due_diligence',
        search_ref: 'ARDHI-SRCH-2026-9041',
        search_status: 'verified_clean',
        notes: 'ArdhiSasa official digital search completed. Green Card inspected at Kajiado Lands Registry with nil encumbrances.'
      },
      {
        tenant_id: 1,
        parcel_id: 4, // Plot 17
        customer_id: 2, // Faith Wanjiku
        stage: 'beacon_mutation',
        search_ref: 'ARDHI-SRCH-2026-9042',
        search_status: 'verified_clean',
        beacon_cert_number: 'SURV-BCN-KAJ-2026-104',
        mutation_form_ref: 'MUT-2026-KAJ-098',
        notes: 'Physical beacons re-pegged and certified intact by Licensed Surveyor J. Kariuki. Mutation form lodged.'
      },
      {
        tenant_id: 1,
        parcel_id: 2, // Plot 15
        customer_id: 1, // James Mwangi
        stage: 'lcb_consent',
        search_ref: 'ARDHI-SRCH-2026-8812',
        search_status: 'verified_clean',
        beacon_cert_number: 'SURV-BCN-KAJ-2026-088',
        mutation_form_ref: 'MUT-2026-KAJ-074',
        lcb_board_name: 'Isinya Sub-County Land Control Board',
        lcb_hearing_date: '2026-11-04',
        lcb_consent_ref: 'LCB-CONSENT-2026-081',
        notes: 'Statutory application under Land Control Act (Cap 302). Board sitting hearing scheduled.'
      },
      {
        tenant_id: 1,
        parcel_id: 1, // Plot 42
        customer_id: 2, // Faith Wanjiku
        stage: 'stamp_duty_valuation',
        search_ref: 'ARDHI-SRCH-NAI-3301',
        search_status: 'verified_clean',
        lcb_board_name: 'Naivasha Sub-County Land Control Board',
        lcb_consent_ref: 'LCB-NAI-2026-019',
        valuation_amount_kes: 1800000,
        stamp_duty_amount_kes: 72000,
        cgt_clearance_ref: 'KRA-CGT-2026-8819',
        notes: 'Government Valuer inspection complete. 4% stamp duty assessed and paid via KRA eTIMS. Awaiting Lands Registry endorsement.'
      },
      {
        tenant_id: 1,
        parcel_id: 5, // Plot 18
        customer_id: 1, // James Mwangi
        stage: 'title_issuance_handover',
        search_ref: 'ARDHI-SRCH-2026-8201',
        search_status: 'verified_clean',
        lcb_board_name: 'Isinya Sub-County Land Control Board',
        lcb_consent_ref: 'LCB-CONSENT-2026-022',
        valuation_amount_kes: 2200000,
        stamp_duty_amount_kes: 88000,
        cgt_clearance_ref: 'KRA-CGT-2026-7201',
        title_deed_number: 'KAJIADO/KITENGELA/8915-DEED',
        title_collection_date: '2026-10-20',
        notes: 'Official Title Deed registered and collected from Kajiado Lands Registry. Formally handed over to James Mwangi.'
      }
    ];

    for (const c of cases) {
      await db.query(
        `INSERT INTO conveyancing_matters (
          tenant_id, parcel_id, customer_id, stage, search_ref,
          search_status, beacon_cert_number, mutation_form_ref,
          lcb_board_name, lcb_hearing_date, lcb_consent_ref,
          valuation_amount_kes, stamp_duty_amount_kes, cgt_clearance_ref,
          title_deed_number, title_collection_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.tenant_id, c.parcel_id, c.customer_id, c.stage, c.search_ref,
          c.search_status, c.beacon_cert_number || null, c.mutation_form_ref || null,
          c.lcb_board_name || null, c.lcb_hearing_date || null, c.lcb_consent_ref || null,
          c.valuation_amount_kes || null, c.stamp_duty_amount_kes || null, c.cgt_clearance_ref || null,
          c.title_deed_number || null, c.title_collection_date || null, c.notes
        ]
      );
    }

    console.log('Successfully seeded 5 complete ArdhiSasa conveyancing pipeline cases for tenant 1.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding conveyancing cases:', err);
    process.exit(1);
  }
}

seed();
