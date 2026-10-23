const db = require('../config/database');
const logger = require('../utils/logger');

// @desc    Get all invoices for current tenant
// @route   GET /api/invoices
// @access  Private
const getInvoices = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { status, customerId, invoiceType } = req.query;

    let where = 'WHERE inv.tenant_id = ?';
    const params = [tenantId];

    if (status) {
      where += ' AND inv.status = ?';
      params.push(status);
    }
    if (customerId) {
      where += ' AND inv.customer_id = ?';
      params.push(Number(customerId));
    }
    if (invoiceType) {
      where += ' AND inv.invoice_type = ?';
      params.push(invoiceType);
    }

    const invoices = await db.query(
      `SELECT inv.*,
              c.first_name AS customer_first_name,
              c.last_name AS customer_last_name,
              c.company_name AS customer_company_name,
              c.phone AS customer_phone,
              c.email AS customer_email,
              d.title AS deal_title,
              (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = inv.id) AS item_count,
              CAST(JULIANDAY('now') - JULIANDAY(inv.due_date) AS INTEGER) AS days_overdue
       FROM invoices inv
       LEFT JOIN customers c ON inv.customer_id = c.id
       LEFT JOIN deals d ON inv.deal_id = d.id
       ${where}
       ORDER BY inv.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: { invoices }
    });
  } catch (error) {
    logger.error('Get invoices error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching invoices' });
  }
};

// @desc    Get single invoice with itemized line items
// @route   GET /api/invoices/:id
// @access  Private
const getInvoice = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const id = req.params.id;

    const invoices = await db.query(
      `SELECT inv.*,
              c.first_name AS customer_first_name,
              c.last_name AS customer_last_name,
              c.company_name AS customer_company_name,
              c.phone AS customer_phone,
              c.email AS customer_email,
              t.name AS tenant_company_name,
              t.kra_pin AS tenant_kra_pin
       FROM invoices inv
       LEFT JOIN customers c ON inv.customer_id = c.id
       LEFT JOIN tenants t ON inv.tenant_id = t.id
       WHERE inv.id = ? AND inv.tenant_id = ?`,
      [id, tenantId]
    );

    if (!invoices.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = invoices[0];
    const items = await db.query(
      `SELECT ii.*, p.sku, p.name AS product_name
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE ii.invoice_id = ? AND ii.tenant_id = ?`,
      [id, tenantId]
    );

    const mpesaPayments = await db.query(
      `SELECT * FROM mpesa_transactions WHERE invoice_id = ? AND tenant_id = ? ORDER BY transaction_time DESC`,
      [id, tenantId]
    );

    res.json({
      success: true,
      data: {
        invoice: {
          ...invoice,
          items,
          mpesaPayments
        }
      }
    });
  } catch (error) {
    logger.error('Get invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching invoice details' });
  }
};

// @desc    Get Debtor Aging Analysis (Current, 30, 60, 90+ days)
// @route   GET /api/invoices/aging
// @access  Private
const getDebtorAging = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const unpaidInvoices = await db.query(
      `SELECT inv.id,
              inv.invoice_number,
              inv.total_amount_kes,
              inv.amount_paid_kes,
              (inv.total_amount_kes - inv.amount_paid_kes) AS balance_due_kes,
              inv.issue_date,
              inv.due_date,
              c.id AS customer_id,
              c.first_name AS customer_first_name,
              c.last_name AS customer_last_name,
              c.company_name AS customer_company_name,
              c.phone AS customer_phone,
              CAST(JULIANDAY('now') - JULIANDAY(inv.due_date) AS INTEGER) AS overdue_days
       FROM invoices inv
       JOIN customers c ON inv.customer_id = c.id
       WHERE inv.tenant_id = ? AND inv.status NOT IN ('paid', 'cancelled')
       ORDER BY overdue_days DESC`,
      [tenantId]
    );

    let totalReceivables = 0;
    let currentBucket = 0;      // 0 - 30 days
    let days31to60Bucket = 0;  // 31 - 60 days
    let days61to90Bucket = 0;  // 61 - 90 days
    let days90PlusBucket = 0;   // > 90 days

    const debtorsMap = {};

    for (const inv of unpaidInvoices) {
      const balance = Math.max(0, parseFloat(inv.balance_due_kes) || 0);
      const days = parseInt(inv.overdue_days, 10) || 0;
      totalReceivables += balance;

      if (days <= 0 || days <= 30) {
        currentBucket += balance;
      } else if (days <= 60) {
        days31to60Bucket += balance;
      } else if (days <= 90) {
        days61to90Bucket += balance;
      } else {
        days90PlusBucket += balance;
      }

      // Aggregate by customer
      if (!debtorsMap[inv.customer_id]) {
        debtorsMap[inv.customer_id] = {
          customerId: inv.customer_id,
          name: inv.customer_company_name || `${inv.customer_first_name} ${inv.customer_last_name || ''}`.trim(),
          phone: inv.customer_phone,
          totalOutstandingKes: 0,
          oldestOverdueDays: days,
          invoiceCount: 0,
          invoices: []
        };
      }
      debtorsMap[inv.customer_id].totalOutstandingKes += balance;
      debtorsMap[inv.customer_id].invoiceCount += 1;
      debtorsMap[inv.customer_id].oldestOverdueDays = Math.max(debtorsMap[inv.customer_id].oldestOverdueDays, days);
      debtorsMap[inv.customer_id].invoices.push({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        balanceKes: balance,
        dueDate: inv.due_date,
        overdueDays: days
      });
    }

    const topDebtors = Object.values(debtorsMap).sort(
      (a, b) => b.totalOutstandingKes - a.totalOutstandingKes
    );

    res.json({
      success: true,
      data: {
        summary: {
          totalReceivablesKes: totalReceivables,
          currentKes: currentBucket,
          days31to60Kes: days31to60Bucket,
          days61to90Kes: days61to90Bucket,
          days90PlusKes: days90PlusBucket,
          overduePercentage: totalReceivables > 0
            ? Math.round(((days31to60Bucket + days61to90Bucket + days90PlusBucket) / totalReceivables) * 100)
            : 0
        },
        topDebtors
      }
    });
  } catch (error) {
    logger.error('Get debtor aging error:', error);
    res.status(500).json({ success: false, message: 'Server error while calculating debtor aging' });
  }
};

// @desc    Create itemized Quotation or Tax Invoice with KRA eTIMS & 16% VAT
// @route   POST /api/invoices
// @access  Private
const createInvoice = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const {
      customerId,
      dealId,
      invoiceType = 'invoice', // 'quote', 'proforma', 'invoice'
      issueDate,
      dueDate,
      notes,
      items = []
    } = req.body;

    if (!customerId || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'Customer and at least one itemized line item are required'
      });
    }

    // Auto-generate invoice number
    const countRes = await db.query(
      'SELECT COUNT(*) as cnt FROM invoices WHERE tenant_id = ?',
      [tenantId]
    );
    const seq = (countRes[0]?.cnt || 0) + 1;
    const prefix = invoiceType === 'quote' ? 'QT' : invoiceType === 'proforma' ? 'PRF' : 'INV';
    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

    // Calculate line items, VAT, and totals
    let subtotalKes = 0;
    let vatAmountKes = 0;
    const computedItems = [];

    for (const item of items) {
      const qty = parseFloat(item.quantity) || 1;
      const unitPrice = parseFloat(item.unitPriceKes) || 0;
      const taxRate = item.taxRate !== undefined ? parseFloat(item.taxRate) : 16.0;
      const itemSubtotal = qty * unitPrice;
      const itemVat = taxRate > 0 ? (itemSubtotal * (taxRate / 100)) : 0;
      const itemTotal = itemSubtotal + itemVat;

      subtotalKes += itemSubtotal;
      vatAmountKes += itemVat;

      computedItems.push({
        productId: item.productId || null,
        itemDescription: item.itemDescription || 'Standard Line Item',
        quantity: qty,
        unitPriceKes: unitPrice,
        taxRate,
        totalKes: itemTotal
      });
    }

    const totalAmountKes = subtotalKes + vatAmountKes;
    const nowStr = new Date().toISOString().split('T')[0];
    const finalIssueDate = issueDate || nowStr;
    const finalDueDate = dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    // Generate KRA eTIMS Control Unit Number & QR data
    const etimsCuNumber = `KRA-ETIMS-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const qrData = `KRA-ETIMS|INV:${invoiceNumber}|CU:${etimsCuNumber}|DATE:${finalIssueDate}|TOTAL:KES${totalAmountKes.toFixed(2)}|VAT:KES${vatAmountKes.toFixed(2)}`;

    // Insert invoice
    const invResult = await db.query(
      `INSERT INTO invoices (
        tenant_id, customer_id, deal_id, invoice_number, etims_cu_number,
        invoice_type, issue_date, due_date, subtotal_kes, vat_amount_kes,
        total_amount_kes, amount_paid_kes, status, notes, qr_code_data, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'sent', ?, ?, ?)`,
      [
        tenantId,
        customerId,
        dealId || null,
        invoiceNumber,
        etimsCuNumber,
        invoiceType,
        finalIssueDate,
        finalDueDate,
        subtotalKes,
        vatAmountKes,
        totalAmountKes,
        notes || null,
        qrData,
        req.user.id
      ]
    );

    const invoiceId = invResult.insertId;

    // Insert line items
    for (const ci of computedItems) {
      await db.query(
        `INSERT INTO invoice_items (
          tenant_id, invoice_id, product_id, item_description,
          quantity, unit_price_kes, tax_rate, total_kes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          invoiceId,
          ci.productId,
          ci.itemDescription,
          ci.quantity,
          ci.unitPriceKes,
          ci.taxRate,
          ci.totalKes
        ]
      );
    }

    const created = await db.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);

    res.status(201).json({
      success: true,
      message: `${invoiceType.toUpperCase()} generated with KRA eTIMS CU number`,
      data: {
        invoice: created[0],
        items: computedItems
      }
    });
  } catch (error) {
    logger.error('Create invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error while generating invoice' });
  }
};

module.exports = {
  getInvoices,
  getInvoice,
  getDebtorAging,
  createInvoice
};
