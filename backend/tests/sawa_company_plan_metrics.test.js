const request = require('supertest');
const app = require('../server');
const db = require('../src/config/database');

describe('Sawa Repairs Product Document v2.1 Metrics & Implementation', () => {
  let tenant1Token;
  let tenant1Id;
  let tenant1AdminId;
  let landlordId;
  let propertyId;
  let technicianId;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 1. Register tenant admin
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `admin-${suffix}@sawarepairs.co.ke`,
        password: 'password123',
        firstName: 'Sawa',
        lastName: 'Ops',
        role: 'admin',
        tenantName: `Sawa Repairs Ltd ${suffix}`,
        phone: `+254700${String(Date.now()).slice(-6)}`
      });

    expect(adminRes.statusCode).toBeLessThan(300);
    tenant1Token = adminRes.body.data.token;
    tenant1Id = adminRes.body.data.user.tenant_id;
    tenant1AdminId = adminRes.body.data.user.id;

    // 2. Create technician within same tenant
    const techRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        email: `fundi-${suffix}@sawarepairs.co.ke`,
        password: 'password123',
        firstName: 'Juma',
        lastName: 'Fundi',
        role: 'sales_rep',
        phone: `+254711${String(Date.now()).slice(-6)}`
      });

    expect(techRes.statusCode).toBe(201);
    technicianId = techRes.body.data.userId;

    // 3. Create a landlord customer (e.g. Diaspora landlord)
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        firstName: 'Njeri',
        lastName: 'Kamau',
        email: `njeri-${suffix}@diaspora.co.uk`,
        phone: `+254722${String(Date.now()).slice(-6)}`,
        companyName: 'Kilimani Apartments Portfolio',
        customerType: 'individual'
      });

    expect(custRes.statusCode).toBe(201);
    landlordId = custRes.body.data.customer.id;

    // 4. Create property
    const propRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        name: 'Kilimani Heights Apt 4B',
        customer_id: landlordId,
        address: 'Kindaruma Road, Kilimani, Nairobi',
        unit_count: 1,
        notes: 'High-end furnished Airbnb unit'
      });

    expect(propRes.statusCode).toBe(201);
    propertyId = propRes.body.data.property.id;
  });

  describe('1. Unit Economics & Pricing Policy (v2.1 §4.3 & §7.4)', () => {
    it('should calculate callout, parts markup (25%), labour, invoice amount, gross margin and margin %', async () => {
      // Create ticket
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          property_id: propertyId,
          customer_id: landlordId,
          category: 'plumbing',
          priority: 'standard',
          description: 'Burst kitchen sink flexi pipe causing flood',
          callout_fee_kes: 2000
        });

      expect(ticketRes.statusCode).toBe(201);
      const ticketId = ticketRes.body.data.ticket.id;
      expect(ticketRes.body.data.ticket.callout_fee_kes).toBe(2000);
      expect(ticketRes.body.data.ticket.callout_fee_waived).toBe(0);

      // Record unit economics
      // Labour: 2 hours at 1,500 billed (3,000 billed), internal technician cost: 1,200
      // Parts: flexi pipe & valve cost 2,000, markup 25% -> 2,500 billed
      // Travel cost: 500
      // Expected invoice = 2,000 (callout) + 3,000 (labour) + 2,500 (parts) = 7,500
      // Direct COGS = 1,200 (labour cost) + 2,000 (parts cost) + 500 (travel) = 3,700
      // Expected Gross Margin = 7,500 - 3,700 = 3,800
      // Margin % = (3,800 / 7,500) * 100 = 50.7%
      const costRes = await request(app)
        .post(`/api/tickets/${ticketId}/costs`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          labour_hours: 2,
          hourly_rate_kes: 1500,
          labour_cost_kes: 1200,
          parts_cost_kes: 2000,
          parts_markup_percentage: 25,
          travel_cost_kes: 500,
          notes: 'Replaced high-pressure braided hose and angle valve'
        });

      expect(costRes.statusCode).toBe(200);
      const t = costRes.body.data.ticket;
      expect(t.labour_billed_kes).toBe(3000);
      expect(t.parts_billed_kes).toBe(2500);
      expect(t.invoice_amount_kes).toBe(7500);
      expect(t.gross_margin_kes).toBe(3800);
      expect(t.margin_percentage).toBeCloseTo(50.7, 1);
    });

    it('should waive diagnostic callout fee when landlord approves the repair (v2.1 §4.3)', async () => {
      // Create ticket
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          property_id: propertyId,
          customer_id: landlordId,
          category: 'electrical',
          priority: 'standard',
          description: 'Water heater circuit tripping constantly',
          callout_fee_kes: 2000
        });

      const ticketId = ticketRes.body.data.ticket.id;

      // Record repair estimate
      await request(app)
        .post(`/api/tickets/${ticketId}/costs`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          labour_hours: 1.5,
          labour_billed_kes: 3500,
          labour_cost_kes: 1500,
          parts_cost_kes: 2500,
          parts_billed_kes: 3000
        });

      // Landlord approves repair
      const approveRes = await request(app)
        .post(`/api/tickets/${ticketId}/approval`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          action: 'approve',
          notes: 'Customer approved via WhatsApp quote'
        });

      expect(approveRes.statusCode).toBe(200);
      const approvedTicket = approveRes.body.data.ticket;
      expect(approvedTicket.approved_at).toBeTruthy();
      expect(approvedTicket.callout_fee_waived).toBe(1);
      // Invoice should now exclude callout fee: 3,500 + 3,000 = 6,500
      expect(approvedTicket.invoice_amount_kes).toBe(6500);
      // Margin = 6,500 - (1,500 + 2,500) = 2,500
      expect(approvedTicket.gross_margin_kes).toBe(2500);
    });

    it('should attach a 30-day workmanship warranty upon resolution (v2.1 §4.2)', async () => {
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          property_id: propertyId,
          customer_id: landlordId,
          category: 'plumbing',
          description: 'Leaking kitchen tap'
        });

      const ticketId = ticketRes.body.data.ticket.id;

      // Transition to scheduled -> in_progress -> resolved
      await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'scheduled' });

      await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'in_progress' });

      const resolveRes = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'resolved' });

      expect(resolveRes.statusCode).toBe(200);
      const resolvedTicket = resolveRes.body.data.ticket;
      expect(resolvedTicket.resolved_at).toBeTruthy();
      expect(resolvedTicket.warranty_until).toBeTruthy();

      const resolvedTime = new Date(resolvedTicket.resolved_at).getTime();
      const warrantyTime = new Date(resolvedTicket.warranty_until).getTime();
      const diffDays = Math.round((warrantyTime - resolvedTime) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(30);
    });
  });

  describe('2. SLA Timers & Response Compliance (v2.1 §4.4)', () => {
    it('should assign a 3-hour response window for emergency tickets and track response timestamp', async () => {
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          property_id: propertyId,
          category: 'roofing',
          priority: 'emergency',
          description: 'Severe roof leak above electrical fuse box'
        });

      expect(ticketRes.statusCode).toBe(201);
      const ticket = ticketRes.body.data.ticket;
      expect(ticket.sla_response_due_at).toBeTruthy();

      const createdIso = ticket.created_at.includes('T') ? ticket.created_at : `${ticket.created_at.replace(' ', 'T')}Z`;
      const createdTime = new Date(createdIso).getTime();
      const dueTime = new Date(ticket.sla_response_due_at).getTime();
      const diffHours = Math.round((dueTime - createdTime) / (60 * 60 * 1000));
      expect(diffHours).toBe(3);

      // Triage response within SLA
      const triageRes = await request(app)
        .patch(`/api/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'triaged', note: 'Technician mobilized for site dispatch' });

      expect(triageRes.statusCode).toBe(200);
      expect(triageRes.body.data.ticket.responded_at).toBeTruthy();
      expect(triageRes.body.data.ticket.is_sla_breached).toBe(0);
    });
  });

  describe('3. Sawa Care Conversion Engine (v2.1 §5 & §12)', () => {
    it('should qualify repeat customers with >= 3 tickets in 90 days and allow creating Sawa Care contract', async () => {
      // Log 3 completed tickets for landlordId
      for (let i = 1; i <= 3; i++) {
        const tRes = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${tenant1Token}`)
          .send({
            property_id: propertyId,
            customer_id: landlordId,
            category: i === 1 ? 'plumbing' : (i === 2 ? 'electrical' : 'painting'),
            priority: 'standard',
            description: `Repair task ${i} for apartment`
          });

        const tid = tRes.body.data.ticket.id;
        await request(app)
          .post(`/api/tickets/${tid}/costs`)
          .set('Authorization', `Bearer ${tenant1Token}`)
          .send({
            invoice_amount_kes: 4500,
            labour_cost_kes: 1500,
            parts_cost_kes: 1000
          });

        await request(app)
          .patch(`/api/tickets/${tid}/status`)
          .set('Authorization', `Bearer ${tenant1Token}`)
          .send({ status: 'scheduled' });

        await request(app)
          .patch(`/api/tickets/${tid}/status`)
          .set('Authorization', `Bearer ${tenant1Token}`)
          .send({ status: 'in_progress' });

        await request(app)
          .patch(`/api/tickets/${tid}/status`)
          .set('Authorization', `Bearer ${tenant1Token}`)
          .send({ status: 'resolved' });
      }

      // Check Sawa Care eligibility endpoint
      const eligibleRes = await request(app)
        .get('/api/tickets/sawa-care/eligible')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(eligibleRes.statusCode).toBe(200);
      expect(eligibleRes.body.data.count).toBeGreaterThanOrEqual(1);

      const candidate = eligibleRes.body.data.qualified_customers.find(c => c.customer_id === landlordId);
      expect(candidate).toBeTruthy();
      expect(candidate.tickets_count_90d).toBe(3);
      expect(candidate.sawa_care_eligible).toBe(true);
      expect(candidate.total_invoiced_kes).toBe(13500);

      // Convert customer to Sawa Care Home managed contract
      const contractRes = await request(app)
        .post('/api/tickets/sawa-care/contracts')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          customer_id: landlordId,
          tier: 'home',
          status: 'active',
          start_date: '2026-11-01',
          end_date: '2027-10-31',
          monthly_retainer_kes: 3500,
          discount_percentage: 15,
          included_properties_count: 1,
          priority_sla_tier: 'priority_2h',
          notes: 'Converted repeat Airbnb host to Sawa Care Home package'
        });

      expect(contractRes.statusCode).toBe(201);
      expect(contractRes.body.data.contract.tier).toBe('home');
      expect(contractRes.body.data.contract.status).toBe('active');
      expect(contractRes.body.data.contract.discount_percentage).toBe(15);

      // Verify listing
      const listRes = await request(app)
        .get('/api/tickets/sawa-care/contracts')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(listRes.statusCode).toBe(200);
      expect(listRes.body.data.contracts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. Property Maintenance Memory (v2.1 §3, §4.1, §11)', () => {
    it('should generate property health score, recurring failure alerts, and chronological service memory', async () => {
      // Create 2 plumbing tickets in 90 days to trigger recurring alert
      for (let i = 1; i <= 2; i++) {
        const tRes = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${tenant1Token}`)
          .send({
            property_id: propertyId,
            customer_id: landlordId,
            category: 'plumbing',
            priority: 'standard',
            description: `Plumbing leak event #${i}`
          });

        const tid = tRes.body.data.ticket.id;
        await request(app)
          .patch(`/api/tickets/${tid}/status`)
          .set('Authorization', `Bearer ${tenant1Token}`)
          .send({ status: 'scheduled' });
        await request(app)
          .patch(`/api/tickets/${tid}/status`)
          .set('Authorization', `Bearer ${tenant1Token}`)
          .send({ status: 'in_progress' });
        await request(app)
          .patch(`/api/tickets/${tid}/status`)
          .set('Authorization', `Bearer ${tenant1Token}`)
          .send({ status: 'resolved' });
      }

      // Fetch maintenance memory
      const memoryRes = await request(app)
        .get(`/api/properties/${propertyId}/maintenance-memory`)
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(memoryRes.statusCode).toBe(200);
      const mem = memoryRes.body.data;

      expect(mem.property.id).toBe(propertyId);
      expect(mem.lifetime_summary.total_tickets).toBe(2);
      expect(mem.lifetime_summary.completed_tickets).toBe(2);

      // Recurring failure alert detector (>=2 plumbing tickets in 90d)
      expect(mem.recurring_alerts.length).toBe(1);
      expect(mem.recurring_alerts[0].category).toBe('plumbing');
      expect(mem.recurring_alerts[0].occurrences_90d).toBe(2);
      expect(mem.recurring_alerts[0].recommendation).toContain('Recurring plumbing issues detected');

      // Active 30-day warranties
      expect(mem.active_warranties.length).toBe(2);
      expect(mem.active_warranties[0].days_remaining).toBeGreaterThanOrEqual(29);

      // Health Score
      expect(mem.health_score.score).toBeLessThanOrEqual(100);
      expect(mem.health_score.recurring_issues_count).toBe(1);

      // Chronological Service Timeline
      expect(mem.service_history_timeline.length).toBe(2);
    });
  });

  describe('5. Landlord Monthly Consolidated Report (v2.1 §5.1, §7.1)', () => {
    it('should generate monthly report aggregating spend and repair activity for landlord', async () => {
      // Create and resolve ticket
      const tRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          property_id: propertyId,
          customer_id: landlordId,
          category: 'electrical',
          priority: 'standard',
          description: 'Main breaker replacement'
        });

      const tid = tRes.body.data.ticket.id;
      await request(app)
        .post(`/api/tickets/${tid}/costs`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          labour_billed_kes: 3500,
          parts_billed_kes: 2500,
          callout_fee_kes: 1500,
          callout_fee_waived: 0,
          invoice_amount_kes: 7500
        });

      const currentMonth = new Date().toISOString().slice(0, 7);
      const reportRes = await request(app)
        .get(`/api/properties/landlord/${landlordId}/monthly-report?month=${currentMonth}`)
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(reportRes.statusCode).toBe(200);
      const rep = reportRes.body.data;

      expect(rep.report_period).toBe(currentMonth);
      expect(rep.landlord.id).toBe(landlordId);
      expect(rep.portfolio_summary.properties_count).toBe(1);
      expect(rep.portfolio_summary.total_spend_kes).toBe(7500);
      expect(rep.portfolio_summary.spend_breakdown.labour_kes).toBe(3500);
      expect(rep.portfolio_summary.spend_breakdown.parts_kes).toBe(2500);
      expect(rep.portfolio_summary.spend_breakdown.callouts_kes).toBe(1500);
    });
  });

  describe('6. Sawa Repairs Company Plan 90-Day Execution Dashboard (v2.1 §12)', () => {
    it('should return executive scorecard against 90-day targets and financial metrics', async () => {
      // Create one completed ticket with unit economics
      const tRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          property_id: propertyId,
          customer_id: landlordId,
          category: 'solar',
          priority: 'standard',
          description: 'Inverter maintenance check'
        });

      const tid = tRes.body.data.ticket.id;
      await request(app)
        .post(`/api/tickets/${tid}/costs`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          labour_cost_kes: 2000,
          labour_billed_kes: 4500,
          parts_cost_kes: 1500,
          parts_billed_kes: 2000,
          travel_cost_kes: 500,
          invoice_amount_kes: 6500
        });

      await request(app)
        .patch(`/api/tickets/${tid}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'scheduled' });
      await request(app)
        .patch(`/api/tickets/${tid}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'in_progress' });
      await request(app)
        .patch(`/api/tickets/${tid}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'resolved' });

      const planRes = await request(app)
        .get('/api/tickets/dashboard/company-plan')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(planRes.statusCode).toBe(200);
      const scorecard = planRes.body.data.phase1_scorecard;
      expect(scorecard.completed_tickets.target_range).toBe('50–100 tickets');
      expect(scorecard.paying_customers.target_range).toBe('20–30 customers');
      expect(scorecard.repeat_customers_90d.target_range).toBe('8–12 repeat customers');
      expect(scorecard.sawa_care_contracts.target_range).toBe('5–10 contracts');

      const economics = planRes.body.data.unit_economics;
      expect(economics.total_invoiced_kes).toBeGreaterThan(0);
      expect(economics.gross_margin_kes).toBeGreaterThan(0);
      expect(economics.margin_percentage).toBeGreaterThan(0);

      const sla = planRes.body.data.service_quality_and_sla;
      expect(sla.emergency_sla_compliance_pct).toBeDefined();
    });
  });
});
