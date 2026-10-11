const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const db = require('../config/database');
const { encrypt, decrypt, maskApiKey } = require('../utils/crypto');
const logger = require('../utils/logger');

const router = express.Router();

// ==========================================
// PUBLIC WEBHOOK: Safaricom Daraja C2B Callback
// ==========================================
// @desc    Receive Safaricom Daraja C2B Payment Validation / Confirmation Webhook
// @route   POST /api/mpesa/c2b-callback
// @access  Public (Safaricom IP / Callback)
router.post('/c2b-callback', async (req, res) => {
  try {
    const {
      BusinessShortCode,
      TransID,
      TransAmount,
      MSISDN,
      BillRefNumber,
      FirstName,
      LastName
    } = req.body;

    if (!BusinessShortCode || !TransID || !TransAmount) {
      return res.status(400).json({ ResultCode: 1, ResultDesc: 'Missing required Daraja fields' });
    }

    // Resolve tenant by Shortcode (Paybill/Till)
    const credentials = await db.query(
      'SELECT tenant_id FROM tenant_credentials WHERE provider = ? AND shortcode = ?',
      ['mpesa', String(BusinessShortCode)]
    );

    if (credentials.length === 0) {
      logger.warn(`Unregistered M-Pesa Shortcode received: ${BusinessShortCode}`);
      return res.status(404).json({ ResultCode: 1, ResultDesc: 'Tenant Paybill not registered' });
    }

    const tenantId = credentials[0].tenant_id;

    // Check if customer exists by phone under this tenant
    const formattedPhone = String(MSISDN).startsWith('+') ? String(MSISDN) : `+${MSISDN}`;
    const customers = await db.query(
      'SELECT id FROM customers WHERE tenant_id = ? AND (phone = ? OR phone = ?)',
      [tenantId, formattedPhone, String(MSISDN)]
    );
    const customerId = customers.length > 0 ? customers[0].id : null;

    // Insert M-Pesa transaction under resolved tenant
    await db.query(
      `INSERT INTO mpesa_transactions (
        tenant_id, transaction_type, mpesa_receipt_number, receipt_number, amount,
        phone_number, customer_id, status, transaction_time
      ) VALUES (?, 'C2B', ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)`,
      [
        tenantId,
        TransID,
        TransID,
        parseFloat(TransAmount),
        formattedPhone,
        customerId
      ]
    );

    logger.info(`Recorded M-Pesa C2B transaction ${TransID} of KES ${TransAmount} for tenant ${tenantId}`);

    // Return Daraja standard confirmation response
    res.json({
      ResultCode: 0,
      ResultDesc: 'Success'
    });
  } catch (error) {
    logger.error('Error handling M-Pesa C2B callback:', error);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal server error' });
  }
});

// ==========================================
// PROTECTED ROUTES (JWT REQUIRED)
// ==========================================
router.use(protect);

