const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// All routes are protected
router.use(protect);

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

module.exports = router;
