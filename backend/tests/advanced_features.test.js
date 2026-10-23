const request = require('supertest');
const app = require('../server');

describe('Advanced Industry Capabilities: Plot Matrix, Invoices & Debtor Aging, Conveyancing Pipeline', () => {
  let tenant1Token;
  let tenant2Token;
  let parcelId;
  let customerId;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Register Tenant 1
    const res1 = await request(app).post('/api/auth/register').send({
      email: `t1-${suffix}@estate.co.ke`,
      password: 'Password123!',
      firstName: 'Estate',
      lastName: 'Manager',
      phone: `+254700${String(Date.now()).slice(-6)}`,
      role: 'admin',
      tenantName: `Safari Estates ${suffix}`,
      industry: 'real_estate'
    });
    expect(res1.statusCode).toBeLessThan(300);
    tenant1Token = res1.body.data.token;

    // Register Tenant 2 for isolation tests
    const res2 = await request(app).post('/api/auth/register').send({
      email: `t2-${suffix}@estate2.co.ke`,
      password: 'Password123!',
      firstName: 'Other',
      lastName: 'Manager',
      phone: `+254711${String(Date.now()).slice(-6)}`,
      role: 'admin',
      tenantName: `Rival Estates ${suffix}`,
      industry: 'real_estate'
    });
    expect(res2.statusCode).toBeLessThan(300);
    tenant2Token = res2.body.data.token;

    // Create a customer for Tenant 1
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        firstName: 'Karanja',
        lastName: 'Mwangi',
        email: `karanja-${suffix}@buyer.co.ke`,
        phone: '+254712345678',
        companyName: 'Mwangi Holdings'
      });
    expect(custRes.statusCode).toBeLessThan(300);
    customerId = custRes.body.data.customer.id;

    // Create a parcel for Tenant 1
    const parcRes = await request(app)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        titleRef: `KAJ/KITENGELA/${suffix}`,
        plotNumber: 'Plot 44',
        name: 'Acacia Greens Phase 2',
        sizeAcres: 0.125,
        county: 'Kajiado',
        status: 'available',
        listPriceKes: 1500000
      });
    expect(parcRes.statusCode).toBeLessThan(300);
    parcelId = parcRes.body.data.parcel.id;
  });

  describe('1. Plot Matrix State Machine & Timed Reservation Holds', () => {
    it('places a 48h timed hold with Letter of Offer and verifies state change to reserved', async () => {
      // Place hold
      const holdRes = await request(app)
        .post(`/api/parcels/${parcelId}/hold`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          customerId,
          holdDurationHours: 48,
          letterOfOfferRef: 'LOO-2026-TEST-44',
          depositRequiredKes: 150000,
          notes: '48h hold awaiting 10% commitment deposit'
        });

      expect(holdRes.statusCode).toBe(200);
      expect(holdRes.body.success).toBe(true);
      expect(holdRes.body.data.letterOfOfferRef).toBe('LOO-2026-TEST-44');

      // Verify Plot Matrix Overview reflects reserved state and countdown
      const matrixRes = await request(app)
        .get('/api/parcels/matrix/overview')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(matrixRes.statusCode).toBe(200);
      expect(matrixRes.body.data.counts.reserved).toBeGreaterThanOrEqual(1);
      const heldPlot = matrixRes.body.data.parcels.find((p) => p.id === parcelId);
      expect(heldPlot).toBeDefined();
      expect(heldPlot.status).toBe('reserved');
      expect(heldPlot.active_reservation).toBeDefined();
      expect(heldPlot.active_reservation.letter_of_offer_ref).toBe('LOO-2026-TEST-44');

      // Release hold and verify parcel reverts back to available
      const releaseRes = await request(app)
        .post(`/api/parcels/${parcelId}/release-hold`)
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(releaseRes.statusCode).toBe(200);

      const checkRes = await request(app)
        .get(`/api/parcels/${parcelId}`)
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(checkRes.statusCode).toBe(200);
      expect(checkRes.body.data.parcel.status).toBe('available');
    });
  });

  describe('2. Invoices & Debtor Aging with KRA eTIMS', () => {
    it('creates an itemized invoice, calculates 16% VAT, and generates eTIMS CU number', async () => {
      const invRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          customerId,
          invoiceType: 'invoice',
          dueDate: '2026-11-15',
          notes: 'Standard 30-day payment terms',
          items: [
            {
              description: 'Survey & Beacon Re-pegging Fee',
              quantity: 1,
              unitPriceKes: 30000,
              taxRate: 16
            },
            {
              description: 'Land Conveyancing Legal Fee (ARO 2024 scale)',
              quantity: 1,
              unitPriceKes: 70000,
              taxRate: 16
            }
          ]
        });

      expect(invRes.statusCode).toBe(201);
      expect(invRes.body.success).toBe(true);
      const invoice = invRes.body.data.invoice;
      expect(invoice.subtotal_kes).toBe(100000);
      expect(invoice.vat_amount_kes).toBe(16000);
      expect(invoice.total_amount_kes).toBe(116000);
      expect(invoice.etims_cu_number).toMatch(/^KRA-ETIMS-/);

      // Verify Debtor Aging Report endpoint works cleanly
      const agingRes = await request(app)
        .get('/api/invoices/aging/report')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(agingRes.statusCode).toBe(200);
      expect(agingRes.body.data.summary).toHaveProperty('currentKes');
      expect(agingRes.body.data.summary).toHaveProperty('days31to60Kes');
      expect(agingRes.body.data.summary).toHaveProperty('days61to90Kes');
      expect(agingRes.body.data.summary).toHaveProperty('days90PlusKes');
    });
  });

  describe('3. ArdhiSasa Conveyancing Pipeline', () => {
    let conveyancingId;

    it('creates conveyancing matter, updates milestone evidence, and isolates across tenants', async () => {
      // Create conveyancing matter for Tenant 1
      const convRes = await request(app)
        .post('/api/conveyancing')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          parcelId,
          customerId,
          stage: 'search_due_diligence',
          searchRef: 'ARDHI-SRCH-2026-TEST-01',
          lcbBoardName: 'Isinya Sub-County Land Control Board',
          notes: 'ArdhiSasa official digital search lodged'
        });

      expect(convRes.statusCode).toBe(201);
      expect(convRes.body.success).toBe(true);
      conveyancingId = convRes.body.data.matter.id;

      // Advance through milestone: Beacon Verification & Mutation
      const advance1 = await request(app)
        .put(`/api/conveyancing/${conveyancingId}/stage`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          stage: 'beacon_mutation',
          beaconCertNumber: 'SURV-BCN-2026-88',
          mutationFormRef: 'MUT-2026-KAJ-01'
        });

      expect(advance1.statusCode).toBe(200);
      expect(advance1.body.data.matter.stage).toBe('beacon_mutation');
      expect(advance1.body.data.matter.beacon_cert_number).toBe('SURV-BCN-2026-88');

      // Advance to LCB Consent
      const advance2 = await request(app)
        .put(`/api/conveyancing/${conveyancingId}/stage`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          stage: 'lcb_consent',
          lcbConsentRef: 'LCB-CONSENT-2026-8841',
          lcbHearingDate: '2026-11-10'
        });

      expect(advance2.statusCode).toBe(200);
      expect(advance2.body.data.matter.stage).toBe('lcb_consent');
      expect(advance2.body.data.matter.lcb_consent_ref).toBe('LCB-CONSENT-2026-8841');

      // Advance to Title Issuance & Handover
      const advance3 = await request(app)
        .put(`/api/conveyancing/${conveyancingId}/stage`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          stage: 'title_issuance_handover',
          titleDeedNumber: 'KAJ/KITENGELA/DEED-2026-99',
          titleCollectionDate: '2026-11-25'
        });

      expect(advance3.statusCode).toBe(200);
      expect(advance3.body.data.matter.stage).toBe('title_issuance_handover');
      expect(advance3.body.data.matter.title_deed_number).toBe('KAJ/KITENGELA/DEED-2026-99');

      // Tenant Isolation Check: Tenant 2 MUST NOT see Tenant 1 conveyancing files
      const t2Res = await request(app)
        .get('/api/conveyancing')
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(t2Res.statusCode).toBe(200);
      const crossTenantCases = t2Res.body.data.cases.filter((c) => c.id === conveyancingId);
      expect(crossTenantCases.length).toBe(0);
    });
  });
});
