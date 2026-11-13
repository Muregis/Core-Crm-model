// backend/src/routes/pricingConfig.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getActivePricingConfig,
  updatePricingDriver,
  getDriverHistory,
  getFinancialBreakEvenModel
} = require('../controllers/pricingConfigController');

router.use(protect);

// Financial break-even model (accessible to authenticated users/managers/admins)
router.get('/financial-model', getFinancialBreakEvenModel);

// All active drivers
router.get('/', getActivePricingConfig);

// Driver history audit log (admin only)
router.get('/:key/history', authorize('admin'), getDriverHistory);

// Driver update with effective dating (admin only)
router.patch('/:key', authorize('admin'), updatePricingDriver);

module.exports = router;
