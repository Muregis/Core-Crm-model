const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  getParcels,
  getParcel,
  createParcel,
  updateParcel,
  deleteParcel,
  getPlotMatrix,
  reserveParcelWithHold,
  releaseParcelHold,
  convertHoldToSale
} = require('../controllers/parcelController');

const router = express.Router();

router.use(protect);

const createValidation = [
  body('titleRef').trim().isLength({ min: 1, max: 120 }).withMessage('titleRef is required'),
  body('status')
    .optional()
    .isIn(['available', 'reserved', 'sold', 'withdrawn'])
    .withMessage('Invalid status'),
  body('listPriceKes').optional({ nullable: true }).isFloat({ min: 0 }),
  body('sizeAcres').optional({ nullable: true }).isFloat({ min: 0 }),
  body('dealId').optional({ nullable: true }).isInt({ min: 1 }),
  body('ownerCustomerId').optional({ nullable: true }).isInt({ min: 1 })
];


// Plot Matrix endpoints
router.get('/matrix/overview', getPlotMatrix);
router.post('/:id/hold', reserveParcelWithHold);
router.post('/:id/release-hold', releaseParcelHold);
router.post('/:id/convert-sale', convertHoldToSale);

router.route('/').get(getParcels).post(createValidation, createParcel);

router
  .route('/:id')
  .get(getParcel)
  .put(updateParcel)
  .delete(authorize('admin', 'manager'), deleteParcel);

module.exports = router;
