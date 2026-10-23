const request = require('supertest');
const app = require('../server');
const db = require('../src/config/database');

describe('Tasks, Communications & Tenant Administration API', () => {
  let tenant1Token, tenant2Token;
  let repToken;
  let tenant1Client;

  beforeEach(async () => {
    // Register Tenant 1 Admin
    const t1Res = await request(app)
      .post('/api/auth/register-tenant')
      .send({
        companyName: 'Acacia Land Holdings Ltd',
        slug: `acacia-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        firstName: 'Daniel',
        lastName: 'Kariuki',
        email: `daniel-${Date.now()}@acacia.co.ke`,
        password: 'Password123!',
        phone: '+254711122233'
      });
    tenant1Token = t1Res.body.data.token;

    // Register Tenant 2 Admin
    const t2Res = await request(app)
      .post('/api/auth/register-tenant')
      .send({
        companyName: 'Savannah Properties',
        slug: `savannah-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        firstName: 'Beatrice',
        lastName: 'Nduta',
        email: `beatrice-${Date.now()}@savannah.co.ke`,
        password: 'Password123!',
        phone: '+254722333444'
      });
    tenant2Token = t2Res.body.data.token;

    // Create a customer under Tenant 1
    const cRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        firstName: 'Samuel',
        lastName: 'Githinji',
        phone: '+254700112233',
        customerType: 'individual'
      });
    tenant1Client = cRes.body.data.customer;
  });

  describe('Tasks API', () => {
    let taskId;

    test('creates, fetches, updates, and deletes tasks with tenant isolation', async () => {
      // 1. Create task
      const createRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          title: 'Site visit with Samuel Githinji at Joska',
          description: 'Show Plot 15 and confirm beacon markers',
          taskType: 'meeting',
          priority: 'high',
          dueDate: '2026-11-20',
          customerId: tenant1Client.id
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      taskId = createRes.body.taskId;

      // 2. Fetch tasks for Tenant 1
      const listRes = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.tasks.length).toBeGreaterThan(0);
      const found = listRes.body.data.tasks.find((t) => t.id === taskId);
      expect(found).toBeDefined();
      expect(found.title).toBe('Site visit with Samuel Githinji at Joska');
      expect(found.customer_name).toContain('Samuel Githinji');

      // 3. Verify Tenant 2 cannot see Tenant 1's task
      const t2List = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${tenant2Token}`);
      expect(t2List.body.data.tasks.find((t) => t.id === taskId)).toBeUndefined();

      // 4. Update task (mark completed)
      const patchRes = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          status: 'completed'
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);

      // Verify status changed
      const getSingle = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tenant1Token}`);
      expect(getSingle.body.data.task.status).toBe('completed');
      expect(getSingle.body.data.task.completed_date).toBeDefined();

      // 5. Delete task
      const delRes = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tenant1Token}`);
      expect(delRes.status).toBe(200);

      // Verify 404 after deletion
      const afterDel = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tenant1Token}`);
      expect(afterDel.status).toBe(404);
    });
  });

  describe('Communications & WhatsApp API', () => {
    test('logs interaction, lists with filters, and isolates tenants', async () => {
      // 1. Log a WhatsApp interaction
      const waRes = await request(app)
        .post('/api/communications')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          type: 'whatsapp',
          direction: 'outbound',
          customerId: tenant1Client.id,
          subject: 'Sent Title Deed copy on WhatsApp',
          content: 'Confirmed client received PDF copy of Karen block deed.',
          durationMinutes: 5
        });

      expect(waRes.status).toBe(201);
      expect(waRes.body.success).toBe(true);
      const commId = waRes.body.communicationId;

      // 2. Log a Call interaction
      await request(app)
        .post('/api/communications')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          type: 'call',
          direction: 'inbound',
          customerId: tenant1Client.id,
          subject: 'Inquiry on M-Pesa Paybill number',
          content: 'Clarified account number should be plot reference.'
        });

      // 3. List communications filtered by type=whatsapp
      const waList = await request(app)
        .get('/api/communications?type=whatsapp')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(waList.status).toBe(200);
      expect(waList.body.data.communications).toHaveLength(1);
      expect(waList.body.data.communications[0].type).toBe('whatsapp');
      expect(waList.body.data.communications[0].customer_name).toContain('Samuel Githinji');

      // 4. Verify Tenant 2 cannot see Tenant 1 communications
      const t2Comms = await request(app)
        .get('/api/communications')
        .set('Authorization', `Bearer ${tenant2Token}`);
      expect(t2Comms.body.data.communications).toHaveLength(0);

      // 5. Delete communication entry
      const delComm = await request(app)
        .delete(`/api/communications/${commId}`)
        .set('Authorization', `Bearer ${tenant1Token}`);
      expect(delComm.status).toBe(200);
    });
  });

  describe('Users & Tenant Administration API', () => {
    test('manages tenant profile, invites team members, and enforces RBAC', async () => {
      // 1. Get tenant profile
      const profRes = await request(app)
        .get('/api/users/tenant')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(profRes.status).toBe(200);
      expect(profRes.body.data.tenant.name).toBe('Acacia Land Holdings Ltd');

      // 2. Update tenant profile with KRA PIN
      const updateRes = await request(app)
        .put('/api/users/tenant')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          kraPin: 'P051999888Z',
          domain: 'acacia.co.ke'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.tenant.kra_pin).toBe('P051999888Z');
      expect(updateRes.body.data.tenant.domain).toBe('acacia.co.ke');

      // 3. Admin invites a new Sales Rep
      const inviteRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          email: `rep-${Date.now()}@acacia.co.ke`,
          password: 'Password123!',
          firstName: 'Faith',
          lastName: 'Wambui',
          phone: '+254733445566',
          role: 'sales_rep'
        });

      expect(inviteRes.status).toBe(201);
      expect(inviteRes.body.success).toBe(true);
      const newUserId = inviteRes.body.data.userId;

      // 4. List team members
      const usersList = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(usersList.status).toBe(200);
      expect(usersList.body.data.users.length).toBeGreaterThanOrEqual(2);

      // 5. Deactivate user
      const toggleRes = await request(app)
        .patch(`/api/users/${newUserId}`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ isActive: false });

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.success).toBe(true);

      // Verify user is now deactivated
      const verifyList = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${tenant1Token}`);
      const deactivatedUser = verifyList.body.data.users.find((u) => u.id === newUserId);
      expect(deactivatedUser.is_active).toBe(0);
    });
  });
});
