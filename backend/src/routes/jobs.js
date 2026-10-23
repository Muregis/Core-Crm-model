const express = require('express');
const { protect } = require('../middleware/auth');
const db = require('../config/database');
const { emailQueue, reportQueue, importQueue } = require('../queue/queues');

const router = express.Router();
router.use(protect);

const queues = { email: emailQueue, report: reportQueue, import: importQueue };

function parseResult(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
}

async function findOwnedJob(jobId, tenantId) {
  const rows = await db.query('SELECT * FROM jobs WHERE job_id = ? AND tenant_id = ?', [
    String(jobId),
    tenantId
  ]);
  return rows && rows.length ? rows[0] : null;
}

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
    const jobs = await db.query(
      'SELECT job_id, type, status, priority, attempts, max_attempts, error_message, started_at, completed_at, failed_at, created_at, updated_at FROM jobs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.tenant_id, limit, offset]
    );
    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch jobs' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const rows = await db.query(
      'SELECT status, COUNT(*) AS count FROM jobs WHERE tenant_id = ? GROUP BY status',
      [req.user.tenant_id]
    );
    const stats = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    for (const row of rows || []) {
      if (Object.prototype.hasOwnProperty.call(stats, row.status)) {
        stats[row.status] = Number(row.count) || 0;
      }
    }
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch job stats' });
  }
});

// Platform-wide worker inventory is intentionally NOT exposed on the tenant API.

router.get('/:id/result', async (req, res) => {
  try {
    const row = await findOwnedJob(req.params.id, req.user.tenant_id);
    if (!row) return res.status(404).json({ success: false, message: 'Job not found' });
    if (row.status !== 'completed') {
      return res.status(409).json({
        success: false,
        message: `Job status is ${row.status}; result not ready`,
        status: row.status
      });
    }
    return res.json({ success: true, status: row.status, data: parseResult(row.result) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch job result' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await findOwnedJob(req.params.id, req.user.tenant_id);
    if (!row) return res.status(404).json({ success: false, message: 'Job not found' });

    const queueName =
      row.type === 'report' || row.type === 'generate_sales_report' ? 'report' : row.type;
    const queue = queues[queueName];
    let queueState = null;
    let attemptsMade = Number(row.attempts) || 0;

    // Queue lookup is optional enrichment. Audit-table status is authoritative.
    if (queue && typeof queue.getJob === 'function') {
      try {
        const bullJob = await queue.getJob(String(row.job_id));
        if (bullJob) {
          if (typeof bullJob.getState === 'function') {
            queueState = await bullJob.getState();
          }
          if (bullJob.attemptsMade != null) {
            attemptsMade = bullJob.attemptsMade;
          }
        }
      } catch (_) {
        // Redis/mock unavailable — still return the tenant-owned audit row
      }
    }

    return res.json({
      success: true,
      data: {
        jobId: row.job_id,
        type: row.type,
        status: row.status,
        queueStatus: queueState,
        attemptsMade,
        maxAttempts: row.max_attempts,
        result: row.status === 'completed' ? parseResult(row.result) : undefined,
        errorMessage: row.error_message || undefined,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        failedAt: row.failed_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch job details' });
  }
});

router.post('/:type/:id/retry', async (req, res) => {
  try {
    const row = await findOwnedJob(req.params.id, req.user.tenant_id);
    if (!row) return res.status(404).json({ success: false, message: 'Job not found' });
    if (row.status !== 'failed') {
      return res.status(409).json({ success: false, message: 'Only failed jobs can be retried' });
    }

    const queueName = req.params.type;
    const queue = queues[queueName];
    if (
      !queue ||
      (row.type !== queueName &&
        !(queueName === 'report' && row.type === 'generate_sales_report'))
    ) {
      return res.status(400).json({ success: false, message: 'Queue type does not match this job' });
    }

    const job = await queue.getJob(String(row.job_id));
    if (!job || typeof job.retry !== 'function') {
      return res.status(404).json({ success: false, message: 'Job is no longer available to retry' });
    }

    await job.retry();
    await db.query(
      'UPDATE jobs SET status = ?, error_message = NULL, failed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE job_id = ? AND tenant_id = ?',
      ['waiting', String(row.job_id), req.user.tenant_id]
    );
    return res.json({ success: true, message: 'Retry scheduled', jobId: row.job_id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retry job' });
  }
});

module.exports = router;
