const db = require('../config/database');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

// @desc    Get all leads
// @route   GET /api/leads
// @access  Private
const getLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      source,
      priority,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE l.tenant_id = ?';
    const params = [req.user.tenant_id];

    if (req.user.role === 'sales_rep') {
      whereClause += ' AND l.assigned_sales_rep_id = ?';
      params.push(req.user.id);
    }

    if (search) {
      whereClause += ' AND (l.first_name LIKE ? OR l.last_name LIKE ? OR l.email LIKE ? OR l.company_name LIKE ? OR l.phone LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    if (status) {
      whereClause += ' AND l.status = ?';
      params.push(status);
    }

    if (source) {
      whereClause += ' AND l.source = ?';
      params.push(source);
    }

    if (priority) {
      whereClause += ' AND l.priority = ?';
      params.push(priority);
    }

    const allowedSortFields = ['first_name', 'last_name', 'company_name', 'status', 'priority', 'score', 'created_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const leads = await db.query(`
      SELECT 
        l.*,
        (u.first_name || ' ' || u.last_name) as sales_rep_name,
        u.email as sales_rep_email
      FROM leads l
      LEFT JOIN users u ON l.assigned_sales_rep_id = u.id
      ${whereClause}
      ORDER BY l.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM leads l
      ${whereClause}
    `, params);

    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        leads,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get leads error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching leads' });
  }
};

// @desc    Get single lead
// @route   GET /api/leads/:id
// @access  Private
const getLead = async (req, res) => {
  try {
    const { id } = req.params;

    const leads = await db.query(`
      SELECT 
        l.*,
        (u.first_name || ' ' || u.last_name) as sales_rep_name,
        u.email as sales_rep_email
      FROM leads l
      LEFT JOIN users u ON l.assigned_sales_rep_id = u.id
      WHERE l.id = ? AND l.tenant_id = ?
    `, [id, req.user.tenant_id]);

    if (leads.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const lead = leads[0];

    if (req.user.role === 'sales_rep' && lead.assigned_sales_rep_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: Lead not assigned to you' });
    }

    res.json({ success: true, data: { lead } });
  } catch (error) {
    logger.error('Get lead error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching lead' });
  }
};

// @desc    Create lead
// @route   POST /api/leads
// @access  Private
const createLead = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      source = 'website',
      status = 'new',
      priority = 'medium',
      score = 0,
      estimatedValue,
      countyId,
      businessCategoryId,
      assignedSalesRepId,
      notes
    } = req.body;

    const result = await db.query(`
      INSERT INTO leads (
        tenant_id, first_name, last_name, email, phone, company_name,
        source, status, priority, score, estimated_value, county_id,
        business_category_id, assigned_sales_rep_id, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.tenant_id,
      firstName, lastName, email, phone, companyName,
      source, status, priority, score, estimatedValue || null,
      countyId || null, businessCategoryId || null,
      assignedSalesRepId || req.user.id, notes || null, req.user.id
    ]);

    const created = await db.query(
      'SELECT * FROM leads WHERE id = ? AND tenant_id = ?',
      [result.insertId, req.user.tenant_id]
    );

    res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: { lead: created[0] }
    });
  } catch (error) {
    logger.error('Create lead error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating lead' });
  }
};

// @desc    Update lead
// @route   PUT /api/leads/:id
// @access  Private
const updateLead = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM leads WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    if (req.user.role === 'sales_rep' && existing[0].assigned_sales_rep_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: Lead not assigned to you' });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      source,
      status,
      priority,
      score,
      estimatedValue,
      countyId,
      businessCategoryId,
      assignedSalesRepId,
      notes
    } = req.body;

    await db.query(`
      UPDATE leads SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        company_name = COALESCE(?, company_name),
        source = COALESCE(?, source),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        score = COALESCE(?, score),
        estimated_value = COALESCE(?, estimated_value),
        county_id = COALESCE(?, county_id),
        business_category_id = COALESCE(?, business_category_id),
        assigned_sales_rep_id = COALESCE(?, assigned_sales_rep_id),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [
      firstName, lastName, email, phone, companyName,
      source, status, priority, score, estimatedValue,
      countyId, businessCategoryId, assignedSalesRepId, notes,
      id, req.user.tenant_id
    ]);

    const updated = await db.query('SELECT * FROM leads WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);

    res.json({
      success: true,
      message: 'Lead updated successfully',
      data: { lead: updated[0] }
    });
  } catch (error) {
    logger.error('Update lead error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating lead' });
  }
};

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Private (Admin / Manager)
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM leads WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    await db.query('DELETE FROM leads WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);

    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    logger.error('Delete lead error:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting lead' });
  }
};

// @desc    Convert lead to customer
// @route   POST /api/leads/:id/convert
// @access  Private
const convertLead = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM leads WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const lead = existing[0];
    if (lead.status === 'converted') {
      return res.status(400).json({ success: false, message: 'Lead is already converted' });
    }

    // Create customer from lead
    const customerResult = await db.query(`
      INSERT INTO customers (
        tenant_id, first_name, last_name, email, phone, company_name,
        county_id, business_category_id, assigned_sales_rep_id,
        customer_type, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.tenant_id, lead.first_name, lead.last_name, lead.email, lead.phone,
      lead.company_name, lead.county_id, lead.business_category_id, lead.assigned_sales_rep_id,
      'individual', 'active', `Converted from lead #${lead.id}`, req.user.id
    ]);

    const customerId = customerResult.insertId;

    // Update lead status
    await db.query(`
      UPDATE leads SET
        status = 'converted',
        converted_to_customer_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [customerId, id, req.user.tenant_id]);

    res.json({
      success: true,
      message: 'Lead converted to customer successfully',
      data: {
        leadId: parseInt(id),
        customerId
      }
    });
  } catch (error) {
    logger.error('Convert lead error:', error);
    res.status(500).json({ success: false, message: 'Server error while converting lead' });
  }
};

module.exports = {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  convertLead
};
