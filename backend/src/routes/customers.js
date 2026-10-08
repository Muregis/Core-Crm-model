const express = require('express');
const { body } = require('express-validator');
const { protect, authorize, logActivity } = require('../middleware/auth');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customerController');

const router = express.Router();

// All routes are protected
router.use(protect);

// Validation rules
const createCustomerValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('First name must be at least 2 characters long'),
  body('lastName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Last name must be at least 2 characters long'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .matches(/^\+254\d{9}$/)
    .withMessage('Phone number must be in Kenyan format (+254XXXXXXXXX)'),
  body('companyName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Company name must be at least 2 characters long'),
  body('businessCategoryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Business category must be a valid ID'),
  body('countyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('County must be a valid ID'),
  body('subCountyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Sub-county must be a valid ID'),
  body('customerType')
    .optional()
    .isIn(['individual', 'business', 'sacco', 'sme'])
    .withMessage('Invalid customer type'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'prospect'])
    .withMessage('Invalid status'),
  body('assignedSalesRepId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Sales rep must be a valid ID'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
];

const updateCustomerValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('First name must be at least 2 characters long'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Last name must be at least 2 characters long'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .optional()
    .matches(/^\+254\d{9}$/)
    .withMessage('Phone number must be in Kenyan format (+254XXXXXXXXX)'),
  body('companyName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Company name must be at least 2 characters long'),
  body('businessCategoryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Business category must be a valid ID'),
  body('countyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('County must be a valid ID'),
  body('subCountyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Sub-county must be a valid ID'),
  body('customerType')
    .optional()
    .isIn(['individual', 'business', 'sacco', 'sme'])
    .withMessage('Invalid customer type'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'prospect'])
    .withMessage('Invalid status'),
  body('assignedSalesRepId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Sales rep must be a valid ID'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
];

const { enqueueImportJob } = require('../jobs/producers/importProducer');

// Routes
router.get('/', getCustomers);
router.post('/import', async (req, res) => {
  try {
    // normally handle file upload (e.g. via multer)
    // Here we simulate the file upload part by passing a filePath from the request body or simulating one
    const filePath = req.body.filePath || '/tmp/dummy-upload.csv';
    const idempotencyKey = req.body.idempotencyKey || null;

    const job = await enqueueImportJob({ filePath, idempotencyKey });
    
    // HTTP 202 Accepted
    res.status(202).json({
      success: true,
      message: 'Customer import job queued',
      jobId: job.id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to queue import job' });
  }
});
router.get('/:id', getCustomer);
router.post('/', createCustomerValidation, logActivity('CREATE', 'customer'), createCustomer);
router.put('/:id', updateCustomerValidation, logActivity('UPDATE', 'customer'), updateCustomer);
router.delete('/:id', authorize('admin', 'manager'), logActivity('DELETE', 'customer'), deleteCustomer);

module.exports = router;
