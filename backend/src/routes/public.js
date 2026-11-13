const express = require('express');
const {
  trackTicket,
  getApprovalQuote,
  submitApprovalDecision,
  getPropertyPassport,
  getPublicMonthlyReport,
  submitPublicPayment,
  submitTenantSignoff,
  getPublicMeasuredSla
} = require('../controllers/publicController');

const router = express.Router();

// In-Memory IP Rate Limiter for Public Portal Security
const publicRateLimits = new Map();
const rateLimitPublicPortal = (maxRequests = 60, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    // In local development or test mode, bypass rate limiter
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const current = publicRateLimits.get(ip) || [];
    const valid = current.filter(time => now - time < windowMs);
    if (valid.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded on public tracking portal. Please wait before retrying.'
      });
    }
    valid.push(now);
    publicRateLimits.set(ip, valid);
    next();
  };
};

// Cryptographic Token Format Validator (Fast-reject invalid or malformed tokens)
const validateTokenFormat = (paramName, prefix) => {
  return (req, res, next) => {
    const token = req.params[paramName];
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: `${paramName} is required` });
    }
    // Expected format: prefix_hexstring (16 to 64 chars of hex or demo identifier)
    const regex = new RegExp(`^${prefix}_[a-zA-Z0-9_-]{12,70}$`);
    if (!regex.test(token)) {
      return res.status(404).json({ success: false, message: `Invalid or malformed ${paramName}` });
    }
    next();
  };
};

const validatePaymentTokenFormat = (req, res, next) => {
  const token = req.params.token;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, message: 'Payment token is required' });
  }
  const regex = /^(tr|appr|pass)_[a-zA-Z0-9_-]{12,70}$/;
  if (!regex.test(token)) {
    return res.status(404).json({ success: false, message: 'Invalid or malformed payment token' });
  }
  next();
};

// Public routes for clients, landlords, and reporters (secured via 256-bit tokens & rate limits)
router.get(
  '/tickets/track/:token',
  rateLimitPublicPortal(60),
  validateTokenFormat('token', 'tr'),
  trackTicket
);

router.post(
  '/tickets/signoff/:token',
  rateLimitPublicPortal(20),
  validateTokenFormat('token', 'tr'),
  submitTenantSignoff
);

router.get(
  '/tickets/approve/:token',
  rateLimitPublicPortal(30),
  validateTokenFormat('token', 'appr'),
  getApprovalQuote
);

router.post(
  '/tickets/approve/:token',
  rateLimitPublicPortal(10), // Strict limit to prevent brute force decision submission
  validateTokenFormat('token', 'appr'),
  submitApprovalDecision
);

router.post(
  '/tickets/pay/:token',
  rateLimitPublicPortal(15), // M-Pesa STK Push payment trigger
  validatePaymentTokenFormat,
  submitPublicPayment
);

router.get(
  '/properties/passport/:token',
  rateLimitPublicPortal(60),
  validateTokenFormat('token', 'pass'),
  getPropertyPassport
);

router.get(
  '/properties/passport/:token/monthly-report',
  rateLimitPublicPortal(60),
  validateTokenFormat('token', 'pass'),
  getPublicMonthlyReport
);

router.get(
  '/sla-performance',
  rateLimitPublicPortal(60),
  getPublicMeasuredSla
);

module.exports = router;
