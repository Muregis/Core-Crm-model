// backend/src/routes/whatsappBridge.js
// Express Router for Sawa Repairs WhatsApp Ingestion Bridge
const express = require('express');
const router = express.Router();
const whatsappBridge = require('../integrations/whatsappBridge');

/**
 * @route   GET /api/integrations/whatsapp/meta
 * @desc    Meta WhatsApp Cloud API Webhook verification handshake
 * @access  Public (Meta Webhook Verified)
 */
router.get('/meta', (req, res) => whatsappBridge.handleMetaVerification(req, res));

/**
 * @route   POST /api/integrations/whatsapp/meta
 * @desc    Meta WhatsApp Cloud API incoming message webhook
 * @access  Public (Meta Webhook Ingestion)
 */
router.post('/meta', (req, res) => whatsappBridge.handleMetaWebhook(req, res));

/**
 * @route   POST /api/integrations/whatsapp/twilio
 * @desc    Twilio WhatsApp incoming message webhook
 * @access  Public (Twilio Webhook Ingestion)
 */
router.post('/twilio', (req, res) => whatsappBridge.handleTwilioWebhook(req, res));

module.exports = router;
