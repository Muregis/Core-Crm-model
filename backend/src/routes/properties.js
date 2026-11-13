const express = require('express');
const { body, validationResult } = require('express-validator');
const { protect, authorize, logActivity } = require('../middleware/auth');
const {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  getMaintenanceMemory,
  getLandlordMonthlyReport,
  schedulePreventiveInspection,
  getPreventiveInspections,
  completePreventiveInspection
} = require('../controllers/propertyController');

const router = express.Router();

// Middleware to check validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// All property routes require authentication
router.use(protect);

// Landlord monthly consolidated report (must precede /:id)
router.get('/landlord/:customerId/monthly-report', getLandlordMonthlyReport);

// Preventive Maintenance Inspection endpoints
router.get('/preventive-inspections', getPreventiveInspections);
router.patch('/preventive-inspections/:inspectionId', completePreventiveInspection);
router.post(
  '/:id/preventive-inspections',
  [
    body('package_type')
      .isIn(['airbnb_guest_ready', 'pre_rains_leak_defense', 'quarterly_systems_check'])
      .withMessage("Invalid package_type. Allowed: 'airbnb_guest_ready', 'pre_rains_leak_defense', 'quarterly_systems_check'"),
    body('scheduled_date')
      .notEmpty()
      .withMessage('scheduled_date is required')
  ],
  validate,
  schedulePreventiveInspection
);
router.get('/:id/preventive-inspections', getPreventiveInspections);

router.get('/', getProperties);

router.get('/:id', getProperty);

// Property Maintenance Memory (v2.1 §3, §4.1, §11)
router.get('/:id/maintenance-memory', getMaintenanceMemory);

router.post(
  '/',
  [
    body('name')
      .trim()
      .isLength({ min: 2 })
      .withMessage('Property name must be at least 2 characters long'),
    body('customer_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('customer_id must be a positive integer'),
    body('unit_count')
      .optional()
      .isInt({ min: 1 })
      .withMessage('unit_count must be at least 1')
  ],
  validate,
  logActivity('CREATE_PROPERTY', 'property'),
  createProperty
);

router.patch(
  '/:id',
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage('Property name must be at least 2 characters long'),
    body('customer_id')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('customer_id must be a positive integer'),
    body('unit_count')
      .optional()
      .isInt({ min: 1 })
      .withMessage('unit_count must be at least 1')
  ],
  validate,
  logActivity('UPDATE_PROPERTY', 'property'),
  updateProperty
);

router.delete(
  '/:id',
  authorize('admin', 'manager'),
  logActivity('DELETE_PROPERTY', 'property'),
  deleteProperty
);

module.exports = router;
