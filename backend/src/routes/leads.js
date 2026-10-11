const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  convertLead
} = require('../controllers/leadController');

const router = express.Router();

router.use(protect);

// Lead validation rules
const leadValidation = [
  body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
  body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email is required'),
  body('phone').matches(/^\+254\d{9}$/).withMessage('Phone must be in format +254XXXXXXXXX'),
  body('source').optional().isIn(['website', 'referral', 'cold_call', 'social_media', 'event', 'other']).withMessage('Invalid lead source'),
  body('status').optional().isIn(['new', 'contacted', 'qualified', 'unqualified', 'converted']).withMessage('Invalid lead status'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority')
];

router.route('/')
  .get(getLeads)
  .post(leadValidation, createLead);

router.route('/:id')
  .get(getLead)
  .put(updateLead)
  .delete(authorize('admin', 'manager'), deleteLead);

router.post('/:id/convert', convertLead);

module.exports = router;
