const request = require('supertest');
const app = require('../server');

describe('Sprint 1 & Sprint 2 Industry Upgrades', () => {
  let tenant1Token;
  let customerId;
  let dealId;
  let parcelId;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Register Tenant 1
    const res1 = await request(app).post('/api/auth/register').send({
      email: `t1-sprints-${suffix}@estate.co.ke`,
      password: 'password123',
      firstName: 'Sprint',
      lastName: 'Manager',
      phone: `+254711${String(Date.now()).slice(-6)}`,
      role: 'admin',
      tenantName: `Sprint Enterprise ${suffix}`
    });
    expect(res1.statusCode).toBeLessThan(300);
    tenant1Token = res1.body.data.token;

    // Create Customer
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        firstName: 'Daniel',
        lastName: 'Kariuki',
        phone: '+254712000111',
        email: `daniel-${suffix}@investor.co.ke`
      });
    expect(custRes.statusCode).toBe(201);
    customerId = custRes.body.data.customer.id;

    // Create Land Parcel
    const parcelRes = await request(app)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        titleRef: `NAI/BLOCK-88/${suffix}`,
        plotNumber: 'Plot #42',
        projectName: 'Juja Ridge Phase 2',
        sizeAcres: 0.125,
        listPriceKes: 1500000,
        status: 'available'
      });
    expect(parcelRes.statusCode).toBe(201);
    parcelId = parcelRes.body.data.parcel.id;

    // Create Deal
    const dealRes = await request(app)
      .post('/api/deals')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        title: 'Purchase of Plot #42 Juja Ridge',
        customerId,
        value: 1500000,
        stage: 'negotiation'
      });
    expect(dealRes.statusCode).toBe(201);
    dealId = dealRes.body.data.deal.id;
  });

  describe('Sprint 1: Commercial Core (Products, Quotes, Convert to Invoice)', () => {
    it('creates product in catalog and lists with KES pricing', async () => {
      const prodRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          name: 'Solar Inverter 5KVA',
          sku: 'INV-5KVA-TEST',
          category: 'Solar Equipment',
          unitPriceKes: 85000,
          costPriceKes: 65000,
          taxRate: 16.0,
          stockQuantity: 10
        });

      expect(prodRes.statusCode).toBe(201);
      expect(prodRes.body.success).toBe(true);
      expect(prodRes.body.data.product.sku).toBe('INV-5KVA-TEST');

      const listRes = await request(app)
        .get('/api/products?search=INV-5KVA')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(listRes.statusCode).toBe(200);
      expect(listRes.body.data.products.length).toBeGreaterThanOrEqual(1);
    });

    it('generates an official Quotation and converts it into a KRA eTIMS Tax Invoice', async () => {
      // 1. Create Quote
      const quoteRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          customerId,
          dealId,
          invoiceType: 'quote',
          items: [
            { itemDescription: 'Solar Inverter 5KVA', quantity: 1, unitPriceKes: 85000, taxRate: 16.0 }
          ]
        });

      expect(quoteRes.statusCode).toBe(201);
      expect(quoteRes.body.data.invoice.invoice_type).toBe('quote');
      expect(quoteRes.body.data.invoice.invoice_number).toMatch(/^QT-/);
      const quoteId = quoteRes.body.data.invoice.id;

      // 2. Convert Quote to Tax Invoice
      const convertRes = await request(app)
        .post(`/api/invoices/${quoteId}/convert-to-invoice`)
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(convertRes.statusCode).toBe(200);
      expect(convertRes.body.success).toBe(true);
      expect(convertRes.body.data.invoice.invoice_type).toBe('invoice');
      expect(convertRes.body.data.invoice.invoice_number).toMatch(/^INV-/);
      expect(convertRes.body.data.invoice.etims_cu_number).toBeDefined();
    });
  });

  describe('Sprint 2: Real Estate Upgrades (Lipa Mdogo Mdogo & Saturday Site Visits)', () => {
    it('generates Lipa Mdogo Mdogo milestone schedule and matches M-Pesa receipt', async () => {
      // 1. Generate 4-milestone plan
      const planRes = await request(app)
        .post('/api/parcels/installments/plan')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          dealId,
          parcelId,
          customerId,
          totalAmountKes: 1500000
        });

      expect(planRes.statusCode).toBe(201);
      expect(planRes.body.data.installments.length).toBe(4);
      const depositMilestone = planRes.body.data.installments[0];
      expect(depositMilestone.amountKes).toBe(150000); // 10%

      // 2. Auto-match M-Pesa transaction
      const matchRes = await request(app)
        .post(`/api/parcels/installments/${depositMilestone.id}/match-mpesa`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          mpesaReceiptNumber: 'QHK99120KL',
          amountPaidKes: 150000
        });

      expect(matchRes.statusCode).toBe(200);
      expect(matchRes.body.message).toContain('QHK99120KL');

      // 3. Verify in installment list
      const listRes = await request(app)
        .get(`/api/parcels/installments/list?dealId=${dealId}`)
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(listRes.statusCode).toBe(200);
      const paidItem = listRes.body.data.installments.find((i) => i.id === depositMilestone.id);
      expect(paidItem.status).toBe('paid');
      expect(paidItem.mpesa_receipt_number).toBe('QHK99120KL');
    });

    it('schedules a Saturday Convoy and books passenger seats', async () => {
      // 1. Schedule Convoy
      const convoyRes = await request(app)
        .post('/api/parcels/site-visits')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          projectName: 'Juja Ridge Phase 2',
          visitDate: '2026-10-31',
          departureTime: '09:00 AM',
          departureLocation: 'Kencom House, CBD',
          totalSeats: 33,
          driverName: 'Kamau Driver',
          driverPhone: '+254722111222'
        });

      expect(convoyRes.statusCode).toBe(201);
      const convoyId = convoyRes.body.data.id;

      // 2. Book Passenger Seats
      const bookRes = await request(app)
        .post(`/api/parcels/site-visits/${convoyId}/book`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          customerId,
          visitorName: 'Daniel Kariuki & Spouse',
          visitorPhone: '+254712000111',
          seatsBooked: 2,
          pickupPoint: 'Kencom House, CBD',
          notes: 'Corner plot beacon inspection'
        });

      expect(bookRes.statusCode).toBe(201);

      // 3. List Convoys and verify booked manifest
      const listRes = await request(app)
        .get('/api/parcels/site-visits/list')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(listRes.statusCode).toBe(200);
      const foundConvoy = listRes.body.data.siteVisits.find((v) => v.id === convoyId);
      expect(foundConvoy).toBeDefined();
      expect(foundConvoy.total_booked_passengers).toBe(2);
      expect(foundConvoy.availableSeats).toBe(31);
      expect(foundConvoy.passengerManifest.length).toBe(1);
    });
  });
});
