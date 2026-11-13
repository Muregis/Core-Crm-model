const ticketService = require('../services/ticketService');
const logger = require('../utils/logger');

// @desc    Track ticket progress and milestones publicly without login
// @route   GET /api/public/tickets/track/:token
// @access  Public (Token-authenticated)
const trackTicket = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Tracking token is required' });
    }

    const ticket = await ticketService.findByTrackingToken(token);
    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    logger.error('Error in public trackTicket:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Error tracking ticket'
    });
  }
};

// @desc    View landlord quote estimate and photos for approval
// @route   GET /api/public/tickets/approve/:token
// @access  Public (Token-authenticated)
const getApprovalQuote = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Approval token is required' });
    }

    const quote = await ticketService.findByApprovalToken(token);
    res.status(200).json({
      success: true,
      data: quote
    });
  } catch (error) {
    logger.error('Error in public getApprovalQuote:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Error fetching approval quote'
    });
  }
};

// @desc    Submit landlord quote approval or rejection decision (one-click from WhatsApp/email)
// @route   POST /api/public/tickets/approve/:token
// @access  Public (Token-authenticated)
const submitApprovalDecision = async (req, res) => {
  try {
    const { token } = req.params;
    const { action, notes } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Approval token is required' });
    }

    if (!action || !['approve', 'reject'].includes(String(action).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Action is required and must be either 'approve' or 'reject'"
      });
    }

    const result = await ticketService.processPublicApproval(token, action, notes);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in public submitApprovalDecision:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Error processing approval decision'
    });
  }
};

// @desc    View public Property Maintenance Passport
// @route   GET /api/public/properties/passport/:token
// @access  Public (Token-authenticated)
const getPropertyPassport = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Passport token is required' });
    }

    const passport = await ticketService.findByPassportToken(token);
    res.status(200).json({
      success: true,
      data: passport
    });
  } catch (error) {
    logger.error('Error in public getPropertyPassport:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Error fetching property passport'
    });
  }
};

module.exports = {
  trackTicket,
  getApprovalQuote,
  submitApprovalDecision,
  getPropertyPassport
};
