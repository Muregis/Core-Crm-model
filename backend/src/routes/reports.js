const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { enqueueReportJob } = require('../jobs/producers/reportProducer');
const logger = require('../utils/logger');

const router = express.Router();

router.use(protect);

/**
 * POST /api/reports
 * Enqueue a background sales report. Returns job id immediately (202).
 * Long-running work runs in the worker process, not on this request.
 */
router.post(
  '/',
  authorize('admin', 'manager'),
  [
    body('reportType')
      .optional()
      .isIn(['sales'])
      .withMessage('reportType must be sales'),
    body('filters').optional().isObject()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const reportType = req.body.reportType || 'sales';
    const filters = req.body.filters || {};
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;

    try {
      const job = await enqueueReportJob({
        reportType,
        filters,
        requestedBy: req.user.id,
        idempotencyKey
      });

      return res.status(202).json({
        success: true,
        message: 'Report job queued',
        data: {
          jobId: job.id,
          queue: 'report',
          status: 'queued',
          reportType
        }
      });
    } catch (error) {
      logger.error('Failed to enqueue report:', error);
      return res.status(503).json({
        success: false,
        message: 'Unable to queue report job. Is Redis available?'
      });
    }
  }
);

module.exports = router;
