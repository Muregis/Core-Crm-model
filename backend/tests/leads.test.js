const request = require('supertest');
const app = require('../server');

describe('Leads API & Tenant Isolation', () => {
  let tenant1AdminToken;
  let tenant2AdminToken;
  let tenant1SalesRepToken;
  let tenant1Lead;

  beforeEach(async () => {
    // 1. Tenant 1 Admin
    const res1 = await request(app).post('/api/auth/register').send({
      email: 'leadadmin1@tenant1.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'One',
      phone: '+254711000001',
      role: 'admin',
      tenantName: 'Tenant One'
    });
    tenant1AdminToken = res1.body.data.token;

    // 2. Tenant 2 Admin
    const res2 = await request(app).post('/api/auth/register').send({
      email: 'leadadmin2@tenant2.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'Two',
      phone: '+254722000002',
      role: 'admin',
      tenantName: 'Tenant Two'
    });
    tenant2AdminToken = res2.body.data.token;

    // 3. Tenant 1 Sales Rep
    const resRep = await request(app).post('/api/auth/register').send({
      email: 'leadrep@tenant1.com',
      password: 'password123',
      firstName: 'Rep',
      lastName: 'One',
      phone: '+254733000003',
      role: 'sales_rep',
      tenantName: 'Tenant One'
    });
    tenant1SalesRepToken = resRep.body.data.token;

    // Create a lead in Tenant 1
    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${tenant1AdminToken}`)
      .send({
        firstName: 'Alice',
        lastName: 'Wambui',
        email: 'alice@wambui.co.ke',
        phone: '+254712345678',
        companyName: 'Wambui Supplies',
        source: 'website',
        status: 'new'
      });
    tenant1Lead = leadRes.body.data.lead;
  });

  describe('Lead CRUD', () => {
    it('should create a lead successfully', async () => {
      const res = await request(app)
        .post('/api/leads')
        .set('Authorization', `Bearer ${tenant1AdminToken}`)
        .send({
          firstName: 'Bob',
          lastName: 'Otieno',
          email: 'bob@otieno.com',
          phone: '+254722334455',
          companyName: 'Otieno Tech',
          source: 'referral'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lead.first_name).toBe('Bob');
    });

    it('should reject invalid lead phone format', async () => {
      const res = await request(app)
        .post('/api/leads')
        .set('Authorization', `Bearer ${tenant1AdminToken}`)
        .send({
          firstName: 'Bad',
          lastName: 'Phone',
          phone: '0712345678'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('should list leads for current tenant', async () => {
      const res = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${tenant1AdminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.leads.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Tenant Isolation', () => {
    it('Tenant 2 should NOT see Tenant 1 leads', async () => {
      const res = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${tenant2AdminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.leads.length).toBe(0);
    });

    it('Tenant 2 should NOT get Tenant 1 lead by ID', async () => {
      const res = await request(app)
        .get(`/api/leads/${tenant1Lead.id}`)
        .set('Authorization', `Bearer ${tenant2AdminToken}`);

      expect(res.statusCode).toEqual(404);
    });

    it('Tenant 2 should NOT delete Tenant 1 lead', async () => {
      const res = await request(app)
        .delete(`/api/leads/${tenant1Lead.id}`)
        .set('Authorization', `Bearer ${tenant2AdminToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('RBAC & Conversion', () => {
    it('sales_rep cannot delete a lead (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/leads/${tenant1Lead.id}`)
        .set('Authorization', `Bearer ${tenant1SalesRepToken}`);

      expect(res.statusCode).toEqual(403);
    });

    it('should convert lead to customer', async () => {
      const res = await request(app)
        .post(`/api/leads/${tenant1Lead.id}/convert`)
        .set('Authorization', `Bearer ${tenant1AdminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customerId).toBeDefined();

      // Check lead status is now converted
      const leadCheck = await request(app)
        .get(`/api/leads/${tenant1Lead.id}`)
        .set('Authorization', `Bearer ${tenant1AdminToken}`);

      expect(leadCheck.body.data.lead.status).toBe('converted');
    });
  });
});
