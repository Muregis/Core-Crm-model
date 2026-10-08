const express = require('express');
const { protect } = require('../middleware/auth');
const { enqueueReportJob } = require('../jobs/producers/reportProducer');

const router = express.Router();

// All routes are protected
router.use(protect);

// Placeholder routes - to be implemented
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Analytics endpoint - Coming soon' });
});

router.post('/sales-report', async (req, res) => {
  try {
    const job = await enqueueReportJob({ reportType: 'sales', filters: req.body.filters });
    
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
