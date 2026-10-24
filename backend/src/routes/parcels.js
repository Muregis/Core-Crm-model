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
  convertHoldToSale,
  getInstallments,
  createInstallmentPlan,
  matchInstallmentMpesa,
  getSiteVisits,
  createSiteVisit,
  bookSiteVisitPassenger
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

// Lipa Mdogo Mdogo Installment endpoints
router.get('/installments/list', getInstallments);
router.post('/installments/plan', createInstallmentPlan);
router.post('/installments/:id/match-mpesa', matchInstallmentMpesa);

// Saturday Site Visit Convoy Booking endpoints
router.get('/site-visits/list', getSiteVisits);
router.post('/site-visits', createSiteVisit);
router.post('/site-visits/:id/book', bookSiteVisitPassenger);

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