// GET /api/mpesa - List tenant M-Pesa transactions
router.get('/', async (req, res) => {
  try {
    const transactions = await db.query(
      `SELECT m.*, c.first_name as customer_first_name, c.last_name as customer_last_name
       FROM mpesa_transactions m
       LEFT JOIN customers c ON m.customer_id = c.id
       WHERE m.tenant_id = ?
       ORDER BY m.transaction_time DESC`,
      [req.user.tenant_id]
    );

    res.json({
      success: true,
      data: { transactions }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while fetching M-Pesa transactions' });
  }
});

// GET /api/mpesa/credentials - Retrieve configured shortcode & masked keys for current tenant
router.get('/credentials', authorize('admin', 'manager'), async (req, res) => {
  try {
    const records = await db.query(
      `SELECT id, provider, shortcode, key_type, is_sandbox, consumer_key_encrypted, iv, created_at, updated_at
       FROM tenant_credentials
       WHERE tenant_id = ? AND provider = 'mpesa'`,
      [req.user.tenant_id]
    );

    if (records.length === 0) {
      return res.json({
        success: true,
        data: { configured: false }
      });
    }

    const rec = records[0];
    let maskedKey = '********';
    try {
      const decryptedKey = decrypt(rec.consumer_key_encrypted, rec.iv);
      maskedKey = maskApiKey(decryptedKey);
    } catch {
      // ignore
    }

    res.json({
      success: true,
      data: {
        configured: true,
        shortcode: rec.shortcode,
        keyType: rec.key_type,
        isSandbox: Boolean(rec.is_sandbox),
        maskedConsumerKey: maskedKey,
        updatedAt: rec.updated_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving M-Pesa credentials' });
  }
});

// POST /api/mpesa/credentials - Store encrypted Daraja credentials for current tenant
router.post('/credentials', authorize('admin'), async (req, res) => {
  try {
    const { shortcode, keyType = 'paybill', consumerKey, consumerSecret, passkey, isSandbox = true } = req.body;

    if (!shortcode || !consumerKey || !consumerSecret) {
      return res.status(400).json({
        success: false,
        message: 'Shortcode, Consumer Key, and Consumer Secret are required'
      });
    }

    // Encrypt sensitive secrets
    const encKey = encrypt(consumerKey);
    const encSecret = encrypt(consumerSecret);
    const encPasskey = passkey ? encrypt(passkey) : { encryptedText: null };

    // Check if credentials exist for tenant
    const existing = await db.query(
      'SELECT id FROM tenant_credentials WHERE tenant_id = ? AND provider = ?',
      [req.user.tenant_id, 'mpesa']
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE tenant_credentials SET
          shortcode = ?,
          key_type = ?,
          consumer_key_encrypted = ?,
          consumer_secret_encrypted = ?,
          passkey_encrypted = ?,
          iv = ?,
          is_sandbox = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND provider = 'mpesa'`,
        [
          String(shortcode),
          keyType,
          encKey.encryptedText,
          encSecret.encryptedText,
          encPasskey.encryptedText,
          encKey.iv,
          isSandbox ? 1 : 0,
          req.user.tenant_id
        ]
      );
    } else {
      await db.query(
        `INSERT INTO tenant_credentials (
          tenant_id, provider, shortcode, key_type,
          consumer_key_encrypted, consumer_secret_encrypted, passkey_encrypted,
          iv, is_sandbox
        ) VALUES (?, 'mpesa', ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.tenant_id,
          String(shortcode),
          keyType,
          encKey.encryptedText,
          encSecret.encryptedText,
          encPasskey.encryptedText,
          encKey.iv,
          isSandbox ? 1 : 0
        ]
      );
    }

    logger.info(`Updated encrypted M-Pesa credentials for tenant ${req.user.tenant_id} (Shortcode: ${shortcode})`);

    res.json({
      success: true,
      message: 'M-Pesa Daraja credentials encrypted and saved successfully'
    });
  } catch (error) {
    logger.error('Failed to save M-Pesa credentials:', error);
    res.status(500).json({ success: false, message: 'Server error saving M-Pesa credentials' });
  }
});

// POST /api/mpesa/c2b-simulate - Record incoming M-Pesa transaction
router.post('/c2b-simulate', async (req, res) => {
  try {
    const { mpesaReceiptNumber, amount, phoneNumber, customerId, dealId } = req.body;
    if (!mpesaReceiptNumber || !amount || !phoneNumber) {
      return res.status(400).json({ success: false, message: 'Receipt number, amount, and phone number required' });
    }

    const result = await db.query(
      `INSERT INTO mpesa_transactions (
        tenant_id, transaction_type, mpesa_receipt_number, amount,
        phone_number, customer_id, deal_id, status, transaction_time
      ) VALUES (?, 'C2B', ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)`,
      [
        req.user.tenant_id,
        mpesaReceiptNumber,
        amount,
        phoneNumber,
        customerId || null,
        dealId || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'M-Pesa transaction recorded',
      transactionId: result.insertId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while processing M-Pesa transaction' });
  }
});

module.exports = router;
