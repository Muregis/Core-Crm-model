const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal
} = require('../controllers/dealController');

const router = express.Router();

router.use(protect);

const dealValidation = [
  body('title').trim().isLength({ min: 2 }).withMessage('Deal title must be at least 2 characters'),
  body('customerId').isInt().withMessage('Valid customer ID is required'),
  body('value').isFloat({ min: 0 }).withMessage('Value must be a positive number')
];

router.route('/')
  .get(getDeals)
  .post(dealValidation, createDeal);

router.route('/:id')
  .get(getDeal)
  .put(updateDeal)
  .delete(authorize('admin', 'manager'), deleteDeal);

module.exports = router;
