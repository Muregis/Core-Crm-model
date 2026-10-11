const db = require('../config/database');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

// @desc    Get all deals
// @route   GET /api/deals
// @access  Private
const getDeals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      stageId,
      status,
      customerId,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE d.tenant_id = ?';
    const params = [req.user.tenant_id];

    if (req.user.role === 'sales_rep') {
      whereClause += ' AND d.assigned_sales_rep_id = ?';
      params.push(req.user.id);
    }

    if (stageId) {
      whereClause += ' AND d.deal_stage_id = ?';
      params.push(stageId);
    }

    if (status) {
      whereClause += ' AND d.status = ?';
      params.push(status);
    }

    if (customerId) {
      whereClause += ' AND d.customer_id = ?';
      params.push(customerId);
    }

    const allowedSortFields = ['title', 'value', 'expected_close_date', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const deals = await db.query(`
      SELECT 
        d.*,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        c.company_name as customer_company_name,
        ds.name as stage_name,
        ds.color as stage_color,
        (u.first_name || ' ' || u.last_name) as sales_rep_name
      FROM deals d
      LEFT JOIN customers c ON d.customer_id = c.id
      LEFT JOIN deal_stages ds ON d.deal_stage_id = ds.id
      LEFT JOIN users u ON d.assigned_sales_rep_id = u.id
      ${whereClause}
      ORDER BY d.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM deals d
      ${whereClause}
    `, params);

    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        deals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get deals error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching deals' });
  }
};

// @desc    Get single deal
// @route   GET /api/deals/:id
// @access  Private
const getDeal = async (req, res) => {
  try {
    const { id } = req.params;

    const deals = await db.query(`
      SELECT 
        d.*,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        c.company_name as customer_company_name,
        ds.name as stage_name,
        ds.color as stage_color,
        (u.first_name || ' ' || u.last_name) as sales_rep_name
      FROM deals d
      LEFT JOIN customers c ON d.customer_id = c.id
      LEFT JOIN deal_stages ds ON d.deal_stage_id = ds.id
      LEFT JOIN users u ON d.assigned_sales_rep_id = u.id
      WHERE d.id = ? AND d.tenant_id = ?
    `, [id, req.user.tenant_id]);

    if (deals.length === 0) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const deal = deals[0];

    if (req.user.role === 'sales_rep' && deal.assigned_sales_rep_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: Deal not assigned to you' });
    }

    res.json({ success: true, data: { deal } });
  } catch (error) {
    logger.error('Get deal error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching deal' });
  }
};

// @desc    Create deal
// @route   POST /api/deals
// @access  Private
const createDeal = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const {
      title,
      customerId,
      leadId,
      dealStageId = 1,
      value,
      currency = 'KES',
      expectedCloseDate,
      assignedSalesRepId,
      notes
    } = req.body;

    // Verify customer belongs to tenant
    const customer = await db.query('SELECT id FROM customers WHERE id = ? AND tenant_id = ?', [customerId, req.user.tenant_id]);
    if (customer.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID for this tenant' });
    }

    const result = await db.query(`
      INSERT INTO deals (
        tenant_id, title, customer_id, lead_id, deal_stage_id,
        assigned_sales_rep_id, value, currency, expected_close_date,
        status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `, [
      req.user.tenant_id, title, customerId, leadId || null, dealStageId,
      assignedSalesRepId || req.user.id, value, currency,
      expectedCloseDate || null, notes || null, req.user.id
    ]);

    const created = await db.query(
      'SELECT * FROM deals WHERE id = ? AND tenant_id = ?',
      [result.insertId, req.user.tenant_id]
    );

    res.status(201).json({
      success: true,
      message: 'Deal created successfully',
      data: { deal: created[0] }
    });
  } catch (error) {
    logger.error('Create deal error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating deal' });
  }
};

// @desc    Update deal
// @route   PUT /api/deals/:id
// @access  Private
const updateDeal = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM deals WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    if (req.user.role === 'sales_rep' && existing[0].assigned_sales_rep_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: Deal not assigned to you' });
    }

    const {
      title,
      dealStageId,
      value,
      expectedCloseDate,
      actualCloseDate,
      status,
      lostReason,
      notes,
      assignedSalesRepId
    } = req.body;

    await db.query(`
      UPDATE deals SET
        title = COALESCE(?, title),
        deal_stage_id = COALESCE(?, deal_stage_id),
        value = COALESCE(?, value),
        expected_close_date = COALESCE(?, expected_close_date),
        actual_close_date = COALESCE(?, actual_close_date),
        status = COALESCE(?, status),
        lost_reason = COALESCE(?, lost_reason),
        notes = COALESCE(?, notes),
        assigned_sales_rep_id = COALESCE(?, assigned_sales_rep_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [
      title, dealStageId, value, expectedCloseDate, actualCloseDate,
      status, lostReason, notes, assignedSalesRepId,
      id, req.user.tenant_id
    ]);

    const updated = await db.query('SELECT * FROM deals WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);

    res.json({
      success: true,
      message: 'Deal updated successfully',
      data: { deal: updated[0] }
    });
  } catch (error) {
    logger.error('Update deal error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating deal' });
  }
};

// @desc    Delete deal
// @route   DELETE /api/deals/:id
// @access  Private (Admin / Manager)
const deleteDeal = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM deals WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    await db.query('DELETE FROM deals WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);

    res.json({ success: true, message: 'Deal deleted successfully' });
  } catch (error) {
    logger.error('Delete deal error:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting deal' });
  }
};

module.exports = {
  getDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal
};
