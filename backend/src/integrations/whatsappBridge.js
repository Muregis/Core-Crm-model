// backend/src/integrations/whatsappBridge.js
// Production-grade WhatsApp Bridge Connector for Sawa Repairs.
// Connects Meta WhatsApp Cloud API (Graph API) and Twilio WhatsApp to ticketService.processWhatsAppIntake.
const ticketService = require('../services/ticketService');
const logger = require('../utils/logger');

class WhatsAppBridge {
  /**
   * Meta Webhook Verification Handshake (GET /api/integrations/whatsapp/meta)
   */
  handleMetaVerification(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'sawa_repairs_webhook_secret_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      logger.info('Meta WhatsApp webhook verified successfully');
      return res.status(200).send(challenge);
    }

    logger.warn('Meta WhatsApp webhook verification failed: token mismatch');
    return res.status(403).json({ success: false, message: 'Verification token mismatch' });
  }

  /**
   * Intelligently classify trade category and priority from tenant message text
   */
  classifyMessage(text = '') {
    const lower = text.toLowerCase();

    // Priority
    let priority = 'standard';
    if (/(urgent|emergency|flooding|burst|sparks?|smoke|fire|danger|immediate|electric shock)/i.test(lower)) {
      priority = 'emergency';
    } else if (/(planned|routine|inspection|renovation|quote|painting next week)/i.test(lower)) {
      priority = 'planned';
    }

    // Trade Category
    let category = 'general';
    if (/(leak|pipe|water|sink|tap|toilet|flush|cistern|drain|sewer|plumb|pressure|geyser|boiler)/i.test(lower)) {
      category = 'plumbing';
    } else if (/(power|socket|electric|fuse|breaker|lights?|tripping|short circuit|heater)/i.test(lower)) {
      category = 'electrical';
    } else if (/(roof|mabati|ceiling|gutter|downpipe|tiles?|rain leak)/i.test(lower)) {
      category = 'roofing';
    } else if (/(paint|crack|wall|peel|plaster)/i.test(lower)) {
      category = 'painting';
    } else if (/(solar|inverter|battery|pv|clean energy)/i.test(lower)) {
      category = 'solar';
    }

    return { category, priority };
  }

  /**
   * Handle incoming Meta WhatsApp Cloud API Webhook (POST /api/integrations/whatsapp/meta)
   */
  async handleMetaWebhook(req, res) {
    try {
      const entry = req.body?.entry?.[0];
      const changes = entry?.changes?.[0]?.value;

      // Handle non-message notifications (e.g. delivered, read receipts)
      if (!changes?.messages || changes.messages.length === 0) {
        return res.status(200).json({ success: true, message: 'Event acknowledged (no message)' });
      }

      const msg = changes.messages[0];
      const contact = changes.contacts?.[0];

      // Extract sender & message info
      const rawPhone = msg.from; // e.g. "254711223344"
      const formattedPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
      const senderName = contact?.profile?.name || 'WhatsApp Client';
      const textBody = msg.text?.body || msg.caption || '(Photo attachment without caption)';

      // Extract photo media if attached
      const photoUrls = [];
      if (msg.type === 'image' && msg.image?.id) {
        photoUrls.push(`https://graph.facebook.com/v21.0/${msg.image.id}`);
      }

      // Classify category and priority
      const { category, priority } = this.classifyMessage(textBody);

      // Tenant resolution
      const tenantId = Number(req.query.tenant_id) || 1;

      // Ingest ticket into Core CRM
      const ticket = await ticketService.processWhatsAppIntake({
        tenant_id: tenantId,
        category,
        priority,
        description: textBody,
        reportedBy: `${senderName} (${formattedPhone})`,
        landlordPhone: formattedPhone,
        photoUrls
      });

      logger.info(`WhatsApp ticket created: ${ticket.ticket_number} for ${senderName}`);

      // Dispatch outbound confirmation message via Meta Cloud API if configured
      if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
        await this.sendMetaTextMessage(
          rawPhone,
          `Habari ${senderName}! Sawa Repairs has received your maintenance request.\n\n` +
          `🎫 Ticket Number: ${ticket.ticket_number}\n` +
          `🔧 Category: ${category.toUpperCase()}\n` +
          `⏱ SLA Target: ${priority === 'emergency' ? '2–6h Emergency Target' : '24–48h Standard'}\n\n` +
          `📱 Live Tracker (No login required):\n${ticket.tracking_url}\n\n` +
          `Our qualified fundi is being assigned to your request.`
        ).catch(err => logger.warn('Failed to send WhatsApp confirmation:', err.message));
      }

      return res.status(200).json({
        success: true,
        message: 'WhatsApp message processed into service ticket',
        data: {
          ticket_number: ticket.ticket_number,
          tracking_url: ticket.tracking_url,
          tracking_token: ticket.tracking_token,
          ticket_id: ticket.id,
          category,
          priority
        },
        ticket
      });
    } catch (error) {
      logger.error('WhatsApp Meta Webhook error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Handle incoming Twilio WhatsApp Webhook (POST /api/integrations/whatsapp/twilio)
   */
  async handleTwilioWebhook(req, res) {
    try {
      const from = req.body?.From || ''; // "whatsapp:+254711223344"
      const phone = from.replace('whatsapp:', '');
      const textBody = req.body?.Body || '';
      const senderName = req.body?.ProfileName || 'WhatsApp Reporter';

      // Photos from Twilio (MediaUrl0, MediaUrl1...)
      const photoUrls = [];
      const numMedia = parseInt(req.body?.NumMedia || '0', 10);
      for (let i = 0; i < numMedia; i++) {
        const url = req.body[`MediaUrl${i}`];
        if (url) photoUrls.push(url);
      }

      const { category, priority } = this.classifyMessage(textBody);
      const tenantId = Number(req.query.tenant_id) || 1;

      const ticket = await ticketService.processWhatsAppIntake({
        tenant_id: tenantId,
        category,
        priority,
        description: textBody,
        reportedBy: `${senderName} (${phone})`,
        landlordPhone: phone,
        photoUrls
      });

      // TwiML Outbound Response
      const replyXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>
Habari ${senderName}! Your service ticket ${ticket.ticket_number} (${category.toUpperCase()}) has been opened.
Track in real-time: ${ticket.tracking_url}
  </Message>
</Response>`;

      res.type('text/xml').send(replyXml);
    } catch (error) {
      logger.error('Twilio WhatsApp Webhook error:', error);
      res.status(500).type('text/xml').send('<Response><Message>Error processing request.</Message></Response>');
    }
  }

  /**
   * Send outbound message via Meta WhatsApp Cloud API
   */
  async sendMetaTextMessage(toPhone, messageBody) {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) return null;

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone.replace('+', ''),
        type: 'text',
        text: { body: messageBody }
      })
    });
    return res.json();
  }
}

module.exports = new WhatsAppBridge();
