const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  getDealStages,
  updateDealStage
} = require('../controllers/dealController');

const router = express.Router();

router.use(protect);
// Strict Field Service RBAC: Technicians are isolated from commercial deal pipelines
router.use((req, res, next) => {
  if (req.user?.role === 'technician') {
    return res.status(403).json({
      success: false,
      message: 'Technicians are not authorized to access commercial sales pipelines'
    });
  }
  next();
});


// Deal stages must be defined before /:id parameter matching
router.get('/stages', getDealStages);

const dealValidation = [
  body('title').trim().isLength({ min: 2 }).withMessage('Deal title must be at least 2 characters'),
  body('customerId').isInt().withMessage('Valid customer ID is required'),
  body('value').isFloat({ min: 0 }).withMessage('Value must be a positive number')
];

router.route('/')
  .get(getDeals)
  .post(dealValidation, createDeal);

router.put('/:id/stage', updateDealStage);

router.route('/:id')
  .get(getDeal)
  .put(updateDeal)
  .delete(authorize('admin', 'manager'), deleteDeal);

module.exports = router;
