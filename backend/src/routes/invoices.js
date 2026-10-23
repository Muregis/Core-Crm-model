const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getInvoices,
  getInvoice,
  getDebtorAging,
  createInvoice
} = require('../controllers/invoiceController');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getInvoices)
  .post(createInvoice);

router.get('/aging/report', getDebtorAging);

router.route('/:id')
  .get(getInvoice);

module.exports = router;
