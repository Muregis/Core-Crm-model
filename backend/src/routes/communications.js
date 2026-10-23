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
    const { type, customerId, dealId, limit = 50 } = req.query;
    let sql = `
      SELECT c.*, 
        (u.first_name || ' ' || u.last_name) as user_name,
        (cust.first_name || ' ' || cust.last_name) as customer_name,
        cust.phone as customer_phone,
        (ld.first_name || ' ' || ld.last_name) as lead_name,
        ld.phone as lead_phone,
        d.title as deal_title
      FROM communications c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN customers cust ON c.customer_id = cust.id
      LEFT JOIN leads ld ON c.lead_id = ld.id
      LEFT JOIN deals d ON c.deal_id = d.id
      WHERE c.tenant_id = ?
    `;
    const params = [req.user.tenant_id];

    if (type) {
      sql += ' AND c.type = ?';
      params.push(type);
    }
    if (customerId) {
      sql += ' AND c.customer_id = ?';
      params.push(customerId);
    }
    if (dealId) {
      sql += ' AND c.deal_id = ?';
      params.push(dealId);
    }

    sql += ' ORDER BY c.created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10) || 50);

    const list = await db.query(sql, params);
    res.json({ success: true, data: { communications: list } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch communications' });
  }
});

// POST /api/communications - Log a call, WhatsApp message, meeting, SMS, or note
router.post('/', async (req, res) => {
  try {
    const {
      type = 'call',
      direction = 'outbound',
      subject,
      content,
      durationMinutes,
      status = 'completed',
      customerId,
      leadId,
      dealId,
      nextFollowUp
    } = req.body;

    if (!content && !subject) {
      return res.status(400).json({ success: false, message: 'Subject or content note is required' });
    }

    // Determine target customer_id (or 0 if lead only)
    let finalCustomerId = customerId ? parseInt(customerId, 10) : null;
    if (!finalCustomerId && leadId) {
      // Check if lead was converted
      const leads = await db.query('SELECT converted_to_customer_id FROM leads WHERE id = ?', [leadId]);
      if (leads.length > 0 && leads[0].converted_to_customer_id) {
        finalCustomerId = leads[0].converted_to_customer_id;
      }
    }

    const result = await db.query(
      `INSERT INTO communications (
        tenant_id, customer_id, lead_id, deal_id, type, direction,
        subject, content, duration_minutes, status, next_follow_up, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.tenant_id,
        finalCustomerId || 0,
        leadId || null,
        dealId || null,
        type,
        direction,
        subject || `${type.toUpperCase()} interaction`,
        content || '',
        durationMinutes ? parseInt(durationMinutes, 10) : null,
        status,
        nextFollowUp || null,
        req.user.id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Communication logged successfully',
      communicationId: result.insertId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to log communication' });
  }
});

// DELETE /api/communications/:id - Delete an activity record
router.delete('/:id', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM communications WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.user.tenant_id]
    );
    res.json({ success: true, message: 'Communication deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete communication' });
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
