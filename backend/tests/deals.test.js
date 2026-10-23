const request = require('supertest');
const app = require('../server');

describe('Deals API & Tenant Isolation', () => {
  let tenant1AdminToken;
  let tenant2AdminToken;
  let tenant1SalesRepToken;
  let tenant1Customer;
  let tenant1Deal;

  beforeEach(async () => {
    // 1. Tenant 1 Admin
    const res1 = await request(app).post('/api/auth/register').send({
      email: 'dealadmin1@tenant1.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'One',
      phone: '+254711999991',
      role: 'admin',
      tenantName: 'Tenant One'
    });
    tenant1AdminToken = res1.body.data.token;

    // 2. Tenant 2 Admin
    const res2 = await request(app).post('/api/auth/register').send({
      email: 'dealadmin2@tenant2.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'Two',
      phone: '+254722999992',
      role: 'admin',
      tenantName: 'Tenant Two'
    });
    tenant2AdminToken = res2.body.data.token;

    // 3. Tenant 1 Sales Rep
    const resRep = await request(app).post('/api/auth/register').send({
      email: 'dealrep@tenant1.com',
      password: 'password123',
      firstName: 'Rep',
      lastName: 'One',
      phone: '+254733999993',
      role: 'sales_rep',
      tenantName: 'Tenant One'
    });
    tenant1SalesRepToken = resRep.body.data.token;

    // Create a customer in Tenant 1
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tenant1AdminToken}`)
      .send({
        firstName: 'Kamau',
        lastName: 'Mwangi',
        email: 'kamau@mwangi.co.ke',
        phone: '+254701234567'
      });
    tenant1Customer = custRes.body.data.customer;

    // Create a deal in Tenant 1
    const dealRes = await request(app)
      .post('/api/deals')
      .set('Authorization', `Bearer ${tenant1AdminToken}`)
      .send({
        title: 'ERP Integration Contract',
        customerId: tenant1Customer.id,
        value: 450000.00,
        currency: 'KES',
        dealStageId: 1
      });
    tenant1Deal = dealRes.body.data.deal;
  });

  describe('Deal CRUD & Multi-Tenancy Validation', () => {
    it('should create deal successfully', async () => {
      const res = await request(app)
        .post('/api/deals')
        .set('Authorization', `Bearer ${tenant1AdminToken}`)
        .send({
          title: 'CRM Support Retainer',
          customerId: tenant1Customer.id,
          value: 120000.00,
          currency: 'KES'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deal.title).toBe('CRM Support Retainer');
    });

    it('Tenant 2 should NOT be able to create deal for Tenant 1 customer', async () => {
      const res = await request(app)
        .post('/api/deals')
        .set('Authorization', `Bearer ${tenant2AdminToken}`)
        .send({
          title: 'Cross Tenant Deal Attempt',
          customerId: tenant1Customer.id,
          value: 50000.00
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('should list deals for current tenant', async () => {
      const res = await request(app)
        .get('/api/deals')
        .set('Authorization', `Bearer ${tenant1AdminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.deals.length).toBeGreaterThanOrEqual(1);
    });

    it('should fetch deal stages for current tenant at /api/deals/stages', async () => {
      const res = await request(app)
        .get('/api/deals/stages')
        .set('Authorization', `Bearer ${tenant1AdminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.stages)).toBe(true);
      expect(res.body.data.stages.length).toBeGreaterThan(0);
    });

    it('should update deal stage via /api/deals/:id/stage', async () => {
      const stagesRes = await request(app)
        .get('/api/deals/stages')
        .set('Authorization', `Bearer ${tenant1AdminToken}`);
      const stages = stagesRes.body.data.stages;
      const targetStage = stages.length > 1 ? stages[1].id : 2;

      const res = await request(app)
        .put(`/api/deals/${tenant1Deal.id}/stage`)
        .set('Authorization', `Bearer ${tenant1AdminToken}`)
        .send({ stageId: targetStage });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deal.deal_stage_id).toBe(targetStage);
    });
  });

  describe('Tenant Isolation for Deals', () => {
    it('Tenant 2 should NOT see Tenant 1 deals', async () => {
      const res = await request(app)
        .get('/api/deals')
        .set('Authorization', `Bearer ${tenant2AdminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.deals.length).toBe(0);
    });

    it('Tenant 2 should NOT get Tenant 1 deal by ID', async () => {
      const res = await request(app)
        .get(`/api/deals/${tenant1Deal.id}`)
        .set('Authorization', `Bearer ${tenant2AdminToken}`);

      expect(res.statusCode).toEqual(404);
    });

    it('Tenant 2 should NOT update Tenant 1 deal', async () => {
      const res = await request(app)
        .put(`/api/deals/${tenant1Deal.id}`)
        .set('Authorization', `Bearer ${tenant2AdminToken}`)
        .send({
          title: 'Hacked Deal'
        });

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('RBAC Authorization', () => {
    it('sales_rep cannot delete a deal (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/deals/${tenant1Deal.id}`)
        .set('Authorization', `Bearer ${tenant1SalesRepToken}`);

      expect(res.statusCode).toEqual(403);
    });

    it('admin can delete a deal', async () => {
      const res = await request(app)
        .delete(`/api/deals/${tenant1Deal.id}`)
        .set('Authorization', `Bearer ${tenant1AdminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });
});
