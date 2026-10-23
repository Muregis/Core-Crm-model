const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { enqueueReportJob } = require('../jobs/producers/reportProducer');
const {
  getAnalyticsOverview,
  getExpenditures,
  createExpenditure,
  deleteExpenditure
} = require('../controllers/analyticsController');
const logger = require('../utils/logger');

const router = express.Router();

router.use(protect);

// Executive & Boardroom Analytics
router.get('/', getAnalyticsOverview);
router.get('/overview', getAnalyticsOverview);

// Operating Expenditure Management
router.get('/expenses', getExpenditures);
router.post('/expenses', authorize('admin', 'manager'), createExpenditure);
router.delete('/expenses/:id', authorize('admin'), deleteExpenditure);

/**
 * POST /api/analytics/sales-report
 * Compatibility alias for POST /api/reports (tenant-scoped sales report).
 */
router.post('/sales-report', authorize('admin', 'manager'), async (req, res) => {
  try {
    const tenantId = Number(req.user.tenant_id);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not associated with an active tenant'
      });
    }

    const job = await enqueueReportJob({
      reportType: 'sales',
      filters: req.body.filters || {},
      tenantId,
      userId: Number(req.user.id),
      idempotencyKey: req.get('Idempotency-Key') || req.body.idempotencyKey
    });

    return res.status(202).json({
      success: true,
      message: 'Report generation started',
      jobId: job.id,
      data: { jobId: job.id, queue: 'report', status: 'waiting', reportType: 'sales' }
    });
  } catch (error) {
    logger.error('Failed to enqueue analytics sales report', { message: error.message });
    return res.status(503).json({
      success: false,
      message: 'Failed to enqueue report job'
    });
  }
});

module.exports = router;
