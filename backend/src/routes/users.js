const express = require('express');
const bcrypt = require('bcryptjs');
const { protect, authorize } = require('../middleware/auth');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// All routes are protected
router.use(protect);

// @desc    Get tenant profile
// @route   GET /api/users/tenant
// @access  Private
router.get('/tenant', async (req, res) => {
  try {
    const tenants = await db.query(
      'SELECT id, name, slug, domain, kra_pin, plan, status, created_at FROM tenants WHERE id = ?',
      [req.user.tenant_id]
    );

    if (tenants.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.json({ success: true, data: { tenant: tenants[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while fetching tenant details' });
  }
});

// @desc    Update tenant profile
// @route   PUT /api/users/tenant
// @access  Private/Admin
router.put('/tenant', authorize('admin'), async (req, res) => {
  try {
    const { name, domain, kraPin, plan } = req.body;
    await db.query(
      `UPDATE tenants SET
        name = COALESCE(?, name),
        domain = COALESCE(?, domain),
        kra_pin = COALESCE(?, kra_pin),
        plan = COALESCE(?, plan),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, domain, kraPin, plan, req.user.tenant_id]
    );

    const updated = await db.query(
      'SELECT id, name, slug, domain, kra_pin, plan, status FROM tenants WHERE id = ?',
      [req.user.tenant_id]
    );

    res.json({ success: true, message: 'Organization profile updated', data: { tenant: updated[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while updating tenant' });
  }
});

// @desc    Get all users for current tenant (admin/manager only)
// @route   GET /api/users
// @access  Private/Admin/Manager
router.get('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    const users = await db.query(
      `SELECT id, tenant_id, email, first_name, last_name, phone, role, is_active, last_login, created_at
       FROM users 
       WHERE tenant_id = ?
       ORDER BY created_at DESC`,
      [req.user.tenant_id]
    );

    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
});

// @desc    Add a team member
// @route   POST /api/users
// @access  Private/Admin
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role = 'sales_rep' } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Email, password, first and last name are required' });
    }

    // Check if email already in use
    const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [req.user.tenant_id, email, passwordHash, firstName, lastName, phone || null, role]
    );

    res.status(201).json({
      success: true,
      message: 'Team member added successfully',
      data: { userId: result.insertId }
    });
  } catch (error) {
    logger.error('Error adding team member:', error);
    res.status(500).json({ success: false, message: 'Server error while adding team member' });
  }
});

// @desc    Update user role or active status
// @route   PATCH /api/users/:id
// @access  Private/Admin
router.patch('/:id', authorize('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { role, isActive } = req.body;

    // Check user belongs to this tenant
    const target = await db.query('SELECT id, role, is_active FROM users WHERE id = ? AND tenant_id = ?', [userId, req.user.tenant_id]);
    if (target.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found in this organization' });
    }

    const newRole = role !== undefined ? role : target[0].role;
    const newActive = isActive !== undefined ? (isActive ? 1 : 0) : target[0].is_active;

    await db.query(
      'UPDATE users SET role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?',
      [newRole, newActive, userId, req.user.tenant_id]
    );

    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while updating user' });
  }
});

module.exports = router;
