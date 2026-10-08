const express = require('express');
const { protect } = require('../middleware/auth');
const db = require('../config/database');
const { emailQueue, reportQueue, importQueue } = require('../queue/queues');

const router = express.Router();

// All routes should ideally be protected and check for admin/manager role
router.use(protect);

const getQueueByName = (name) => {
  if (name === 'email') return emailQueue;
  if (name === 'report') return reportQueue;
  if (name === 'import') return importQueue;
  return null;
};

// GET /api/jobs - List recent jobs from MySQL audit table
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const jobs = await db.query('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/stats - Get stats from BullMQ
router.get('/stats', async (req, res) => {
  try {
    const queues = [emailQueue, reportQueue, importQueue];
    const stats = {};
    
    for (const q of queues) {
      const counts = await q.getJobCounts();
      stats[q.name] = counts;
    }
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch job stats' });
  }
});

// GET /api/jobs/:id - Get specific job details
router.get('/:id', async (req, res) => {
  try {
    const jobs = await db.query('SELECT * FROM jobs WHERE job_id = ?', [req.params.id]);
    if (!jobs || jobs.length === 0) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    res.json({ success: true, data: jobs[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch job details' });
  }
});

// POST /api/jobs/:type/:id/retry - Retry a failed job via BullMQ
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

// GET /api/workers - List active workers
router.get('/workers/active', async (req, res) => {
  try {
    const queues = [emailQueue, reportQueue, importQueue];
    let activeWorkers = [];
    
    for (const q of queues) {
      const workers = await q.getWorkers();
      activeWorkers = activeWorkers.concat(workers.map(w => ({ queue: q.name, ...w })));
    }
    
    res.json({ success: true, data: activeWorkers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch workers' });
  }
});

module.exports = router;
