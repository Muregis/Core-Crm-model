const express = require('express');
const { protect } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

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
