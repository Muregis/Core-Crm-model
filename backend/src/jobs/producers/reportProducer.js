const { reportQueue } = require('../../queue/queues');
const db = require('../../config/database');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

async function enqueueReportJob(data) {
  const tenantId = Number(data.tenantId);
  const userId = Number(data.userId);

  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    throw new Error('A valid tenantId is required to enqueue a report');
  }
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('A valid userId is required to enqueue a report');
  }
  if (data.reportType !== 'sales') {
    throw new Error('Unsupported report type');
  }

  const idempotencyKey = typeof data.idempotencyKey === 'string'
    ? data.idempotencyKey.trim().slice(0, 120)
    : '';
  const jobId = idempotencyKey
    ? `tenant-${tenantId}-${idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`
    : uuidv4();

  const payload = {
    reportType: data.reportType,
    filters: data.filters || {},
    tenantId,
    userId
  };

  const existing = await db.query(
    'SELECT job_id, tenant_id, status FROM jobs WHERE job_id = ? AND tenant_id = ?',
    [jobId, tenantId]
  );

  if (existing && existing.length > 0) {
    // True idempotency: same key + tenant always returns the same job id.
    try {
      const existingJob = await reportQueue.getJob(jobId);
      if (existingJob) return existingJob;
    } catch (_) {
      // Redis unavailable — still honor the audit row
    }
    return { id: jobId, data: payload, name: 'generate_sales_report' };
  }

  await db.query(
    'INSERT INTO jobs (job_id, tenant_id, type, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    [jobId, tenantId, 'report', 'waiting', JSON.stringify(payload)]
  );

  try {
    const job = await reportQueue.add('generate_sales_report', payload, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: false,
      removeOnFail: false,
      priority: data.priority || 5
    });
    logger.info('Enqueued tenant-scoped sales report', {
      jobId: job.id,
      tenantId,
      userId
    });
    return job;
  } catch (error) {
    await db.query(
      'UPDATE jobs SET status = ?, error_message = ?, failed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE job_id = ? AND tenant_id = ?',
      ['failed', 'Queue unavailable; report was not enqueued', jobId, tenantId]
    );
    logger.error('Error enqueueing report job', { jobId, tenantId, message: error.message });
    throw error;
  }
}

module.exports = { enqueueReportJob };
