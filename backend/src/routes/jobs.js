const fs = require('fs');
const path = require('path');
const express = require('express');
const { protect } = require('../middleware/auth');
const db = require('../config/database');
const { emailQueue, reportQueue, importQueue } = require('../queue/queues');

const router = express.Router();

// All routes are protected
router.use(protect);
router.use(protect);

const getQueueByName = (name) => {
  if (name === 'email') return emailQueue;
  if (name === 'report') return reportQueue;
  if (name === 'import') return importQueue;
  return null;
};

// GET /api/jobs - List recent jobs for tenant
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const jobs = await db.query(
      'SELECT * FROM jobs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.tenant_id, limit, offset]
    );
    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/stats
router.get('/stats', async (req, res) => {
  try {
    const queues = [emailQueue, reportQueue, importQueue];
    const stats = {};
    for (const q of queues) {
      if (q && typeof q.getJobCounts === 'function') {
        const counts = await q.getJobCounts();
        stats[q.name] = counts;
      }
    }
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch job stats' });
  }
});

// GET /api/jobs/workers/active
router.get('/workers/active', async (req, res) => {
  try {
    const queues = [emailQueue, reportQueue, importQueue];
    let activeWorkers = [];

    for (const q of queues) {
      if (q && typeof q.getWorkers === 'function') {
        const workers = await q.getWorkers();
        activeWorkers = activeWorkers.concat(workers.map((w) => ({ queue: q.name, ...w })));
      }
    }

    res.json({ success: true, data: activeWorkers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch workers' });
  }
});

// GET /api/jobs/:id/result — download completed report artifact
router.get('/:id/result', async (req, res) => {
  try {
    const jobId = req.params.id;

    const bullJob = await reportQueue.getJob(jobId);
    if (bullJob) {
      const state = await bullJob.getState();
      if (state === 'completed') {
        const result = bullJob.returnvalue;
        if (result && result.resultPath && fs.existsSync(result.resultPath)) {
          return res.download(result.resultPath, path.basename(result.resultPath));
        }
        return res.json({ success: true, status: 'completed', data: result });
      }
      return res.status(409).json({
        success: false,
        message: `Job is ${state}; result not ready`,
        status: state
      });
    }

    const rows = await db.query('SELECT * FROM jobs WHERE job_id = ? AND (tenant_id = ? OR tenant_id IS NULL)', [jobId, req.user.tenant_id]);
    const row = Array.isArray(rows) && rows[0] && !Array.isArray(rows[0]) ? rows[0] : (rows && rows[0] && rows[0][0]);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    if (row.result_path && fs.existsSync(row.result_path)) {
      return res.download(row.result_path, path.basename(row.result_path));
    }
    if (row.status === 'completed' && row.result_json) {
      return res.json({
        success: true,
        status: 'completed',
        data: typeof row.result_json === 'string' ? JSON.parse(row.result_json) : row.result_json
      });
    }
    return res.status(409).json({
      success: false,
      message: `Job status is ${row.status}; result not ready`,
      status: row.status
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch job result' });
  }
});

// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
  try {
    const jobId = req.params.id;
    const bullJob = await reportQueue.getJob(jobId);
    if (bullJob) {
      const state = await bullJob.getState();
      return res.json({
        success: true,
        data: {
          jobId: bullJob.id,
          name: bullJob.name,
          status: state,
          attemptsMade: bullJob.attemptsMade,
          data: bullJob.data,
          returnvalue: state === 'completed' ? bullJob.returnvalue : undefined,
          failedReason: state === 'failed' ? bullJob.failedReason : undefined
        }
      });
    }

    const jobs = await db.query('SELECT * FROM jobs WHERE job_id = ? AND (tenant_id = ? OR tenant_id IS NULL)', [jobId, req.user.tenant_id]);
    if (!jobs || jobs.length === 0) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (!jobs || jobs.length === 0) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const job = jobs[0];
    if (job.result && typeof job.result === 'string') {
      try {
        job.result = JSON.parse(job.result);
      } catch (e) {}
    }

    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch job details' });
  }
});

// POST /api/jobs/:type/:id/retry
router.post('/:type/:id/retry', async (req, res) => {
  try {
    const queue = getQueueByName(req.params.type);
    if (!queue) return res.status(400).json({ success: false, message: 'Invalid queue type' });

    const job = await queue.getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found in queue' });

    await job.retry();
    res.json({ success: true, message: 'Job retry initiated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retry job' });
  }
});

// GET /api/jobs/workers/active - List active workers
router.get('/workers/active', async (req, res) => {
  try {
    const queues = [emailQueue, reportQueue, importQueue];
    let activeWorkers = [];

    for (const q of queues) {
      if (q && typeof q.getWorkers === 'function') {
        const workers = await q.getWorkers();
        activeWorkers = activeWorkers.concat(workers.map((w) => ({ queue: q.name, ...w })));
      }
    }

    res.json({ success: true, data: activeWorkers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch workers' });
  }
});
module.exports = router;
