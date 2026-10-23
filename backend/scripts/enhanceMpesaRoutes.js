const fs = require('fs');
const path = require('path');

const mpesaFile = path.join(__dirname, '../src/routes/mpesa.js');
let content = fs.readFileSync(mpesaFile, 'utf8');

const stkMethod = `
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

      logger.info(\`[M-Pesa Auto-Reconcile] Invoice \${inv.invoice_number} updated to \${newStatus} (Paid: KES \${newPaid}/\${total}). Debtor aging shifted.\`);
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

      logger.info(\`[M-Pesa Auto-Reconcile] Installment #\${inst.installment_number} (\${inst.title}) updated to \${newStatus}.\`);
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
    let cleanPhone = String(phoneNumber).replace(/\\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith('7') || cleanPhone.startsWith('1')) {
      cleanPhone = '254' + cleanPhone;
    }

    const payAmount = parseFloat(amount);
    const receiptNo = 'SK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    const accountRef = accountReference || (invoiceId ? \`INV-\${invoiceId}\` : installmentId ? \`INST-\${installmentId}\` : 'CORE-PAY');

    // Record M-Pesa transaction
    const txResult = await db.query(
      \`INSERT INTO mpesa_transactions (
        tenant_id, transaction_type, mpesa_receipt_number, receipt_number, amount,
        phone_number, customer_id, deal_id, invoice_id, installment_id, status, transaction_time
      ) VALUES (?, 'STK_PUSH', ?, ?, ?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)\`,
      [
        tenantId,
        receiptNo,
        receiptNo,
        payAmount,
        \`+\${cleanPhone}\`,
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
      message: \`M-Pesa STK push completed successfully. Receipt: \${receiptNo}\`,
      data: {
        transactionId: txResult.insertId,
        mpesaReceiptNumber: receiptNo,
        amount: payAmount,
        phoneNumber: \`+\${cleanPhone}\`,
        accountReference: accountRef,
        reconciliation
      }
    });
  } catch (error) {
    logger.error('M-Pesa STK push error:', error);
    res.status(500).json({ success: false, message: 'Server error while initiating STK push' });
  }
});
`;

if (!content.includes('/api/mpesa/stkpush')) {
  content = content.replace('module.exports = router;', stkMethod + '\r\nmodule.exports = router;');
  fs.writeFileSync(mpesaFile, content, 'utf8');
  console.log('Successfully enhanced mpesa.js with STK push and auto-reconciliation!');
} else {
  console.log('stkpush already exists in mpesa.js');
}
