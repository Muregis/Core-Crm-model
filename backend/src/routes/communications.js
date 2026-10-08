const express = require('express');
const { protect } = require('../middleware/auth');
const { enqueueEmailJob } = require('../jobs/producers/emailProducer');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// All routes are protected
router.use(protect);

// Placeholder routes - to be implemented
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Communications endpoint - Coming soon' });
});

// Enqueue an email job
router.post('/email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const idempotencyKey = req.body.idempotencyKey || uuidv4();
    
    const job = await enqueueEmailJob({ to, subject, body, idempotencyKey });
    
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
