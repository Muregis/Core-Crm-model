const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { enqueueReportJob } = require('../jobs/producers/reportProducer');
const logger = require('../utils/logger');

const router = express.Router();

router.use(protect);

/**
 * POST /api/reports
 * Queue a tenant-scoped sales report and return HTTP 202 immediately.
 */
router.post(
  '/',
  authorize('admin', 'manager'),
  [
    body('reportType').optional().isIn(['sales']).withMessage('reportType must be sales'),
    body('filters').optional().isObject()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const tenantId = Number(req.user.tenant_id);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not associated with an active tenant'
      });
    }

    try {
      const job = await enqueueReportJob({
        reportType: req.body.reportType || 'sales',
        filters: req.body.filters || {},
        tenantId,
        userId: Number(req.user.id),
        idempotencyKey: req.get('Idempotency-Key') || req.body.idempotencyKey
      });

      return res.status(202).json({
        success: true,
        message: 'Report job queued',
        data: { jobId: job.id, queue: 'report', status: 'waiting', reportType: 'sales' }
      });
    } catch (error) {
      logger.error('Failed to enqueue report', {
        tenantId,
        userId: req.user.id,
        message: error.message
      });
      return res.status(503).json({
        success: false,
        message: 'Unable to queue report. Please retry shortly with the same idempotency key.'
      });
    }
  }
);

module.exports = router;
