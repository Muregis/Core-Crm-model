const request = require('supertest');
const app = require('../server');

describe('Customer Endpoints & Tenant Isolation', () => {
  let tenant1Token;
  let tenant2Token;
  let tenant1SalesRepToken;
  let tenant1Customer;

  beforeEach(async () => {
    // 1. Register Tenant 1 Admin
    const res1 = await request(app).post('/api/auth/register').send({
      email: 'admin1@tenant1.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'One',
      phone: '+254711111111',
      role: 'admin',
      tenantName: 'Tenant One'
    });
    tenant1Token = res1.body.data.token;

    // 2. Register Tenant 2 Admin
    const res2 = await request(app).post('/api/auth/register').send({
      email: 'admin2@tenant2.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'Two',
      phone: '+254722222222',
      role: 'admin',
      tenantName: 'Tenant Two'
    });
    tenant2Token = res2.body.data.token;

    // 3. Register Sales Rep for Tenant 1 (role: sales_rep)
    const resRep = await request(app).post('/api/auth/register').send({
      email: 'rep@tenant1.com',
      password: 'password123',
      firstName: 'Rep',
      lastName: 'One',
      phone: '+254733333333',
      role: 'sales_rep',
      tenantName: 'Tenant One'
    });
    tenant1SalesRepToken = resRep.body.data.token;

    // Create a customer in Tenant 1
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+254700000001',
        customerType: 'individual'
      });
    tenant1Customer = custRes.body.data.customer;
  });

  describe('Customer CRUD', () => {
    it('should create a valid customer for tenant', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '+254700000002',
          customerType: 'business'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer.email).toBe('jane@example.com');
    });

    it('should reject invalid customer data (validation)', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          firstName: 'J', // too short
          lastName: 'S',  // too short
          email: 'invalid-email',
          phone: '12345'  // invalid Kenyan phone format
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('should get customers for current tenant', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Tenant Isolation (Cross-Tenant Security)', () => {
    it('Tenant 2 should NOT see Tenant 1 customers in list', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.customers.length).toBe(0);
    });

    it('Tenant 2 should NOT fetch Tenant 1 customer by ID', async () => {
      const res = await request(app)
        .get(`/api/customers/${tenant1Customer.id}`)
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
    });

    it('Tenant 2 should NOT update Tenant 1 customer', async () => {
      const res = await request(app)
        .put(`/api/customers/${tenant1Customer.id}`)
        .set('Authorization', `Bearer ${tenant2Token}`)
        .send({
          firstName: 'Hacked',
          lastName: 'Name',
          email: 'hacked@example.com',
          phone: '+254799999999'
        });

      expect(res.statusCode).toEqual(404);
    });

    it('Tenant 2 should NOT delete Tenant 1 customer', async () => {
      const res = await request(app)
        .delete(`/api/customers/${tenant1Customer.id}`)
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('RBAC Authorization', () => {
    it('sales_rep role should NOT be allowed to delete a customer (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/customers/${tenant1Customer.id}`)
        .set('Authorization', `Bearer ${tenant1SalesRepToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });

    it('admin role should be allowed to delete a customer', async () => {
      const res = await request(app)
        .delete(`/api/customers/${tenant1Customer.id}`)
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });
});
