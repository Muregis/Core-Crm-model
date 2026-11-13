const request = require('supertest');
const app = require('../server');
const db = require('../src/config/database');

describe('Operating Model v2.0: Driver-Based Pricing Config & Financial Observability', () => {
  let adminToken;
  let adminUserId;
  let tenantId;
  let technicianId;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 1. Register Admin User
    const resAdmin = await request(app).post('/api/auth/register').send({
      email: `driver-admin-${suffix}@sawarepairs.co.ke`,
      password: 'password123',
      firstName: 'Kariuki',
      lastName: 'Director',
      phone: `+254733${String(Date.now()).slice(-6)}`,
      role: 'admin',
      tenantName: `Sawa Field Ops ${suffix}`
    });
    expect(resAdmin.statusCode).toBeLessThan(300);
    adminToken = resAdmin.body.data.token;
    adminUserId = resAdmin.body.data.user.id;
    tenantId = resAdmin.body.data.user.tenant_id;

    // 2. Create Field Technician
    const resTech = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: `driver-tech-${suffix}@sawarepairs.co.ke`,
        password: 'password123',
        firstName: 'Otieno',
        lastName: 'Plumber',
        phone: `+254744${String(Date.now()).slice(-6)}`,
        role: 'technician'
      });
    expect(resTech.statusCode).toBe(201);
    technicianId = resTech.body.data.userId;
  });

  describe('1. Dynamic Pricing Drivers & Effective-Dating Audit Trail', () => {
    it('should return all active pricing drivers with default baseline values', async () => {
      const res = await request(app)
        .get('/api/pricing-config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.driver_map).toBeDefined();

      const map = res.body.data.driver_map;
      expect(map.callout_fee).toBe(2000);
      expect(map.emergency_premium).toBe(1000);
      expect(map.labour_rate_standard).toBe(1200);
      expect(map.labour_rate_emergency).toBe(1500);
      expect(map.parts_markup_pct).toBe(20);
      expect(map.technician_labour_split_pct).toBe(50);
      expect(map.mpesa_fee_pct).toBe(1.2);
      expect(map.quote_validity_days).toBe(7);
      expect(map.parts_float_required_kes).toBe(50000);
    });

    it('should allow admin to update a pricing driver with effective date and audit log', async () => {
      const updateRes = await request(app)
        .patch('/api/pricing-config/emergency_premium')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          value: 1500,
          unit: 'KES',
          reason: 'Monsoon season peak emergency demand adjustment'
        });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.new_value).toBe(1500);

      // Verify the active driver is now 1500
      const activeRes = await request(app)
        .get('/api/pricing-config')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(activeRes.body.data.driver_map.emergency_premium).toBe(1500);

      // Verify audit history log
      const histRes = await request(app)
        .get('/api/pricing-config/emergency_premium/history')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(histRes.statusCode).toBe(200);
      expect(histRes.body.data.history.length).toBeGreaterThan(0);
      expect(histRes.body.data.history[0].new_value).toBe(1500);
      expect(histRes.body.data.history[0].reason).toContain('Monsoon season');
    });
  });

  describe('2. Immutable Driver Snapshotting on Ticket Creation', () => {
    it('should snapshot active pricing drivers onto ticket at creation', async () => {
      const createRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'plumbing',
          priority: 'emergency',
          description: 'Burst main water inlet pipe in Kilimani kitchen'
        });

      expect(createRes.statusCode).toBe(201);
      const createdTicket = createRes.body.data.ticket;

      expect(createdTicket.callout_fee_applied).toBe(2000);
      expect(createdTicket.emergency_premium_applied).toBe(1000);
      expect(createdTicket.labour_rate_applied).toBe(1500); // emergency labour rate
      expect(createdTicket.parts_markup_pct_applied).toBe(20);
      expect(createdTicket.pricing_config_version).toBe('v2.0');
      expect(createdTicket.quote_expires_at).toBeDefined();

      // Verify quote expiration is ~7 days in future
      const expDate = new Date(createdTicket.quote_expires_at);
      const now = new Date();
      const diffDays = Math.round((expDate - now) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(6);
    });

    it('should preserve immutable snapshot when active drivers change afterwards', async () => {
      // 1. Admin updates emergency_premium driver to 1500
      await request(app)
        .patch('/api/pricing-config/emergency_premium')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 1500, reason: 'Peak adjustment' });

      // 2. Ticket created under rate 1500
      const createRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'plumbing',
          priority: 'emergency',
          description: 'Burst water pipe'
        });
      const ticketId = createRes.body.data.ticket.id;
      expect(createRes.body.data.ticket.emergency_premium_applied).toBe(1500);

      // 3. Admin alters driver again to 2200
      await request(app)
        .patch('/api/pricing-config/emergency_premium')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 2200, reason: 'New price change' });

      // 4. The previously created ticket MUST still have emergency_premium_applied = 1500 (immutable!)
      const ticketRes = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(ticketRes.statusCode).toBe(200);
      expect(ticketRes.body.data.ticket.emergency_premium_applied).toBe(1500);
    });
  });

  describe('3. Corrected Unit Economics & Margin Arithmetic', () => {
    it('should record costs using snapshotted rates, 50% tech split, M-Pesa fee and parts float', async () => {
      // Create a standard ticket
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'electrical',
          priority: 'standard',
          description: 'Tripping master circuit breaker'
        });

      const ticketId = ticketRes.body.data.ticket.id;

      // Landlord approves the repair work (waiving call-out fee)
      await request(app)
        .post(`/api/tickets/${ticketId}/approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'approve',
          notes: 'Tenant confirmed power failure; proceed immediately'
        });

      // Record standard fix costs: 2.5 hours labour, KES 4,000 wholesale parts, KES 500 travel
      // Expected arithmetic:
      // Labour billed: 2.5 * 1200 = KES 3,000
      // Parts billed: 4000 * (1 + 0.20) = KES 4,800
      // Total invoice: 3,000 + 4,800 = KES 7,800 (call-out fee waived on approval)
      // Direct Variable COGS: Tech payout (50% of labour = 1,500) + Parts (4,000) + Travel (500) = 6,000
      // Gross margin: 7,800 - 6,000 = 1,800 (23.1% gross margin)
      const costRes = await request(app)
        .post(`/api/tickets/${ticketId}/costs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labour_hours: 2.5,
          parts_cost_kes: 4000,
          travel_cost_kes: 500,
          callout_fee_waived: true
        });

      expect(costRes.statusCode).toBe(200);
      const updated = costRes.body.data.ticket;

      expect(updated.labour_billed_kes).toBe(3000);
      expect(updated.parts_billed_kes).toBe(4800);
      expect(updated.invoice_amount_kes).toBe(7800);
      expect(updated.labour_cost_kes).toBe(1500); // 50% technician labour split
      expect(updated.gross_margin_kes).toBe(1800);
      expect(updated.margin_percentage).toBeCloseTo(23.1, 1);

      // Parts working capital deposit requirement tracked:
      expect(updated.parts_deposit_required_kes).toBe(4800);
    });
  });

  describe('4. Financial Sensitivity Bands & Working Capital Observability', () => {
    it('should expose dynamic financial break-even model on both endpoints', async () => {
      // 1. GET /api/pricing-config/financial-model
      const res1 = await request(app)
        .get('/api/pricing-config/financial-model')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res1.statusCode).toBe(200);
      expect(res1.body.success).toBe(true);
      const model = res1.body.data;

      expect(model.financial_model_version).toBe('v2.0 (Driver-Based)');
      expect(model.fixed_burn.total_monthly_fixed_burn_kes).toBeGreaterThanOrEqual(125000);
      expect(model.fixed_burn.fixed_cost_breakdown.ops_coordinator_kes).toBe(50000);
      expect(model.fixed_burn.fixed_cost_breakdown.lead_inspector_kes).toBe(40000);

      // Sensitivity bands
      expect(model.break_even_sensitivity_bands.favourable).toBeDefined();
      expect(model.break_even_sensitivity_bands.base).toBeDefined();
      expect(model.break_even_sensitivity_bands.adverse).toBeDefined();

      // Working capital & parts float requirement
      expect(model.working_capital_observability.parts_float_required_kes).toBe(50000);
      expect(model.working_capital_observability.projected_monthly_parts_volume_kes).toBeGreaterThan(0);

      // 4-Month Runway Ramp
      expect(model.runway_projections.length).toBe(4);
      expect(model.recommended_cash_reserve_kes).toBe(550000);

      // 2. GET /api/tickets/dashboard/financial-model (Dashboard alias endpoint)
      const res2 = await request(app)
        .get('/api/tickets/dashboard/financial-model')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res2.statusCode).toBe(200);
      expect(res2.body.data.fixed_burn.total_monthly_fixed_burn_kes).toBe(model.fixed_burn.total_monthly_fixed_burn_kes);
    });
  });
});
