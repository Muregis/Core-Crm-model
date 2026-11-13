const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, authorize, logActivity } = require('../middleware/auth');
const {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  transitionStatus,
  scheduleTicket,
  handleApproval,
  recordCosts,
  addAttachment,
  getAttachments,
  getDashboardStats,
  getCompanyPlanMetrics,
  getRepeatCustomers,
  getSawaCareContracts,
  createSawaCareContract,
  getSawaCareContract,
  updateSawaCareContract,
  whatsAppIntake,
  getClientExperienceMetrics
} = require('../controllers/ticketController');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};


// Security & Rate Limiting for Public WhatsApp Intake Webhook
const intakeRateLimits = new Map();
const checkIntakeRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 30;

  const current = intakeRateLimits.get(ip) || [];
  const valid = current.filter(time => now - time < windowMs);
  if (valid.length >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: 'Too many WhatsApp intake requests. Please wait a minute before retrying.'
    });
  }
  valid.push(now);
  intakeRateLimits.set(ip, valid);
  next();
};

const verifyWhatsAppWebhookToken = (req, res, next) => {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) {
    return next();
  }
  const token = req.headers['x-whatsapp-webhook-token'] || req.headers['x-api-key'] || req.query.token;
  if (token !== secret) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized WhatsApp webhook signature or token'
    });
  }
  next();
};

// WhatsApp intake can be called by webhooks/integrations or authenticated users
router.post(
  '/whatsapp-intake',
  checkIntakeRateLimit,
  verifyWhatsAppWebhookToken,
  [
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Ticket description is required'),
    body('category')
      .optional()
      .isIn(['plumbing', 'electrical', 'roofing', 'painting', 'general', 'solar', 'other'])
      .withMessage('Invalid service category'),
    body('priority')
      .optional()
      .isIn(['emergency', 'standard', 'planned'])
      .withMessage('Invalid priority')
  ],
  validate,
  whatsAppIntake
);

// All subsequent routes require authentication
router.use(protect);

// Dashboard endpoints (must precede /:id)
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/company-plan', getCompanyPlanMetrics);
router.get('/dashboard/client-experience-metrics', getClientExperienceMetrics);

// Sawa Care Managed Contracts & Conversion endpoints (must precede /:id)
router.get('/sawa-care/eligible', getRepeatCustomers);
router.get('/sawa-care/contracts', getSawaCareContracts);
router.post(
  '/sawa-care/contracts',
  [
    body('customer_id')
      .isInt({ min: 1 })
      .withMessage('customer_id must be a valid integer ID'),
    body('tier')
      .optional()
      .isIn(['home', 'portfolio', 'corporate'])
      .withMessage("tier must be 'home', 'portfolio', or 'corporate'"),
    body('status')
      .optional()
      .isIn(['prospect', 'active', 'paused', 'cancelled'])
      .withMessage('Invalid contract status')
  ],
  validate,
  createSawaCareContract
);
router.get('/sawa-care/contracts/:id', getSawaCareContract);
router.patch('/sawa-care/contracts/:id', updateSawaCareContract);

router.get('/', getTickets);

router.get('/:id', getTicket);

router.post(
  '/',
  [
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Ticket description is required'),
    body('category')
      .optional()
      .isIn(['plumbing', 'electrical', 'roofing', 'painting', 'general', 'solar', 'other'])
      .withMessage('Invalid service category'),
    body('priority')
      .optional()
      .isIn(['emergency', 'standard', 'planned'])
      .withMessage('Invalid priority'),
    body('property_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('property_id must be a valid integer ID'),
    body('customer_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('customer_id must be a valid integer ID')
  ],
  validate,
  createTicket
);

router.patch('/:id', updateTicket);

router.delete(
  '/:id',
  authorize('admin', 'manager'),
  deleteTicket
);

// Lifecycle Status Transition
router.patch(
  '/:id/status',
  [
    body('status')
      .optional()
      .isIn([
        'reported', 'triaged', 'scheduled', 'in_progress',
        'awaiting_parts', 'resolved', 'verified', 'closed', 'reopened'
      ])
      .withMessage('Invalid status')
  ],
  validate,
  transitionStatus
);

// Schedule and assign technician
router.post(
  '/:id/schedule',
  [
    body('assigned_technician_id')
      .isInt({ min: 1 })
      .withMessage('assigned_technician_id is required and must be a valid ID')
  ],
  validate,
  scheduleTicket
);

// Landlord approval action
router.post(
  '/:id/approval',
  [
    body('action')
      .isIn(['request', 'approve', 'record', 'reject'])
      .withMessage("action must be 'request', 'approve', 'record', or 'reject'")
  ],
  validate,
  handleApproval
);

// Record costs and unit economics
router.post('/:id/costs', recordCosts);

// Ticket attachments
router.post('/:id/attachments', addAttachment);
router.get('/:id/attachments', getAttachments);

module.exports = router;
