const express = require('express');
const { protect } = require('../middleware/auth');
const { enqueueReportJob } = require('../jobs/producers/reportProducer');
const db = require('../config/database');

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/', (req, res) => {
  res.json({ success: true, message: 'Analytics endpoint' });
});

// POST /api/analytics/sales-report - Trigger background report generation
router.post('/sales-report', async (req, res) => {
  try {
    const { filters, idempotencyKey } = req.body;
    
    const job = await enqueueReportJob({
      reportType: 'sales',
      filters: filters || {},
      tenantId: req.user.tenant_id,
      userId: req.user.id,
      idempotencyKey
    });

    // Ensure job record is recorded in jobs audit table for status retrieval
    const existing = await db.query('SELECT id, status FROM jobs WHERE job_id = ?', [job.id]);
    if (!existing || existing.length === 0) {
      await db.query(
        'INSERT INTO jobs (job_id, tenant_id, type, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [job.id, req.user.tenant_id, 'report', 'waiting', JSON.stringify({ reportType: 'sales', filters })]
      );
    }

    // HTTP 202 Accepted
    res.status(202).json({
      success: true,
      message: 'Report generation started',
      jobId: job.id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to enqueue report job' });
  }
});

module.exports = router;
