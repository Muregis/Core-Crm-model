const request = require('supertest');
const app = require('../server');
const db = require('../src/config/database');

describe('Sawa Repairs — Client Experience Layer & Public Self-Service Portal', () => {
  let adminToken;
  let tenantId;
  let customerId;
  let propertyId;
  let passportToken;
  let techUserId;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 1. Register tenant admin
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `admin-${suffix}@sawarepairs.co.ke`,
        password: 'Password123!',
        firstName: 'ClientExp',
        lastName: 'Admin',
        role: 'admin',
        tenantName: `Sawa Client Experience ${suffix}`,
        phone: `+254700${String(Date.now()).slice(-6)}`
      });

    expect(adminRes.statusCode).toBeLessThan(300);
    adminToken = adminRes.body.data.token;
    tenantId = adminRes.body.data.user.tenant_id;

    // 2. Create technician within same tenant
    const techRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: `tech-${suffix}@sawarepairs.co.ke`,
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Mwangi (EPRA/NCA Certified)',
        role: 'sales_rep',
        phone: `+254711${String(Date.now()).slice(-6)}`
      });

    expect(techRes.statusCode).toBe(201);
    techUserId = techRes.body.data.userId;

    // 3. Create landlord customer
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Wanjiku',
        lastName: 'Mugo',
        email: `wanjiku-${suffix}@diaspora.co.uk`,
        phone: `+254722${String(Date.now()).slice(-6)}`,
        companyName: 'Kilimani Luxury Portfolio',
        customerType: 'individual'
      });

    expect(custRes.statusCode).toBe(201);
    customerId = custRes.body.data.customer.id;

    // 4. Create property with Airbnb flag enabled
    const propRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer_id: customerId,
        name: 'Kilimani Luxury Airbnb Suites Apt 4B',
        address: 'Chania Avenue, Kilimani, Nairobi',
        unit_count: 1,
        airbnb_managed: 1,
        default_approval_threshold_kes: 7500,
        emergency_auto_containment_limit_kes: 10000,
        notes: 'High-yield Airbnb unit. Immediate response required to protect Superhost rating.'
      });

    expect(propRes.statusCode).toBe(201);
    propertyId = propRes.body.data.property.id;
    passportToken = propRes.body.data.property.passport_token;
    expect(passportToken).toBeDefined();
    expect(passportToken.startsWith('pass_')).toBe(true);
  });

  describe('1. Low-Friction WhatsApp Intake & Live Tracking Link Generation', () => {
    it('accepts WhatsApp report, returns live tracking URL and friendly confirmation message', async () => {
      const waRes = await request(app)
        .post('/api/tickets/whatsapp-intake')
        .send({
          tenant_id: tenantId,
          propertyIdentifier: 'Kilimani Luxury Airbnb Suites Apt 4B',
          category: 'plumbing',
          priority: 'emergency',
          description: 'Master bathroom hot water cylinder leaking onto parquet floor',
          reportedBy: 'Guest - Sarah Jenkins (+1-415-555-0199)',
          unitNumber: '4B',
          photoUrls: [
            'https://storage.sawarepairs.co.ke/uploads/leak_cylinder_1.jpg',
            'https://storage.sawarepairs.co.ke/uploads/water_damage_floor_2.jpg'
          ]
        });

      expect(waRes.status).toBe(201);
      const ticket = waRes.body.data.ticket;
      expect(ticket.ticket_number).toMatch(/^SAW-\d{4}-\d{5}$/);
      expect(ticket.tracking_token).toBeDefined();
      expect(ticket.tracking_token.startsWith('tr_')).toBe(true);
      expect(ticket.tracking_url).toContain(`/track/${ticket.tracking_token}`);
      expect(ticket.whatsapp_confirmation).toContain(ticket.ticket_number);
      expect(ticket.whatsapp_confirmation).toContain('EMERGENCY');
      expect(ticket.whatsapp_confirmation).toContain(ticket.tracking_url);
    });
  });

  describe('2. Client-Facing Public Real-Time Tracking Portal (No Login Required)', () => {
    it('allows client to track ticket in real-time with SLA countdown, vetted fundi badge, and transparent pricing', async () => {
      // 1. Create ticket with technician assigned
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          property_id: propertyId,
          customer_id: customerId,
          category: 'electrical',
          priority: 'emergency',
          description: 'Instant shower circuit breaker tripping immediately when switched on',
          assigned_technician_id: techUserId,
          scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          photo_urls: ['https://storage.sawarepairs.co.ke/uploads/shower_breaker.jpg']
        });
      expect(ticketRes.status).toBe(201);
      const createdTicket = ticketRes.body.data.ticket;

      // 2. Add cost details
      await request(app)
        .post(`/api/tickets/${createdTicket.id}/costs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labour_hours: 1.5,
          hourly_rate_kes: 1500,
          parts_cost_kes: 3000,
          parts_markup_percentage: 20,
          callout_fee_kes: 2000,
          callout_fee_waived: false
        });

      // 3. Public tracking without authentication
      const trackRes = await request(app)
        .get(`/api/public/tickets/track/${createdTicket.tracking_token}`);

      expect(trackRes.status).toBe(200);
      const tracking = trackRes.body.data;

      expect(tracking.ticket_number).toBe(createdTicket.ticket_number);
      expect(tracking.category).toBe('electrical');
      expect(tracking.priority).toBe('emergency');

      // Property info & Passport Token
      expect(tracking.property.name).toBe('Kilimani Luxury Airbnb Suites Apt 4B');
      expect(tracking.property.passport_token).toBe(passportToken);

      // Technician Profile with EPRA/NCA badge
      expect(tracking.technician.name).toContain('John Mwangi');
      expect(tracking.technician.credential_badge).toContain('EPRA/NCA Certified');

      // SLA Countdown Clock
      expect(tracking.sla_clock.committed_hours).toBe(3); // 3h for emergency
      expect(tracking.sla_clock.response_due_at).toBeDefined();

      // Client-facing Milestones
      expect(Array.isArray(tracking.client_milestones)).toBe(true);
      expect(tracking.client_milestones.length).toBe(4);
      expect(tracking.client_milestones[0].title).toBe('Issue Logged');
      expect(tracking.client_milestones[0].completed).toBe(true);

      // Transparent Pricing Policy
      expect(tracking.transparent_pricing.callout_fee_kes).toBe(2000);
      expect(tracking.transparent_pricing.callout_fee_waived).toBe(false);
      expect(tracking.transparent_pricing.parts_markup_policy).toContain('20% transparent handling markup');

      // 30-Day Workmanship Warranty terms
      expect(tracking.workmanship_warranty.terms).toContain('30-Day Zero-Cost Guarantee');

      // Photo Evidence package
      expect(tracking.photos.count).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for invalid tracking token', async () => {
      const notFoundRes = await request(app)
        .get('/api/public/tickets/track/invalid_non_existent_token');
      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.success).toBe(false);
    });
  });

  describe('3. Cross-Timezone Mobile Landlord Approval Workflow', () => {
    it('allows landlord to view quote estimate and waives callout fee upon one-click approval', async () => {
      // 1. Create ticket
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          property_id: propertyId,
          customer_id: customerId,
          category: 'plumbing',
          priority: 'standard',
          description: 'Booster pump pressure switch burnt out, water tank overflowing',
          photo_urls: ['https://storage.sawarepairs.co.ke/uploads/pump_switch.jpg']
        });
      expect(ticketRes.status).toBe(201);
      const approvalTicket = ticketRes.body.data.ticket;

      // 2. Add costs: labour 3,500, parts 9,000 + 20% = 10,800. Total = 14,300 + callout 2,000 = 16,300
      await request(app)
        .post(`/api/tickets/${approvalTicket.id}/costs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          labour_hours: 2,
          labour_billed_kes: 3500,
          parts_cost_kes: 9000,
          parts_markup_percentage: 20,
          callout_fee_kes: 2000
        });

      // 3. Request landlord approval
      const reqApprRes = await request(app)
        .post(`/api/tickets/${approvalTicket.id}/approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'request',
          approval_threshold_kes: 7500,
          notes: 'Pump pressure controller replacement exceeds KES 7,500 threshold'
        });
      expect(reqApprRes.status).toBe(200);
      const approvalToken = reqApprRes.body.data.ticket.approval_token;
      expect(approvalToken).toBeDefined();
      expect(approvalToken.startsWith('appr_')).toBe(true);

      // 4. Landlord views quote without login
      const quoteRes = await request(app)
        .get(`/api/public/tickets/approve/${approvalToken}`);

      expect(quoteRes.status).toBe(200);
      const quote = quoteRes.body.data;
      expect(quote.ticket_number).toBe(approvalTicket.ticket_number);
      expect(quote.approval_required).toBe(true);
      expect(quote.approval_threshold_kes).toBe(7500);
      expect(quote.estimate.labour_billed_kes).toBe(3500);
      expect(quote.estimate.parts_billed_kes).toBe(10800);
      expect(quote.estimate.callout_waived_if_approved).toBe(true);

      // 5. Landlord approves via one-click link (waiving callout fee)
      const approveRes = await request(app)
        .post(`/api/public/tickets/approve/${approvalToken}`)
        .send({
          action: 'approve',
          notes: 'Approved via WhatsApp one-click link from London'
        });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);
      expect(approveRes.body.message).toContain('Call-out fee waived');

      const updatedTicket = approveRes.body.ticket;
      expect(updatedTicket.approved_at).toBeDefined();
      expect(updatedTicket.callout_fee_waived).toBe(1);

      // Verify that callout fee 2,000 was waived: 3500 (labour) + 10800 (parts) = 14300 KES
      expect(updatedTicket.invoice_amount_kes).toBe(14300);

      // 6. Public real-time tracking reflects waived fee
      const trackRes = await request(app)
        .get(`/api/public/tickets/track/${updatedTicket.tracking_token}`);
      expect(trackRes.status).toBe(200);
      expect(trackRes.body.data.transparent_pricing.callout_fee_waived).toBe(true);
      expect(trackRes.body.data.transparent_pricing.total_invoice_kes).toBe(14300);
    });
  });

  describe('4. Client-Facing Property Maintenance Passport & Digital Logbook', () => {
    it('returns Property Maintenance Passport with health score, recurring failure radar, warranties, and Airbnb Superhost checklist', async () => {
      const passportRes = await request(app)
        .get(`/api/public/properties/passport/${passportToken}`);

      expect(passportRes.status).toBe(200);
      const passport = passportRes.body.data.property_passport;

      expect(passport.name).toBe('Kilimani Luxury Airbnb Suites Apt 4B');
      expect(passport.airbnb_managed).toBe(true);
      expect(passport.landlord.name).toContain('Wanjiku Mugo');

      // Health Score (0–100)
      expect(passport.health_score.score).toBeGreaterThanOrEqual(0);
      expect(passport.health_score.score).toBeLessThanOrEqual(100);
      expect(passport.health_score.grade).toBeDefined();

      // Recurring failure radar and alerts
      expect(Array.isArray(passport.recurring_alerts)).toBe(true);

      // Airbnb & Superhost Readiness Checklist
      expect(passport.airbnb_readiness.badge).toBe('Sawa Superhost Certified');
      expect(Array.isArray(passport.airbnb_readiness.checklist)).toBe(true);
      expect(passport.airbnb_readiness.checklist.length).toBeGreaterThanOrEqual(4);
      expect(passport.airbnb_readiness.checklist[0].item).toContain('Water Heaters');
    });

    it('returns 404 for invalid passport token', async () => {
      const res = await request(app)
        .get('/api/public/properties/passport/invalid_passport_token');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('5. Preventive Maintenance Inspection Engine', () => {
    it('schedules, lists, and completes an Airbnb Guest-Ready Audit package', async () => {
      // 1. Schedule inspection
      const scheduleRes = await request(app)
        .post(`/api/properties/${propertyId}/preventive-inspections`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          package_type: 'airbnb_guest_ready',
          scheduled_date: '2026-11-25',
          cost_kes: 4500,
          notes: 'Pre-December holiday booking systems audit'
        });

      expect(scheduleRes.status).toBe(201);
      const insp = scheduleRes.body.data.inspection;
      expect(insp.property_id).toBe(propertyId);
      expect(insp.package_type).toBe('airbnb_guest_ready');
      expect(insp.status).toBe('scheduled');
      expect(insp.cost_kes).toBe(4500);
      const inspectionId = insp.id;

      // 2. List inspections
      const listRes = await request(app)
        .get(`/api/properties/${propertyId}/preventive-inspections`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      const list = listRes.body.data.inspections;
      expect(Array.isArray(list)).toBe(true);
      expect(list.some(i => i.id === inspectionId)).toBe(true);

      // 3. Complete inspection
      const completeRes = await request(app)
        .patch(`/api/properties/preventive-inspections/${inspectionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          overall_condition: 'excellent',
          checklist_results: {
            hot_water: 'passed',
            circuit_breakers: 'passed',
            locksets: 'passed',
            water_pressure: 'passed'
          },
          recommended_actions: 'Replace shower hose washer within 3 months',
          notes: 'Unit is 100% guest-ready for holiday high season'
        });

      expect(completeRes.status).toBe(200);
      const completedInsp = completeRes.body.data.inspection;
      expect(completedInsp.status).toBe('completed');
      expect(completedInsp.overall_condition).toBe('excellent');
      expect(completedInsp.completed_at).toBeDefined();

      // 4. Verify property record updated
      const propRes = await request(app)
        .get(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(propRes.status).toBe(200);
      const prop = propRes.body.data.property;
      expect(prop.last_preventive_inspection_at).toBeDefined();
      expect(prop.next_preventive_inspection_due).toBeDefined();
    });
  });

  describe('6. Client Experience Metrics Scorecard', () => {
    it('returns executive client experience metrics including first-time-fix rate, warranties, and quote acceptance', async () => {
      const metricsRes = await request(app)
        .get('/api/tickets/dashboard/client-experience-metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(metricsRes.status).toBe(200);
      const metrics = metricsRes.body.data;

      expect(metrics.first_time_fix_rate_percentage).toBeDefined();
      expect(metrics.first_time_fix_rate_percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.first_time_fix_rate_percentage).toBeLessThanOrEqual(100);

      expect(metrics.active_warranties_count).toBeDefined();
      expect(metrics.warranty_rework_rate_percentage).toBeDefined();
      expect(metrics.quote_approval_acceptance_rate_percentage).toBeDefined();
      expect(metrics.airbnb_managed_units_count).toBeGreaterThanOrEqual(1);
    });
  });
});
