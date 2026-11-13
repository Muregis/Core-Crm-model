const express = require('express');
const {
  trackTicket,
  getApprovalQuote,
  submitApprovalDecision,
  getPropertyPassport
} = require('../controllers/publicController');

const router = express.Router();

// Public routes for clients, landlords, and reporters (no login required; secured via 128-bit tokens)
router.get('/tickets/track/:token', trackTicket);
router.get('/tickets/approve/:token', getApprovalQuote);
router.post('/tickets/approve/:token', submitApprovalDecision);
router.get('/properties/passport/:token', getPropertyPassport);

module.exports = router;
