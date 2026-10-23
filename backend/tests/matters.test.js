const request = require('supertest');
const app = require('../server');
const db = require('../src/config/database');

describe('Legal Matters API & Tenant Isolation (Legal Pack)', () => {
  let tenant1Token, tenant2Token;
  let tenant1Client, tenant2Client;
  let tenant1MatterId;

  beforeEach(async () => {
    // Register Tenant 1
    const t1Res = await request(app)
      .post('/api/auth/register-tenant')
      .send({
        companyName: 'Oraro & Associates Advocates',
        slug: `oraro-law-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        firstName: 'Philip',
        lastName: 'Oraro',
        email: `philip-${Date.now()}@oraro.co.ke`,
        password: 'Password123!',
        phone: '+254711000111'
      });
    tenant1Token = t1Res.body.data.token;

    // Register Tenant 2
    const t2Res = await request(app)
      .post('/api/auth/register-tenant')
      .send({
        companyName: 'Bowmans Kenya',
        slug: `bowmans-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        firstName: 'Richard',
        lastName: 'Harney',
        email: `richard-${Date.now()}@bowmans.co.ke`,
        password: 'Password123!',
        phone: '+254722000222'
      });
    tenant2Token = t2Res.body.data.token;

    // Create client for Tenant 1
    const c1Res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        firstName: 'KCB',
        lastName: 'Bank Kenya',
        phone: '+254712345678',
        customerType: 'business'
      });
    tenant1Client = c1Res.body.data.customer;

    // Create client for Tenant 2
    const c2Res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tenant2Token}`)
      .send({
        firstName: 'Equity',
        lastName: 'Group',
        phone: '+254722334455',
        customerType: 'business'
      });
    tenant2Client = c2Res.body.data.customer;
  });

  test('creates a legal matter for Tenant 1', async () => {
    const res = await request(app)
      .post('/api/matters')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        caseNumber: 'HCCC/COMM/102/2026',
        title: 'KCB Bank vs Apex Securities Ltd',
        clientId: tenant1Client.id,
        practiceArea: 'Commercial Litigation',
        courtName: 'High Court Commercial Division Milimani',
        judgeOrArbitrator: 'Lady Justice Ong\'udi',
        opposingParty: 'Apex Securities Ltd',
        opposingCounsel: 'Igeria & Ngugi Advocates',
        billingType: 'hourly',
        hourlyRateKes: 18000,
        priority: 'high',
        nextHearingDate: '2026-11-15',
        filingDeadline: '2026-11-01',
        notes: 'Injunction application coming up for hearing on 15th Nov'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.matterId).toBeDefined();
    tenant1MatterId = res.body.data.matterId;
  });

  test('lists only the current tenant matters and isolates Tenant 2', async () => {
    // Tenant 1 creates a matter
    const m1 = await request(app)
      .post('/api/matters')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        caseNumber: 'ELC/2026/45',
        title: 'Land Ownership Dispute - Karen Block',
        clientId: tenant1Client.id,
        practiceArea: 'Conveyancing & Land Law',
        courtName: 'Environment & Land Court',
        billingType: 'fixed_fee',
        feeAmountKes: 350000
      });

    // Tenant 2 creates a matter
    const m2 = await request(app)
      .post('/api/matters')
      .set('Authorization', `Bearer ${tenant2Token}`)
      .send({
        caseNumber: 'ELRC/2026/88',
        title: 'Wrongful Dismissal Claim',
        clientId: tenant2Client.id,
        practiceArea: 'Employment & Labour',
        courtName: 'Employment Court',
        billingType: 'hourly',
        hourlyRateKes: 15000
      });

    // Tenant 1 fetches matters
    const t1List = await request(app)
      .get('/api/matters')
      .set('Authorization', `Bearer ${tenant1Token}`);

    expect(t1List.status).toBe(200);
    expect(t1List.body.data.matters).toHaveLength(1);
    expect(t1List.body.data.matters[0].title).toBe('Land Ownership Dispute - Karen Block');

    // Tenant 2 fetches matters
    const t2List = await request(app)
      .get('/api/matters')
      .set('Authorization', `Bearer ${tenant2Token}`);

    expect(t2List.status).toBe(200);
    expect(t2List.body.data.matters).toHaveLength(1);
    expect(t2List.body.data.matters[0].title).toBe('Wrongful Dismissal Claim');

    // Tenant 2 cannot read Tenant 1's matter
    const crossRead = await request(app)
      .get(`/api/matters/${m1.body.data.matterId}`)
      .set('Authorization', `Bearer ${tenant2Token}`);

    expect(crossRead.status).toBe(404);
  });

  test('logs billable time entry on legal matter', async () => {
    const mRes = await request(app)
      .post('/api/matters')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        title: 'Drafting Facility Agreement',
        clientId: tenant1Client.id,
        practiceArea: 'Banking & Finance',
        billingType: 'hourly',
        hourlyRateKes: 20000
      });
    const matterId = mRes.body.data.matterId;

    // Log 90 minutes of drafting
    const timeRes = await request(app)
      .post(`/api/matters/${matterId}/time-entries`)
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        activityType: 'drafting',
        durationMinutes: 90,
        description: 'Reviewed facility agreement terms and securities documentation'
      });

    expect(timeRes.status).toBe(201);
    expect(timeRes.body.success).toBe(true);
    // 90 min at KES 20,000/hr = KES 30,000
    expect(timeRes.body.data.billableAmount).toBe(30000);

    // Fetch matter and check time entries included
    const getRes = await request(app)
      .get(`/api/matters/${matterId}`)
      .set('Authorization', `Bearer ${tenant1Token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.timeEntries).toHaveLength(1);
    expect(getRes.body.data.timeEntries[0].duration_minutes).toBe(90);
    expect(getRes.body.data.timeEntries[0].billable_amount_kes).toBe(30000);
  });
});
