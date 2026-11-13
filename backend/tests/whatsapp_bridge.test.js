const request = require('supertest');
const app = require('../server');
const db = require('../src/config/database');
const whatsappBridge = require('../src/integrations/whatsappBridge');

describe('WhatsApp Bridge Integration (Meta Cloud API & Twilio)', () => {
  let testTenantId;
  let testAdminToken;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Register tenant admin to guarantee valid tenant in test db
    const regRes = await request(app).post('/api/auth/register').send({
      email: `wa-admin-${suffix}@sawarepairs.co.ke`,
      password: 'password123',
      firstName: 'Amina',
      lastName: 'Admin',
      phone: `+254701${String(Date.now()).slice(-6)}`,
      role: 'admin',
      tenantName: `Sawa WhatsApp Tenant ${suffix}`
    });
    expect(regRes.statusCode).toBeLessThan(300);
    testTenantId = regRes.body.data.user.tenant_id;
    testAdminToken = regRes.body.data.token;
  });

  describe('1. Message Classifier Unit Tests', () => {
    it('classifies plumbing emergency accurately', () => {
      const result = whatsappBridge.classifyMessage('Emergency! Pipe burst in bathroom and water flooding the floor!');
      expect(result.category).toBe('plumbing');
      expect(result.priority).toBe('emergency');
    });

    it('classifies electrical standard issue accurately', () => {
      const result = whatsappBridge.classifyMessage('Power socket is tripping in the kitchen when using the kettle');
      expect(result.category).toBe('electrical');
      expect(result.priority).toBe('standard');
    });

    it('classifies roofing routine maintenance', () => {
      const result = whatsappBridge.classifyMessage('Roof gutters and mabati need routine cleaning and inspection next week');
      expect(result.category).toBe('roofing');
      expect(result.priority).toBe('planned');
    });

    it('classifies solar issue', () => {
      const result = whatsappBridge.classifyMessage('The solar inverter and battery are not holding charge');
      expect(result.category).toBe('solar');
      expect(result.priority).toBe('standard');
    });

    it('classifies painting request', () => {
      const result = whatsappBridge.classifyMessage('Need painting on exterior wall crack');
      expect(result.category).toBe('painting');
      expect(result.priority).toBe('standard');
    });
  });

  describe('2. Meta WhatsApp Cloud API Webhook Handshake', () => {
    it('successfully responds to valid Meta webhook challenge', async () => {
      const challengeCode = '1158201444';
      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'sawa_repairs_webhook_secret_2026';

      const res = await request(app)
        .get('/api/integrations/whatsapp/meta')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': challengeCode
        });

      expect(res.statusCode).toBe(200);
      expect(res.text).toBe(challengeCode);
    });

    it('rejects handshake when verify token is incorrect', async () => {
      const res = await request(app)
        .get('/api/integrations/whatsapp/meta')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-unauthorized-token',
          'hub.challenge': '12345'
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Meta WhatsApp Cloud API Inbound Ingestion', () => {
    it('acknowledges delivery/read status notifications without creating tickets', async () => {
      const statusPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '254700000000', phone_number_id: '123456789' },
                  statuses: [{ id: 'wamid.HBgL...', status: 'delivered', timestamp: '1700000000' }]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      const res = await request(app)
        .post('/api/integrations/whatsapp/meta')
        .send(statusPayload);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('acknowledged');
    });

    it('ingests plumbing emergency message and generates service ticket', async () => {
      const incomingMessage = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '254700000000', phone_number_id: '123456789' },
                  contacts: [
                    {
                      profile: { name: 'Kamau Landlord' },
                      wa_id: '254722123456'
                    }
                  ],
                  messages: [
                    {
                      from: '254722123456',
                      id: 'wamid.HBgLMjU0NzIyMTIzNDU2FQIAEhgg...',
                      timestamp: '1700000000',
                      text: {
                        body: 'Urgent emergency! Main water pipe burst in Apartment B4, water is flooding into the hallway!'
                      },
                      type: 'text'
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      const res = await request(app)
        .post(`/api/integrations/whatsapp/meta?tenant_id=${testTenantId}`)
        .send(incomingMessage);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.ticket_number).toMatch(/^SAW-\d{4}-\d{5}$/);
      expect(res.body.data.tracking_url).toContain('/track/');

      // Verify stored ticket details in database
      const rows = await db.query(
        'SELECT * FROM tickets WHERE id = ? AND tenant_id = ?',
        [res.body.data.ticket_id, testTenantId]
      );
      expect(rows.length).toBe(1);
      const ticket = rows[0];
      expect(ticket.category).toBe('plumbing');
      expect(ticket.priority).toBe('emergency');
      expect(ticket.status).toBe('reported');
      expect(ticket.reported_by).toContain('Kamau Landlord');
      expect(ticket.tracking_token).toBeDefined();
      expect(ticket.tracking_token).toMatch(/^tr_[a-f0-9]{64}$/); // 'tr_' prefix + 256-bit cryptographic entropy (64 hex)
      expect(ticket.tracking_token.length).toBe(67);
    });
  });

  describe('4. Twilio WhatsApp Inbound Ingestion', () => {
    it('ingests incoming Twilio WhatsApp webhook and returns TwiML response', async () => {
      const res = await request(app)
        .post(`/api/integrations/whatsapp/twilio?tenant_id=${testTenantId}`)
        .type('form')
        .send({
          From: 'whatsapp:+254733987654',
          To: 'whatsapp:+254700000000',
          Body: 'Smoke and sparks coming from circuit breaker in living room. Urgent electric shock hazard!',
          ProfileName: 'Zainab Airbnb Host',
          NumMedia: '0'
        });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('xml');
      expect(res.text).toContain('<Response>');
      expect(res.text).toContain('<Message>');
      expect(res.text).toContain('Habari Zainab Airbnb Host!');
      expect(res.text).toContain('SAW-');
      expect(res.text).toContain('ELECTRICAL');
      expect(res.text).toContain('/track/');
    });
  });

  describe('5. Client Experience Public Endpoints (Payments, Reports & Sign-off)', () => {
    let ticketTrackingToken;
    let passportToken;

    beforeEach(async () => {
      // Create a property
      const propRes = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${testAdminToken}`)
        .send({
          name: 'Kilimani Heights Apt 4B',
          address: 'Argwings Kodhek Rd, Kilimani, Nairobi',
          unit_count: 1,
          airbnb_managed: 1
        });
      expect(propRes.statusCode).toBe(201);
      passportToken = propRes.body.data.property?.passport_token || propRes.body.data.passport_token;

      // Ingest a ticket
      const ticketRes = await request(app)
        .post(`/api/tickets/whatsapp-intake`)
        .send({
          tenant_id: testTenantId,
          propertyIdentifier: 'Kilimani Heights Apt 4B',
          category: 'plumbing',
          priority: 'standard',
          description: 'Sink mixer tap leaking continuously',
          reportedBy: 'Kariuki Landlord (+254711000111)'
        });
      expect(ticketRes.statusCode).toBe(201);
      ticketTrackingToken = ticketRes.body.data.ticket.tracking_token;
    });

    it('fetches landlord monthly maintenance report via public passport token', async () => {
      const res = await request(app)
        .get(`/api/public/properties/passport/${passportToken}/monthly-report`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.portfolio_summary).toBeDefined();
      expect(res.body.data.portfolio_summary.spend_breakdown).toBeDefined();
      expect(Array.isArray(res.body.data.tickets)).toBe(true);
    });

    it('initiates public M-Pesa STK push payment for a ticket without login', async () => {
      const res = await request(app)
        .post(`/api/public/tickets/pay/${ticketTrackingToken}`)
        .send({
          phoneNumber: '0712345678',
          amount: 2500
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.receiptNumber).toMatch(/^SK/);
      expect(res.body.phoneNumber).toBe('+254712345678');
      expect(res.body.amount).toBe(2500);

      // Verify M-Pesa transaction recorded in DB
      const txRows = await db.query(
        'SELECT * FROM mpesa_transactions WHERE receipt_number = ? AND tenant_id = ?',
        [res.body.receiptNumber, testTenantId]
      );
      expect(txRows.length).toBe(1);
      expect(txRows[0].amount).toBe(2500);
    });

    it('records tenant digital sign-off from live tracking link', async () => {
      const res = await request(app)
        .post(`/api/public/tickets/signoff/${ticketTrackingToken}`)
        .send({
          signerName: 'Jane Tenant',
          comments: 'Fundi arrived promptly and fixed the tap with clean finish.'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Sign-off recorded successfully');
    });

    it('returns empirical measured SLA performance metrics', async () => {
      const res = await request(app)
        .get(`/api/public/sla-performance?tenant_id=${testTenantId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.median_emergency_response_hours).toBeDefined();
      expect(res.body.data.measured_statement).toContain('Empirical Performance: Median emergency response time');
      expect(res.body.data.guarantee_days).toBe(30);
    });
  });
});
