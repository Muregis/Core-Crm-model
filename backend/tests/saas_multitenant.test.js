const request = require('supertest');
const app = require('../server');
const db = require('../src/config/database');

describe('Multi-Tenant SaaS Lifecycle, M-Pesa Encryption & Compliance Tests', () => {

  describe('1. Self-Service Tenant Onboarding & Provisioning', () => {
    it('should provision a new tenant organization with deal stages and admin user', async () => {
      const res = await request(app)
        .post('/api/auth/register-tenant')
        .send({
          companyName: 'Nairobi SACCO Solutions',
          slug: 'nairobi-sacco',
          kraPin: 'P051234567X',
          email: 'admin@nairobisacco.co.ke',
          password: 'Password123!',
          firstName: 'Wanjiku',
          lastName: 'Kariuki',
          phone: '+254711223344',
          plan: 'pro'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenant.name).toBe('Nairobi SACCO Solutions');
      expect(res.body.data.tenant.slug).toBe('nairobi-sacco');
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      const tenantId = res.body.data.tenant.id;

      // Verify deal stages were seeded specifically for this tenant
      const stages = await db.query('SELECT * FROM deal_stages WHERE tenant_id = ?', [tenantId]);
      expect(stages.length).toBe(6);
      expect(stages.map(s => s.name).some(n => n.includes('Prospecting'))).toBe(true);
      expect(stages.map(s => s.name).some(n => n.includes('Closed Won'))).toBe(true);
    });

    it('should reject registration if slug/subdomain is already taken', async () => {
      // First register
      await request(app)
        .post('/api/auth/register-tenant')
        .send({
          companyName: 'Nairobi SACCO Solutions',
          slug: 'nairobi-sacco',
          email: 'first@nairobisacco.co.ke',
          password: 'Password123!',
          firstName: 'Wanjiku',
          lastName: 'Kariuki'
        });

      // Duplicate registration attempt
      const res = await request(app)
        .post('/api/auth/register-tenant')
        .send({
          companyName: 'Duplicate SACCO',
          slug: 'nairobi-sacco', // duplicate slug
          email: 'another@nairobisacco.co.ke',
          password: 'Password123!',
          firstName: 'John',
          lastName: 'Mwangi'
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already taken/i);
    });

    it('should retrieve public tenant metadata by subdomain slug', async () => {
      await request(app)
        .post('/api/auth/register-tenant')
        .send({
          companyName: 'Nairobi SACCO Solutions',
          slug: 'nairobi-sacco',
          email: 'admin@nairobisacco.co.ke',
          password: 'Password123!',
          firstName: 'Wanjiku',
          lastName: 'Kariuki',
          plan: 'pro'
        });

      const res = await request(app).get('/api/auth/tenant/nairobi-sacco');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tenant.name).toBe('Nairobi SACCO Solutions');
      expect(res.body.data.tenant.plan).toBe('pro');
    });
  });

  describe('2. Token Revocation & Refresh Token Rotation', () => {
    let userToken;
    let userRefreshToken;

    beforeEach(async () => {
      const reg = await request(app)
        .post('/api/auth/register-tenant')
        .send({
          companyName: 'Token Test SACCO',
          slug: 'token-sacco',
          email: 'tokenuser@sacco.co.ke',
          password: 'Password123!',
          firstName: 'Token',
          lastName: 'Tester'
        });
      userToken = reg.body.data.token;
      userRefreshToken = reg.body.data.refreshToken;
    });

    it('should rotate refresh token and issue new access token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: userRefreshToken });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // Old refresh token must now be revoked
      const retryRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: userRefreshToken });
      expect(retryRes.statusCode).toBe(401);
    });

    it('should log out and immediately block access token via revocation list', async () => {
      // First verify current access token works
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(meRes.statusCode).toBe(200);

      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`);
      expect(logoutRes.statusCode).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Subsequent access with same token must fail immediately
      const blockedRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);
      expect(blockedRes.statusCode).toBe(401);
      expect(blockedRes.body.message).toMatch(/revoked/i);
    });
  });

  describe('3. Multi-Tenant M-Pesa Encrypted Vault & Public Daraja Routing', () => {
    let t1Token;
    let t1Id;
    let t2Token;
    let t2Id;

    beforeEach(async () => {
      const reg1 = await request(app)
        .post('/api/auth/register-tenant')
        .send({
          companyName: 'Nairobi SACCO Solutions',
          slug: 'nairobi-sacco',
          email: 'admin@nairobisacco.co.ke',
          password: 'Password123!',
          firstName: 'Wanjiku',
          lastName: 'Kariuki'
        });
      t1Token = reg1.body.data.token;
      t1Id = reg1.body.data.tenant.id;

      const reg2 = await request(app)
        .post('/api/auth/register-tenant')
        .send({
          companyName: 'Mombasa Logistics Ltd',
          slug: 'mombasa-logistics',
          email: 'admin@mombasalogistics.co.ke',
          password: 'Password123!',
          firstName: 'Ali',
          lastName: 'Hassan'
        });
      t2Token = reg2.body.data.token;
      t2Id = reg2.body.data.tenant.id;
    });

    it('should encrypt and store Safaricom Daraja credentials for Tenant 1', async () => {
      const res = await request(app)
        .post('/api/mpesa/credentials')
        .set('Authorization', `Bearer ${t1Token}`)
        .send({
          shortcode: '600123',
          keyType: 'paybill',
          consumerKey: 'superSecretConsumerKey12345',
          consumerSecret: 'superSecretConsumerSecret67890',
          passkey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
          isSandbox: true
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify credentials table stored encrypted ciphertext, not plaintext
      const creds = await db.query(
        'SELECT consumer_key_encrypted FROM tenant_credentials WHERE tenant_id = ?',
        [t1Id]
      );
      expect(creds.length).toBe(1);
      expect(creds[0].consumer_key_encrypted).not.toBe('superSecretConsumerKey12345');
    });

    it('should return masked credential status without leaking plaintext secret', async () => {
      await request(app)
        .post('/api/mpesa/credentials')
        .set('Authorization', `Bearer ${t1Token}`)
        .send({
          shortcode: '600123',
          consumerKey: 'superSecretConsumerKey12345',
          consumerSecret: 'superSecretConsumerSecret67890'
        });

      const res = await request(app)
        .get('/api/mpesa/credentials')
        .set('Authorization', `Bearer ${t1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.configured).toBe(true);
      expect(res.body.data.shortcode).toBe('600123');
      expect(res.body.data.maskedConsumerKey).toMatch(/\*\*\*\*/);
      expect(res.body.data.maskedConsumerKey).not.toBe('superSecretConsumerKey12345');
    });

    it('should route incoming public Safaricom C2B webhook to Tenant 1 by Paybill shortcode', async () => {
      // First configure Tenant 1 shortcode
      await request(app)
        .post('/api/mpesa/credentials')
        .set('Authorization', `Bearer ${t1Token}`)
        .send({
          shortcode: '600123',
          consumerKey: 'superSecretKey',
          consumerSecret: 'superSecretSecret'
        });

      // Public callback from Safaricom (no Authorization header)
      const res = await request(app)
        .post('/api/mpesa/c2b-callback')
        .send({
          BusinessShortCode: '600123',
          TransID: 'SLK99887766',
          TransAmount: '15000.00',
          MSISDN: '254711223344',
          BillRefNumber: 'INV-2026-001',
          FirstName: 'Kamau'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.ResultCode).toBe(0);

      // Verify the transaction was saved under Tenant 1
      const txns = await db.query(
        'SELECT * FROM mpesa_transactions WHERE mpesa_receipt_number = ?',
        ['SLK99887766']
      );
      expect(txns.length).toBe(1);
      expect(txns[0].tenant_id).toBe(t1Id);
      expect(txns[0].amount).toBe(15000);

      // Verify Tenant 2 cannot see Tenant 1 transaction
      const t2Txns = await request(app)
        .get('/api/mpesa')
        .set('Authorization', `Bearer ${t2Token}`);
      expect(t2Txns.statusCode).toBe(200);
      const foundInT2 = t2Txns.body.data.transactions.some(t => t.mpesa_receipt_number === 'SLK99887766');
      expect(foundInT2).toBe(false);
    });
  });

  describe('4. Kenya Data Protection Act 2019 (KDPA) Compliance Rights', () => {
    let t1Token;
    let customerId;

    beforeEach(async () => {
      const reg1 = await request(app)
        .post('/api/auth/register-tenant')
        .send({
          companyName: 'Nairobi SACCO Solutions',
          slug: 'nairobi-sacco',
          email: 'admin@nairobisacco.co.ke',
          password: 'Password123!',
          firstName: 'Wanjiku',
          lastName: 'Kariuki'
        });
      t1Token = reg1.body.data.token;

      const custRes = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${t1Token}`)
        .send({
          firstName: 'Grace',
          lastName: 'Muthoni',
          email: 'grace@muthoni.co.ke',
          phone: '+254722998877',
          companyName: 'Muthoni Textiles',
          customerType: 'business'
        });
      customerId = custRes.body.data.customer.id;
    });

    it('should export customer data under KDPA Subject Access Request (Section 26)', async () => {
      const res = await request(app)
        .get(`/api/customers/${customerId}/kdpa-export`)
        .set('Authorization', `Bearer ${t1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.compliance).toMatch(/Kenya Data Protection Act/i);
      expect(res.body.data.customer.first_name).toBe('Grace');
      expect(res.body.data.customer.phone).toBe('+254722998877');
    });

    it('should anonymize customer PII under KDPA Right to Erasure while retaining record integrity', async () => {
      const res = await request(app)
        .post(`/api/customers/${customerId}/anonymize`)
        .set('Authorization', `Bearer ${t1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify database record has masked/sanitized PII
      const updated = await db.query(
        'SELECT first_name, last_name, phone, email FROM customers WHERE id = ?',
        [customerId]
      );
      expect(updated[0].first_name).toBe('Anonymized');
      expect(updated[0].phone).toBe('+254700000000');
      expect(updated[0].email).toMatch(/anonymized_/);
    });
  });
});
