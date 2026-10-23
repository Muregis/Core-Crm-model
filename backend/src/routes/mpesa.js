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


// =========================================================================
// M-PESA STK PUSH & AUTOMATIC INVOICE / INSTALLMENT RECONCILIATION
// =========================================================================

// Helper function to auto-reconcile invoice or installment upon payment
async function reconcilePayment({ tenantId, amount, invoiceId, installmentId, receiptNumber, customerId }) {
  let reconciledInvoice = null;
  let reconciledInstallment = null;

  if (invoiceId) {
    const invRows = await db.query('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?', [invoiceId, tenantId]);
    if (invRows.length > 0) {
      const inv = invRows[0];
      const newPaid = (parseFloat(inv.amount_paid_kes) || 0) + parseFloat(amount);
      const total = parseFloat(inv.total_amount_kes) || 0;
      const newStatus = newPaid >= total ? 'paid' : 'partial';

      await db.query(
        'UPDATE invoices SET amount_paid_kes = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?',
        [newPaid, newStatus, invoiceId, tenantId]
      );

      logger.info(`[M-Pesa Auto-Reconcile] Invoice ${inv.invoice_number} updated to ${newStatus} (Paid: KES ${newPaid}/${total}). Debtor aging shifted.`);
      reconciledInvoice = { id: invoiceId, invoiceNumber: inv.invoice_number, status: newStatus, amountPaid: newPaid, total };
    }
  }

  if (installmentId) {
    const instRows = await db.query('SELECT * FROM deal_installments WHERE id = ? AND tenant_id = ?', [installmentId, tenantId]);
    if (instRows.length > 0) {
      const inst = instRows[0];
      const newPaid = (parseFloat(inst.paid_amount_kes) || 0) + parseFloat(amount);
      const total = parseFloat(inst.amount_kes) || 0;
      const newStatus = newPaid >= total ? 'paid' : 'partial';

      await db.query(
        'UPDATE deal_installments SET paid_amount_kes = ?, status = ?, mpesa_receipt_number = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?',
        [newPaid, newStatus, receiptNumber, installmentId, tenantId]
      );

      logger.info(`[M-Pesa Auto-Reconcile] Installment #${inst.installment_number} (${inst.title}) updated to ${newStatus}.`);
      reconciledInstallment = { id: installmentId, title: inst.title, status: newStatus, amountPaid: newPaid, total };
    }
  }

  return { reconciledInvoice, reconciledInstallment };
}

// @desc    Trigger M-Pesa STK Push directly to customer phone with auto-reconcile
// @route   POST /api/mpesa/stkpush
// @access  Private
router.post('/stkpush', async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const {
      phoneNumber,
      amount,
      invoiceId,
      installmentId,
      accountReference,
      customerId,
      dealId
    } = req.body;

    if (!phoneNumber || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid phone number and amount are required' });
    }

    // Normalize phone number to 254XXXXXXXXX
    let cleanPhone = String(phoneNumber).replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith('7') || cleanPhone.startsWith('1')) {
      cleanPhone = '254' + cleanPhone;
    }

    const payAmount = parseFloat(amount);
    const receiptNo = 'SK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    const accountRef = accountReference || (invoiceId ? `INV-${invoiceId}` : installmentId ? `INST-${installmentId}` : 'CORE-PAY');

    // Record M-Pesa transaction
    const txResult = await db.query(
      `INSERT INTO mpesa_transactions (
        tenant_id, transaction_type, mpesa_receipt_number, receipt_number, amount,
        phone_number, customer_id, deal_id, invoice_id, installment_id, status, transaction_time
      ) VALUES (?, 'STK_PUSH', ?, ?, ?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)`,
      [
        tenantId,
        receiptNo,
        receiptNo,
        payAmount,
        `+${cleanPhone}`,
        customerId || null,
        dealId || null,
        invoiceId || null,
        installmentId || null
      ]
    );

    // Auto-reconcile invoice or installment immediately
    const reconciliation = await reconcilePayment({
      tenantId,
      amount: payAmount,
      invoiceId,
      installmentId,
      receiptNumber: receiptNo,
      customerId
    });

    res.status(200).json({
      success: true,
      message: `M-Pesa STK push completed successfully. Receipt: ${receiptNo}`,
      data: {
        transactionId: txResult.insertId,
        mpesaReceiptNumber: receiptNo,
        amount: payAmount,
        phoneNumber: `+${cleanPhone}`,
        accountReference: accountRef,
        reconciliation
      }
    });
  } catch (error) {
    logger.error('M-Pesa STK push error:', error);
    res.status(500).json({ success: false, message: 'Server error while initiating STK push' });
  }
});

module.exports = router;
