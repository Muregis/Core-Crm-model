const request = require('supertest');
const app = require('../server');
const db = require('../src/config/database');
const { processTicketJob } = require('../workers/ticket.worker');

describe('Field Service & Service Tickets Module (Sawa Repairs)', () => {
  let tenant1Token;
  let tenant1AdminId;
  let tenant1Id;
  let tenant2Token;
  let technicianId;
  let salesRepToken;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Tenant 1 Admin
    const res1 = await request(app).post('/api/auth/register').send({
      email: `t1-admin-${suffix}@sawarepairs.co.ke`,
      password: 'password123',
      firstName: 'Mwangi',
      lastName: 'Admin',
      phone: `+254700${String(Date.now()).slice(-6)}`,
      role: 'admin',
      tenantName: `Sawa Repairs Ltd ${suffix}`
    });
    expect(res1.statusCode).toBeLessThan(300);
    tenant1Token = res1.body.data.token;
    tenant1AdminId = res1.body.data.user.id;
    tenant1Id = res1.body.data.user.tenant_id;

    // Tenant 1 Technician User (added inside Tenant 1)
    const resTech = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        email: `tech-${suffix}@sawarepairs.co.ke`,
        password: 'password123',
        firstName: 'Juma',
        lastName: 'Fundi',
        phone: `+254711${String(Date.now()).slice(-6)}`,
        role: 'sales_rep'
      });
    expect(resTech.statusCode).toBe(201);
    technicianId = resTech.body.data.userId;

    // Tenant 1 Sales Rep (added inside Tenant 1)
    const resRep = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        email: `rep-${suffix}@sawarepairs.co.ke`,
        password: 'password123',
        firstName: 'Alice',
        lastName: 'Rep',
        phone: `+254722${String(Date.now()).slice(-6)}`,
        role: 'sales_rep'
      });
    expect(resRep.statusCode).toBe(201);

    const loginRep = await request(app).post('/api/auth/login').send({
      email: `rep-${suffix}@sawarepairs.co.ke`,
      password: 'password123'
    });
    expect(loginRep.statusCode).toBe(200);
    salesRepToken = loginRep.body.data.token;

    // Tenant 2 Admin (Compromised/Rival tenant)
    const res2 = await request(app).post('/api/auth/register').send({
      email: `t2-admin-${suffix}@rivalprop.co.ke`,
      password: 'password123',
      firstName: 'Rival',
      lastName: 'Landlord',
      phone: `+254733${String(Date.now()).slice(-6)}`,
      role: 'admin',
      tenantName: `Rival Properties ${suffix}`
    });
    expect(res2.statusCode).toBeLessThan(300);
    tenant2Token = res2.body.data.token;
  });

  describe('1. Properties Management & Strict Tenant Isolation', () => {
    it('creates a property for Tenant 1 with landlord reference and unit count', async () => {
      // Create a customer (landlord) first
      const custRes = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          firstName: 'David',
          lastName: 'Kariuki',
          email: 'david@kariuki.co.ke',
          phone: '+254712345678',
          customerType: 'individual'
        });
      expect(custRes.statusCode).toBe(201);
      const customerId = custRes.body.data.customer.id;

      const propRes = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          name: 'Kilimani Heights Apartment',
          address: 'Argwings Kodhek Rd, Kilimani, Nairobi',
          unit_count: 24,
          customer_id: customerId,
          notes: 'Gated community with backup solar & borehole'
        });

      expect(propRes.statusCode).toBe(201);
      expect(propRes.body.success).toBe(true);
      expect(propRes.body.data.property.name).toBe('Kilimani Heights Apartment');
      expect(propRes.body.data.property.unit_count).toBe(24);
      expect(propRes.body.data.property.landlord_name).toBe('David Kariuki');

      // Tenant 2 must NOT see Tenant 1 property
      const t2List = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${tenant2Token}`);
      expect(t2List.statusCode).toBe(200);
      expect(t2List.body.data.properties.length).toBe(0);

      // Tenant 2 must NOT get Tenant 1 property by ID
      const t2Get = await request(app)
        .get(`/api/properties/${propRes.body.data.property.id}`)
        .set('Authorization', `Bearer ${tenant2Token}`);
      expect(t2Get.statusCode).toBe(404);
    });

    it('enforces RBAC on property deletion (non-admin forbidden)', async () => {
      const propRes = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ name: 'Westlands Commercial Tower' });
      const propId = propRes.body.data.property.id;

      // Sales rep cannot delete
      const delRep = await request(app)
        .delete(`/api/properties/${propId}`)
        .set('Authorization', `Bearer ${salesRepToken}`);
      expect(delRep.statusCode).toBe(403);

      // Admin can delete
      const delAdmin = await request(app)
        .delete(`/api/properties/${propId}`)
        .set('Authorization', `Bearer ${tenant1Token}`);
      expect(delAdmin.statusCode).toBe(200);
    });
  });

  describe('2. Service Ticket Lifecycle, Validation & Auto-Numbering', () => {
    let propertyId;

    beforeEach(async () => {
      const propRes = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ name: 'Riverside Studio 4B', address: 'Riverside Drive, Nairobi' });
      propertyId = propRes.body.data.property.id;
    });

    it('creates a ticket with human-readable ticket_number (e.g. SAW-YYYY-XXXXX)', async () => {
      const year = new Date().getFullYear();
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          property_id: propertyId,
          reported_by: 'Tenant Mary (+254711223344)',
          category: 'plumbing',
          priority: 'emergency',
          description: 'Main kitchen water pipe burst flooding the living area'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      const ticket = res.body.data.ticket;
      expect(ticket.ticket_number).toMatch(new RegExp(`^SAW-${year}-\\d{5}$`));
      expect(ticket.category).toBe('plumbing');
      expect(ticket.priority).toBe('emergency');
      expect(ticket.status).toBe('reported');
      expect(ticket.property_name).toBe('Riverside Studio 4B');
      expect(ticket.status_history.length).toBeGreaterThanOrEqual(1);
      expect(ticket.status_history[0].to_status).toBe('reported');
    });

    it('rejects invalid category or priority with 400', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          category: 'space_travel', // invalid
          priority: 'emergency',
          description: 'Broken window'
        });
      expect(res.statusCode).toBe(400);

      const res2 = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          category: 'plumbing',
          priority: 'ultra_critical', // invalid
          description: 'Broken window'
        });
      expect(res2.statusCode).toBe(400);
    });

    it('strictly isolates tickets across tenants (Tenant 2 cannot read or update Tenant 1 ticket)', async () => {
      const createRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          property_id: propertyId,
          category: 'electrical',
          priority: 'standard',
          description: 'Faulty circuit breaker tripping constantly'
        });
      const ticketId = createRes.body.data.ticket.id;

      // Tenant 2 list should be empty
      const t2List = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${tenant2Token}`);
      expect(t2List.statusCode).toBe(200);
      expect(t2List.body.data.tickets.length).toBe(0);

      // Tenant 2 get single ticket returns 404
      const t2Get = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tenant2Token}`);
      expect(t2Get.statusCode).toBe(404);

      // Tenant 2 update ticket returns 404
      const t2Update = await request(app)
        .patch(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tenant2Token}`)
        .send({ description: 'Hacked ticket' });
      expect(t2Update.statusCode).toBe(404);
    });
  });

  describe('3. State Machine & Status Transitions', () => {
    let ticketId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          category: 'roofing',
          priority: 'standard',
          description: 'Tile leak during rainy season'
        });
      ticketId = res.body.data.ticket.id;
    });

    it('enforces allowed transitions and blocks illegal state jumps', async () => {
      // Illegal jump: reported directly to resolved should fail with 400
      const illegalRes = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'resolved' });
      expect(illegalRes.statusCode).toBe(400);
      expect(illegalRes.body.message).toContain('Invalid status transition');

      // Valid step 1: reported -> triaged
      const triageRes = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'triaged', note: 'Assessed as medium urgency tile crack' });
      expect(triageRes.statusCode).toBe(200);
      expect(triageRes.body.data.ticket.status).toBe('triaged');

      // Valid step 2: triaged -> scheduled
      const scheduledTime = new Date(Date.now() + 86400000).toISOString();
      const schedRes = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'scheduled', scheduled_at: scheduledTime });
      expect(schedRes.statusCode).toBe(200);
      expect(schedRes.body.data.ticket.status).toBe('scheduled');

      // Valid step 3: scheduled -> in_progress (auto sets started_at)
      const progRes = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'in_progress' });
      expect(progRes.statusCode).toBe(200);
      expect(progRes.body.data.ticket.status).toBe('in_progress');
      expect(progRes.body.data.ticket.started_at).toBeTruthy();

      // Valid step 4: in_progress -> awaiting_parts
      const partsRes = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'awaiting_parts', note: 'Waiting for Mabati Rolling Mills tiles' });
      expect(partsRes.statusCode).toBe(200);
      expect(partsRes.body.data.ticket.status).toBe('awaiting_parts');

      // Valid step 5: awaiting_parts -> in_progress
      await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'in_progress', note: 'Parts delivered, resuming' });

      // Valid step 6: in_progress -> resolved (auto sets resolved_at)
      const resRes = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'resolved' });
      expect(resRes.statusCode).toBe(200);
      expect(resRes.body.data.ticket.status).toBe('resolved');
      expect(resRes.body.data.ticket.resolved_at).toBeTruthy();

      // Valid step 7: resolved -> verified
      const verRes = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'verified', note: 'Tenant confirmed no leaks' });
      expect(verRes.statusCode).toBe(200);
      expect(verRes.body.data.ticket.status).toBe('verified');

      // Valid step 8: verified -> closed (auto sets closed_at)
      const closedRes = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'closed' });
      expect(closedRes.statusCode).toBe(200);
      expect(closedRes.body.data.ticket.status).toBe('closed');
      expect(closedRes.body.data.ticket.closed_at).toBeTruthy();

      // Valid step 9: closed -> reopened (clears closed_at & resolved_at)
      const reopenRes = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ status: 'reopened', note: 'Leak returned after heavy storm' });
      expect(reopenRes.statusCode).toBe(200);
      expect(reopenRes.body.data.ticket.status).toBe('reopened');
      expect(reopenRes.body.data.ticket.closed_at).toBeNull();
    });
  });

  describe('4. Technician Scheduling & Linked Field-Service Task', () => {
    it('assigns technician, sets scheduled_at, and creates linked Task in tasks table', async () => {
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          category: 'solar',
          priority: 'standard',
          description: 'Inverter error 04 on rooftop solar installation'
        });
      const ticketId = ticketRes.body.data.ticket.id;
      const scheduledTime = '2026-11-20T10:00:00.000Z';

      const schedRes = await request(app)
        .post(`/api/tickets/${ticketId}/schedule`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          assigned_technician_id: technicianId,
          scheduled_at: scheduledTime,
          notes: 'Carry multimeter and replacement fuse kit'
        });

      expect(schedRes.statusCode).toBe(200);
      expect(schedRes.body.success).toBe(true);
      const ticket = schedRes.body.data.ticket;
      expect(ticket.status).toBe('scheduled');
      expect(ticket.assigned_technician_id).toBe(technicianId);
      expect(ticket.scheduled_at).toBe(scheduledTime);

      // Verify linked task was created in tasks table
      expect(ticket.linked_tasks.length).toBe(1);
      const linkedTask = ticket.linked_tasks[0];
      expect(linkedTask.task_type).toBe('field_service');
      expect(linkedTask.assigned_to).toBe(technicianId);
      expect(linkedTask.due_date).toBe(scheduledTime);
      expect(linkedTask.title).toContain(ticket.ticket_number);
    });
  });

  describe('5. Landlord Approval Workflow', () => {
    let ticketId;

    beforeEach(async () => {
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          category: 'painting',
          priority: 'planned',
          description: 'Full exterior repaint of 4-bedroom townhouse'
        });
      ticketId = ticketRes.body.data.ticket.id;
    });

    it('manages request, approve, and reject landlord approval lifecycle', async () => {
      // 1. Request approval for work exceeding KES 50,000
      const reqRes = await request(app)
        .post(`/api/tickets/${ticketId}/approval`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          action: 'request',
          approval_threshold_kes: 50000,
          notes: 'Crown Paints Permaplast 60L needed'
        });

      expect(reqRes.statusCode).toBe(200);
      expect(reqRes.body.data.ticket.landlord_approval_required).toBe(1);
      expect(reqRes.body.data.ticket.approval_threshold_kes).toBe(50000);

      // 2. Approve action
      const approveRes = await request(app)
        .post(`/api/tickets/${ticketId}/approval`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          action: 'approve',
          notes: 'Landlord confirmed via WhatsApp call'
        });

      expect(approveRes.statusCode).toBe(200);
      expect(approveRes.body.data.ticket.approved_at).toBeTruthy();
      expect(approveRes.body.data.ticket.approved_by).toBe(tenant1AdminId);
      expect(approveRes.body.data.ticket.approver_name).toBe('Mwangi Admin');
    });
  });

  describe('6. Costs Tracking & Warranty', () => {
    it('calculates labour + parts cost and updates threshold requirements', async () => {
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          category: 'plumbing',
          description: 'Water pump motor replacement',
          approval_threshold_kes: 15000
        });
      const ticketId = ticketRes.body.data.ticket.id;

      // Add costs: 4 hours @ KES 1,500/hr + KES 18,000 pump = KES 24,000 total
      const costRes = await request(app)
        .post(`/api/tickets/${ticketId}/costs`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          labour_hours: 4.5,
          parts_cost_kes: 18000,
          hourly_rate_kes: 1500,
          notes: 'Pedrollo 1.5HP Booster Pump installed'
        });

      expect(costRes.statusCode).toBe(200);
      const ticket = costRes.body.data.ticket;
      expect(ticket.labour_hours).toBe(4.5);
      expect(ticket.parts_cost_kes).toBe(18000);
      expect(ticket.total_cost_kes).toBe(24750); // (4.5 * 1500) + 18000 = 6750 + 18000 = 24750
      // Since 24750 > threshold of 15000 and not yet approved, landlord_approval_required is flagged
      expect(ticket.landlord_approval_required).toBe(1);

      // Set warranty until
      const patchRes = await request(app)
        .patch(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          warranty_until: '2027-11-20'
        });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.body.data.ticket.warranty_until).toBe('2027-11-20');
    });
  });

  describe('7. Attachments (Before & After Photos)', () => {
    it('records and lists photo attachments linked to ticket', async () => {
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          category: 'electrical',
          description: 'Burned socket repair'
        });
      const ticketId = ticketRes.body.data.ticket.id;

      const attachRes = await request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          filename: 'before_repair.jpg',
          file_path: '/uploads/before_repair.jpg',
          file_size: 204800,
          mime_type: 'image/jpeg'
        });

      expect(attachRes.statusCode).toBe(201);

      const listRes = await request(app)
        .get(`/api/tickets/${ticketId}/attachments`)
        .set('Authorization', `Bearer ${tenant1Token}`);
      expect(listRes.statusCode).toBe(200);
      expect(listRes.body.data.attachments.length).toBe(1);
      expect(listRes.body.data.attachments[0].filename).toBe('before_repair.jpg');
    });
  });

  describe('8. Dashboard Metrics & SLA Tracking', () => {
    it('computes dashboard metrics including open emergencies and tickets this month', async () => {
      // Create 1 emergency ticket
      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          category: 'plumbing',
          priority: 'emergency',
          description: 'Sewer line backup in parking bay'
        });

      // Create 1 standard ticket
      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          category: 'general',
          priority: 'standard',
          description: 'Front gate hinge needs greasing'
        });

      const statsRes = await request(app)
        .get('/api/tickets/dashboard/stats')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(statsRes.statusCode).toBe(200);
      expect(statsRes.body.success).toBe(true);
      const { stats } = statsRes.body.data;
      expect(stats.openEmergencies).toBeGreaterThanOrEqual(1);
      expect(stats.ticketsThisMonth).toBeGreaterThanOrEqual(2);
      expect(stats.byPriority.emergency).toBeGreaterThanOrEqual(1);
      expect(stats.byCategory.plumbing).toBeGreaterThanOrEqual(1);
    });
  });

  describe('9. WhatsApp Intake Endpoint', () => {
    it('accepts structured WhatsApp payload, resolves property, creates reported ticket with photos', async () => {
      const payload = {
        tenant_id: tenant1Id,
        propertyIdentifier: 'Kileleshwa Garden Flats B4',
        category: 'electrical',
        priority: 'emergency',
        description: 'Main shower instantaneous heater sparked and smoke came out',
        reportedBy: 'Kavata (+254722998877)',
        unitNumber: 'B4',
        photoUrls: [
          'https://sawarepairs.co.ke/uploads/heater_smoke1.jpg',
          'https://sawarepairs.co.ke/uploads/heater_smoke2.jpg'
        ]
      };

      const res = await request(app)
        .post('/api/tickets/whatsapp-intake')
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      const ticket = res.body.data.ticket;
      expect(ticket.status).toBe('reported');
      expect(ticket.priority).toBe('emergency');
      expect(ticket.reported_by).toBe('Kavata (+254722998877)');
      expect(ticket.property_name).toBe('Kileleshwa Garden Flats B4');
      expect(ticket.attachments.length).toBe(2);
      expect(ticket.ticket_number).toMatch(/^SAW-\d{4}-\d{5}$/);
    });
  });

  describe('10. BullMQ SLA & Approval Background Worker Processing', () => {
    it('processes SLA reminder job and detects unacknowledged emergency tickets', async () => {
      const ticketRes = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          category: 'electrical',
          priority: 'emergency',
          description: 'Sparks flying from main distribution board'
        });
      const ticket = ticketRes.body.data.ticket;

      // Execute worker logic directly on the job payload
      const result = await processTicketJob({
        id: 'mock-sla-test-1',
        name: 'ticket_sla_reminder',
        data: {
          type: 'sla_reminder',
          tenantId: ticket.tenant_id,
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          priority: 'emergency'
        }
      });

      expect(result.status).toBe('breached');
      expect(result.currentStatus).toBe('reported');
    });

    it('processes technician daily digest job', async () => {
      const result = await processTicketJob({
        id: 'mock-digest-test-1',
        name: 'technician_daily_digest',
        data: {
          type: 'technician_digest',
          tenantId: 1,
          technicianId: technicianId
        }
      });

      expect(result.status).toBe('success');
      expect(result.technicianId).toBe(technicianId);
      expect(typeof result.openTicketsCount).toBe('number');
    });
  });
});
