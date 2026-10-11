const request = require('supertest');
const app = require('../server');
const { processReport } = require('../workers/report.worker');
const db = require('../src/config/database');

describe('BullMQ Queue Workflow & Jobs Endpoints', () => {
  let tenant1Token;
  let tenant2Token;

  beforeEach(async () => {
    // 1. Tenant 1 Admin
    const res1 = await request(app).post('/api/auth/register').send({
      email: 'queueadmin1@tenant1.com',
      password: 'password123',
      firstName: 'Queue',
      lastName: 'One',
      phone: '+254711888881',
      role: 'admin',
      tenantName: 'Tenant One'
    });
    tenant1Token = res1.body.data.token;

    // 2. Tenant 2 Admin
    const res2 = await request(app).post('/api/auth/register').send({
      email: 'queueadmin2@tenant2.com',
      password: 'password123',
      firstName: 'Queue',
      lastName: 'Two',
      phone: '+254722888882',
      role: 'admin',
      tenantName: 'Tenant Two'
    });
    tenant2Token = res2.body.data.token;
  });

  describe('Asynchronous Job Dispatch & Idempotency', () => {
    it('should enqueue a sales report job and return 202 Accepted', async () => {
      const res = await request(app)
        .post('/api/analytics/sales-report')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({
          filters: { year: 2026 },
          idempotencyKey: 'idemp-key-1001'
        });

      expect(res.statusCode).toEqual(202);
      expect(res.body.success).toBe(true);
      expect(res.body.jobId).toBe('idemp-key-1001');
    });

    it('should be idempotent when enqueuing with identical idempotencyKey', async () => {
      const res1 = await request(app)
        .post('/api/analytics/sales-report')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ idempotencyKey: 'idemp-duplicate-test' });

      const res2 = await request(app)
        .post('/api/analytics/sales-report')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ idempotencyKey: 'idemp-duplicate-test' });

      expect(res1.body.jobId).toEqual(res2.body.jobId);
    });
  });

  describe('Worker Processing & Result Persistence', () => {
    it('worker should process sales report job, persist results, and retrieve status via API', async () => {
      // 1. Enqueue job
      const enqueueRes = await request(app)
        .post('/api/analytics/sales-report')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ idempotencyKey: 'job-process-e2e' });

      const jobId = enqueueRes.body.jobId;

      // 2. Execute worker processor
      const fakeJob = {
        id: jobId,
        data: {
          reportType: 'sales',
          filters: {},
          tenantId: 1
        }
      };

      const result = await processReport(fakeJob);
      expect(result).toBeDefined();
      expect(result.totalDeals).toBeDefined();
      expect(result.revenue).toBeDefined();

      // 3. Status API retrieval (GET /api/jobs/:id)
      const statusRes = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${tenant1Token}`);

      expect(statusRes.statusCode).toEqual(200);
      expect(statusRes.body.success).toBe(true);
      expect(statusRes.body.data.status).toBe('completed');
      expect(statusRes.body.data.result).toBeDefined();
      expect(statusRes.body.data.result.totalDeals).toBe(result.totalDeals);
    });

    it('worker should throw error on unknown report type', async () => {
      const badJob = {
        id: 'bad-job-id',
        data: {
          reportType: 'unsupported_type',
          tenantId: 1
        }
      };

      await expect(processReport(badJob)).rejects.toThrow('Unknown report type: unsupported_type');
    });
  });

  describe('Job Tenant Isolation', () => {
    it('Tenant 2 should NOT retrieve Tenant 1 job details (404 Not Found)', async () => {
      const enqueueRes = await request(app)
        .post('/api/analytics/sales-report')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send({ idempotencyKey: 'job-tenant-isolation-test' });

      const jobId = enqueueRes.body.jobId;

      const res = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(res.statusCode).toEqual(404);
    });
  });
});
