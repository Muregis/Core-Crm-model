const express = require('express');
const { protect } = require('../middleware/auth');
const { enqueueEmailJob } = require('../jobs/producers/emailProducer');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.use(protect);

// GET /api/communications - List tenant communications
router.get('/', async (req, res) => {
  try {
    const list = await db.query(
      `SELECT c.*, (u.first_name || ' ' || u.last_name) as user_name
       FROM communications c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.tenant_id = ?
       ORDER BY c.created_at DESC`,
      [req.user.tenant_id]
    );
    res.json({ success: true, data: { communications: list } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch communications' });
  }
});

// POST /api/communications/email - Enqueue an asynchronous email job
router.post('/email', async (req, res) => {
  try {
    const { to, subject, body, customerId, leadId } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const idempotencyKey = req.body.idempotencyKey || uuidv4();
    
    const job = await enqueueEmailJob({
      to,
      subject,
      body,
      tenantId: req.user.tenant_id,
      userId: req.user.id,
      idempotencyKey
    });

    // Record in communications table
    await db.query(
      `INSERT INTO communications (tenant_id, customer_id, lead_id, user_id, type, direction, subject, content, status)
       VALUES (?, ?, ?, ?, 'email', 'outbound', ?, ?, 'queued')`,
      [req.user.tenant_id, customerId || null, leadId || null, req.user.id, subject, body]
    );
    
    // HTTP 202 Accepted
    res.status(202).json({
      success: true,
      message: 'Email job accepted for processing',
      jobId: job.id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to enqueue email job' });
  }
});

module.exports = router;
