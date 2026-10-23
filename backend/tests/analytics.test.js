const request = require('supertest');
const app = require('../server');

describe('Analytics, OPEX & Staff Productivity API', () => {
  let tenant1Token;
  let tenant2Token;
  let tenant1RepToken;
  let tenant1Id;
  let tenant2Id;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Tenant 1 Admin
    const res1 = await request(app).post('/api/auth/register').send({
      email: `t1-admin-${suffix}@estate.co.ke`,
      password: 'password123',
      firstName: 'Admin',
      lastName: 'One',
      phone: `+254710${String(Date.now()).slice(-6)}`,
      role: 'admin',
      tenantName: `Estate Firm One ${suffix}`
    });
    expect(res1.statusCode).toBeLessThan(300);
    tenant1Token = res1.body.data.token;
    tenant1Id = res1.body.data.user.tenant_id;

    // Tenant 1 Sales Rep
    const repRes = await request(app).post('/api/auth/register').send({
      email: `t1-rep-${suffix}@estate.co.ke`,
      password: 'password123',
      firstName: 'Rep',
      lastName: 'One',
      phone: `+254711${String(Date.now()).slice(-6)}`,
      role: 'sales_rep',
      tenantName: `Estate Firm One ${suffix}`
    });
    expect(repRes.statusCode).toBeLessThan(300);
    tenant1RepToken = repRes.body.data.token;

    // Tenant 2 Admin
    const res2 = await request(app).post('/api/auth/register').send({
      email: `t2-admin-${suffix}@other.co.ke`,
      password: 'password123',
      firstName: 'Admin',
      lastName: 'Two',
      phone: `+254720${String(Date.now()).slice(-6)}`,
      role: 'admin',
      tenantName: `Law Firm Two ${suffix}`
    });
    expect(res2.statusCode).toBeLessThan(300);
    tenant2Token = res2.body.data.token;
    tenant2Id = res2.body.data.user.tenant_id;
  });

  describe('1. Executive P&L Scorecard & Overview', () => {
    it('returns 200 with P&L scorecard, category breakdown, and staff productivity leaderboard', async () => {
      const res = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const { financialSummary, expenditureBreakdown, staffProductivityLeaderboard, industryMetrics, monthlyTrends } = res.body.data;

      // Scorecard shape
      expect(financialSummary).toBeDefined();
      expect(typeof financialSummary.grossRevenueKes).toBe('number');
      expect(typeof financialSummary.totalExpenditureKes).toBe('number');
      expect(typeof financialSummary.netProfitKes).toBe('number');
      expect(typeof financialSummary.netMarginPercent).toBe('number');
      expect(['number', 'string']).toContain(typeof financialSummary.roiMultiplier);

      // Category breakdown
      expect(expenditureBreakdown).toBeDefined();

      // Staff productivity leaderboard
      expect(Array.isArray(staffProductivityLeaderboard)).toBe(true);

      // Industry operational metrics
      expect(industryMetrics).toBeDefined();

      // Monthly trajectory
      expect(Array.isArray(monthlyTrends)).toBe(true);
    });

    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/analytics/overview');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('2. Operating Expenditure (OPEX) Management', () => {
    it('records an expenditure with receipt reference and payment method', async () => {
      const res = await request(app)
        .post('/api/analytics/expenses')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          title: 'Client site transport to Juja Ridge',
          category: 'fuel_transport',
          amountKes: 8500,
          expenseDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'mpesa_paybill',
          receiptRef: 'REC-2026-TEST-99',
          notes: 'Fuel and toll fees for prospective buyers'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.amount_kes).toBe(8500);
      expect(res.body.data.category).toBe('fuel_transport');
    });

    it('lists expenditures for the tenant and supports category filtering', async () => {
      // 1. Create an expense first
      const createRes = await request(app)
        .post('/api/analytics/expenses')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          title: 'Site Visit Van Fuel',
          category: 'fuel_transport',
          amountKes: 6000,
          paymentMethod: 'cash'
        });
      expect(createRes.statusCode).toBe(201);

      // 2. Query expenses
      const res = await request(app)
        .get('/api/analytics/expenses?category=fuel_transport')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.expenses)).toBe(true);
      expect(res.body.data.expenses.length).toBeGreaterThanOrEqual(1);

      const found = res.body.data.expenses.find((e) => e.title === 'Site Visit Van Fuel');
      expect(found).toBeDefined();
    });

    it('enforces RBAC: sales rep cannot delete an expenditure (403 Forbidden)', async () => {
      // 1. Admin creates expense
      const createRes = await request(app)
        .post('/api/analytics/expenses')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          title: 'Office Water Supply',
          category: 'office_utilities',
          amountKes: 4500
        });
      expect(createRes.statusCode).toBe(201);
      const expenseId = createRes.body.data.id;

      // 2. Sales rep attempts to delete
      const res = await request(app)
        .delete(`/api/analytics/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${tenant1RepToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('admin can delete an expenditure (200 OK)', async () => {
      // 1. Admin creates expense
      const createRes = await request(app)
        .post('/api/analytics/expenses')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          title: 'Marketing Flyers',
          category: 'marketing_leads',
          amountKes: 15000
        });
      expect(createRes.statusCode).toBe(201);
      const expenseId = createRes.body.data.id;

      // 2. Admin deletes
      const res = await request(app)
        .delete(`/api/analytics/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('3. Cross-Tenant Isolation on Financial Data', () => {
    it('Tenant 2 cannot see Tenant 1 expenditures or delete Tenant 1 expenditure', async () => {
      // 1. Tenant 1 creates a private expense
      const createRes = await request(app)
        .post('/api/analytics/expenses')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          title: 'Tenant 1 Confidential Executive Bonus',
          category: 'payroll_salaries',
          amountKes: 120000,
          paymentMethod: 'bank_transfer',
          receiptRef: 'T1-SECRET-001'
        });

      expect(createRes.statusCode).toBe(201);
      const privateExpenseId = createRes.body.data.id;

      // 2. Tenant 2 queries expense list - must NOT contain Tenant 1's secret expense
      const listRes = await request(app)
        .get('/api/analytics/expenses')
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(listRes.statusCode).toBe(200);
      const leaked = listRes.body.data.expenses.find((e) => e.id === privateExpenseId);
      expect(leaked).toBeUndefined();

      // 3. Tenant 2 attempts to delete Tenant 1's expense - must return 404 Not Found
      const deleteRes = await request(app)
        .delete(`/api/analytics/expenses/${privateExpenseId}`)
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(deleteRes.statusCode).toBe(404);
    });
  });
});
