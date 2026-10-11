const db = require('../config/database');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      customerType,
      businessCategory,
      county,
      salesRep,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE c.tenant_id = ?';
    const params = [req.user.tenant_id];

    // If role is sales_rep, they should only see their assigned customers or all tenant customers?
    // Let's implement RBAC: sales_rep sees only assigned customers, managers and admins see all
    if (req.user.role === 'sales_rep') {
      whereClause += ' AND c.assigned_sales_rep_id = ?';
      params.push(req.user.id);
    }

    // Build WHERE clause
    if (search) {
      whereClause += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.company_name LIKE ? OR c.phone LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      whereClause += ` AND c.status = ?`;
      params.push(status);
    }

    if (customerType) {
      whereClause += ` AND c.customer_type = ?`;
      params.push(customerType);
    }

    if (businessCategory) {
      whereClause += ` AND bc.name = ?`;
      params.push(businessCategory);
    }

    if (county) {
      whereClause += ` AND co.name = ?`;
      params.push(county);
    }

    if (salesRep) {
      whereClause += ` AND (u.first_name || ' ' || u.last_name) LIKE ?`;
      params.push(`%${salesRep}%`);
    }

    // Validate sort field
    const allowedSortFields = ['first_name', 'last_name', 'company_name', 'status', 'customer_type', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get customers
    const customers = await db.query(`
      SELECT 
        c.id,
        c.tenant_id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.company_name,
        c.customer_type,
        c.status,
        c.physical_address,
        c.created_at,
        c.updated_at,
        co.name as county_name,
        sc.name as sub_county_name,
        bc.name as business_category,
        (u.first_name || ' ' || u.last_name) as sales_rep_name,
        u.email as sales_rep_email,
        (SELECT COUNT(*) FROM deals WHERE customer_id = c.id AND status = 'won') as won_deals_count,
        (SELECT COALESCE(SUM(value), 0) FROM deals WHERE customer_id = c.id AND status = 'won') as total_revenue,
        (SELECT COUNT(*) FROM communications WHERE customer_id = c.id) as communications_count,
        (SELECT COUNT(*) FROM mpesa_transactions WHERE customer_id = c.id AND status = 'completed') as transaction_count
      FROM customers c
      LEFT JOIN counties co ON c.county_id = co.id
      LEFT JOIN sub_counties sc ON c.sub_county_id = sc.id
      LEFT JOIN business_categories bc ON c.business_category_id = bc.id
      LEFT JOIN users u ON c.assigned_sales_rep_id = u.id
      ${whereClause}
      ORDER BY c.${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM customers c
      LEFT JOIN counties co ON c.county_id = co.id
      LEFT JOIN business_categories bc ON c.business_category_id = bc.id
      LEFT JOIN users u ON c.assigned_sales_rep_id = u.id
      ${whereClause}
    `, params);

    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching customers'
    });
  }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private
const getCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customers = await db.query(`
      SELECT 
        c.*,
        co.name as county_name,
        sc.name as sub_county_name,
        bc.name as business_category,
        (u.first_name || ' ' || u.last_name) as sales_rep_name,
        u.email as sales_rep_email,
        u.phone as sales_rep_phone
      FROM customers c
      LEFT JOIN counties co ON c.county_id = co.id
      LEFT JOIN sub_counties sc ON c.sub_county_id = sc.id
      LEFT JOIN business_categories bc ON c.business_category_id = bc.id
      LEFT JOIN users u ON c.assigned_sales_rep_id = u.id
      WHERE c.id = ? AND c.tenant_id = ?
    `, [id, req.user.tenant_id]);

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const customer = customers[0];

    // RBAC: If sales_rep, check if assigned
    if (req.user.role === 'sales_rep' && customer.assigned_sales_rep_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Customer not assigned to you'
      });
    }

    // Get customer tags
    const tags = await db.query(`
      SELECT ct.id, ct.name, ct.color
      FROM customer_tags ct
      JOIN customer_tag_relations ctr ON ct.id = ctr.tag_id
      WHERE ctr.customer_id = ?
    `, [id]);

    // Get recent deals
    const deals = await db.query(`
      SELECT 
        d.id,
        d.title,
        d.value,
        d.currency,
        d.expected_close_date,
        d.actual_close_date,
        d.status,
        ds.name as stage_name,
        ds.color as stage_color
      FROM deals d
      JOIN deal_stages ds ON d.deal_stage_id = ds.id
      WHERE d.customer_id = ?
      ORDER BY d.created_at DESC
      LIMIT 10
    `, [id]);

    // Get recent communications
    const communications = await db.query(`
      SELECT 
        id,
        type,
        direction,
        subject,
        status,
        created_at
      FROM communications
      WHERE customer_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [id]);

    // Get recent transactions
    const transactions = await db.query(`
      SELECT 
        id,
        transaction_id,
        amount,
        currency,
        transaction_type,
        status,
        transaction_date,
        receipt_number
      FROM mpesa_transactions
      WHERE customer_id = ?
      ORDER BY transaction_date DESC
      LIMIT 10
    `, [id]);

    customer.tags = tags;
    customer.recent_deals = deals;
    customer.recent_communications = communications;
    customer.recent_transactions = transactions;

    res.json({
      success: true,
      data: { customer }
    });
  } catch (error) {
    logger.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching customer'
    });
  }
};

// @desc    Create customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      businessCategoryId,
      countyId,
      subCountyId,
      physicalAddress,
      customerType = 'individual',
      status = 'prospect',
      notes,
      assignedSalesRepId,
      tags
    } = req.body;

    // Check for duplicate email or phone within tenant
    const existingCustomers = await db.query(
      'SELECT id FROM customers WHERE tenant_id = ? AND (email = ? OR phone = ?)',
      [req.user.tenant_id, email, phone]
    );

    if (existingCustomers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this email or phone already exists'
      });
    }

    // Create customer
    const result = await db.query(`
      INSERT INTO customers (
        tenant_id, first_name, last_name, email, phone, company_name,
        business_category_id, county_id, sub_county_id, physical_address,
        customer_type, status, notes, assigned_sales_rep_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.tenant_id,
      firstName, lastName, email, phone, companyName,
      businessCategoryId, countyId, subCountyId, physicalAddress,
      customerType, status, notes, assignedSalesRepId || req.user.id, req.user.id
    ]);

    const customerId = result.insertId;

    // Add tags if provided
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        await db.query(
          'INSERT INTO customer_tag_relations (tenant_id, customer_id, tag_id) VALUES (?, ?, ?)',
          [req.user.tenant_id, customerId, tagId]
        );
      }
    }

    // Get created customer
    const customers = await db.query(`
      SELECT 
        c.*,
        co.name as county_name,
        sc.name as sub_county_name,
        bc.name as business_category,
        (u.first_name || ' ' || u.last_name) as sales_rep_name
      FROM customers c
      LEFT JOIN counties co ON c.county_id = co.id
      LEFT JOIN sub_counties sc ON c.sub_county_id = sc.id
      LEFT JOIN business_categories bc ON c.business_category_id = bc.id
      LEFT JOIN users u ON c.assigned_sales_rep_id = u.id
      WHERE c.id = ? AND c.tenant_id = ?
    `, [customerId, req.user.tenant_id]);

    logger.info(`Customer created: ${firstName} ${lastName} (${email})`);

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: { customer: customers[0] }
    });
  } catch (error) {
    logger.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating customer'
    });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      companyName,
      businessCategoryId,
      countyId,
      subCountyId,
      physicalAddress,
      customerType,
      status,
      notes,
      assignedSalesRepId,
      tags
    } = req.body;

    // Check if customer exists in the same tenant
    const existingCustomers = await db.query('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    if (existingCustomers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // RBAC: If sales_rep, check assignment
    if (req.user.role === 'sales_rep' && existingCustomers[0].assigned_sales_rep_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only update customers assigned to you'
      });
    }

    // Check for duplicate email or phone (excluding current customer)
    const duplicateCustomers = await db.query(
      'SELECT id FROM customers WHERE tenant_id = ? AND (email = ? OR phone = ?) AND id != ?',
      [req.user.tenant_id, email, phone, id]
    );

    if (duplicateCustomers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this email or phone already exists'
      });
    }

    // Update customer
    await db.query(`
      UPDATE customers SET
        first_name = ?, last_name = ?, email = ?, phone = ?, company_name = ?,
        business_category_id = ?, county_id = ?, sub_county_id = ?, physical_address = ?,
        customer_type = ?, status = ?, notes = ?, assigned_sales_rep_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [
      firstName, lastName, email, phone, companyName,
      businessCategoryId, countyId, subCountyId, physicalAddress,
      customerType, status, notes, assignedSalesRepId, id, req.user.tenant_id
    ]);

    // Update tags if provided
    if (tags !== undefined) {
      await db.query('DELETE FROM customer_tag_relations WHERE customer_id = ? AND tenant_id = ?', [id, req.user.tenant_id]);

      if (tags.length > 0) {
        for (const tagId of tags) {
          await db.query(
            'INSERT INTO customer_tag_relations (tenant_id, customer_id, tag_id) VALUES (?, ?, ?)',
            [req.user.tenant_id, id, tagId]
          );
        }
      }
    }

    // Get updated customer
    const customers = await db.query(`
      SELECT 
        c.*,
        co.name as county_name,
        sc.name as sub_county_name,
        bc.name as business_category,
        (u.first_name || ' ' || u.last_name) as sales_rep_name
      FROM customers c
      LEFT JOIN counties co ON c.county_id = co.id
      LEFT JOIN sub_counties sc ON c.sub_county_id = sc.id
      LEFT JOIN business_categories bc ON c.business_category_id = bc.id
      LEFT JOIN users u ON c.assigned_sales_rep_id = u.id
      WHERE c.id = ? AND c.tenant_id = ?
    `, [id, req.user.tenant_id]);

    logger.info(`Customer updated: ${firstName} ${lastName} (${email})`);

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: { customer: customers[0] }
    });
  } catch (error) {
    logger.error('Update customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating customer'
    });
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private (Admin/Manager only via route middleware)
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if customer exists in current tenant
    const customers = await db.query('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer has related records
    const deals = await db.query('SELECT COUNT(*) as count FROM deals WHERE customer_id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    if (deals[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer with existing deals'
      });
    }

    // Delete customer
    await db.query('DELETE FROM customers WHERE id = ? AND tenant_id = ?', [id, req.user.tenant_id]);

    logger.info(`Customer deleted: ${customers[0].first_name} ${customers[0].last_name}`);

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    logger.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting customer'
    });
  }
};

// @desc    KDPA/GDPR Subject Access Request - Export all customer personal data
// @route   GET /api/customers/:id/kdpa-export
// @access  Private (Admin, Manager)
const exportCustomerData = async (req, res) => {
  try {
    const { id } = req.params;
    const customers = await db.query(
      'SELECT * FROM customers WHERE id = ? AND tenant_id = ?',
      [id, req.user.tenant_id]
    );

    if (customers.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customer = customers[0];
    const deals = await db.query('SELECT * FROM deals WHERE customer_id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    const communications = await db.query('SELECT * FROM communications WHERE customer_id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    const tasks = await db.query('SELECT * FROM tasks WHERE customer_id = ? AND tenant_id = ?', [id, req.user.tenant_id]);
    const mpesa = await db.query('SELECT * FROM mpesa_transactions WHERE customer_id = ? AND tenant_id = ?', [id, req.user.tenant_id]);

    res.json({
      success: true,
      compliance: 'Kenya Data Protection Act 2019 (Section 26 - Right to Access)',
      data: {
        customer,
        deals,
        communications,
        tasks,
        mpesaTransactions: mpesa
      }
    });
  } catch (error) {
    logger.error('KDPA export error:', error);
    res.status(500).json({ success: false, message: 'Error exporting customer data' });
  }
};

// @desc    KDPA Right to be Forgotten - Anonymize Customer Personal Data
// @route   POST /api/customers/:id/anonymize
// @access  Private (Admin)
const anonymizeCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customers = await db.query(
      'SELECT id, first_name, last_name FROM customers WHERE id = ? AND tenant_id = ?',
      [id, req.user.tenant_id]
    );

    if (customers.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Overwrite PII with anonymized masks while keeping financial foreign keys intact
    await db.query(
      `UPDATE customers SET
        first_name = 'Anonymized',
        last_name = 'Subject_' || id,
        email = 'anonymized_' || id || '@erased.local',
        phone = '+254700000000',
        physical_address = NULL,
        notes = 'Data sanitized per Kenya Data Protection Act Right to Erasure',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?`,
      [id, req.user.tenant_id]
    );

    logger.info(`Customer ${id} anonymized pursuant to KDPA 2019 request by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Customer PII anonymized successfully pursuant to KDPA 2019'
    });
  } catch (error) {
    logger.error('KDPA anonymization error:', error);
    res.status(500).json({ success: false, message: 'Error anonymizing customer data' });
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  exportCustomerData,
  anonymizeCustomer
};
