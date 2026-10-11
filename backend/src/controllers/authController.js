const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Generate JWT Access Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
};

// Generate Refresh Token and store hash in database
const createRefreshToken = async (userId) => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  
  // Expiry: 7 days from now
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
};

// @desc    Register user into existing or default tenant
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const { email, password, firstName, lastName, phone, role = 'sales_rep', tenantName } = req.body;

    const existingUsers = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Transaction for tenant and user creation
    await db.transaction(async (trx) => {
      let tName = tenantName || (firstName + "'s Organization");
      const tResult = await trx.run('INSERT INTO tenants (name) VALUES (?)', [tName]);
      const tenantId = tResult.insertId || tResult.id;

      const result = await trx.run(
        'INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [tenantId, email, passwordHash, firstName, lastName, phone, role]
      );
      const userId = result.insertId || result.id;

      const users = await trx.query(
        'SELECT id, tenant_id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?',
        [userId]
      );
      const user = users[0];
      const token = generateToken(user.id);
      const refreshToken = await createRefreshToken(user.id);
      
      await trx.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      
      logger.info('New user registered: ' + email);
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user, token, refreshToken }
      });
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// @desc    Self-Service Multi-Tenant SaaS Registration & Organization Provisioning
// @route   POST /api/auth/register-tenant
// @access  Public
const registerTenant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const {
      companyName,
      slug,
      kraPin,
      email,
      password,
      firstName,
      lastName,
      phone,
      plan = 'starter'
    } = req.body;

    const normalizedSlug = slug.toLowerCase().trim();

    // Check slug collision
    const existingTenants = await db.query('SELECT id FROM tenants WHERE slug = ?', [normalizedSlug]);
    if (existingTenants.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Company subdomain '${normalizedSlug}' is already taken. Please choose another.`
      });
    }

    // Check email collision
    const existingUsers = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await db.transaction(async (trx) => {
      // 1. Provision Tenant
      const tResult = await trx.run(
        'INSERT INTO tenants (name, slug, kra_pin, plan, status) VALUES (?, ?, ?, ?, ?)',
        [companyName, normalizedSlug, kraPin || null, plan, 'active']
      );
      const tenantId = tResult.insertId || tResult.id;

      // 2. Seed Default Deal Stages for this Tenant
      const defaultStages = [
        [tenantId, 'Prospecting', 1, 10, '#6c757d'],
        [tenantId, 'Qualification', 2, 25, '#17a2b8'],
        [tenantId, 'Proposal', 3, 50, '#ffc107'],
        [tenantId, 'Negotiation', 4, 75, '#fd7e14'],
        [tenantId, 'Closed Won', 5, 100, '#28a745'],
        [tenantId, 'Closed Lost', 6, 0, '#dc3545']
      ];
      for (const s of defaultStages) {
        await trx.run(
          'INSERT INTO deal_stages (tenant_id, name, order_index, probability, color) VALUES (?, ?, ?, ?, ?)',
          s
        );
      }

      // 3. Seed Default Tenant System Settings
      await trx.run(
        'INSERT INTO system_settings (tenant_id, setting_key, setting_value, description) VALUES (?, ?, ?, ?)',
        [tenantId, 'currency_' + tenantId, 'KES', 'Default billing currency']
      );

      // 4. Create Initial Tenant Administrator User
      const uResult = await trx.run(
        'INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [tenantId, email, passwordHash, firstName, lastName, phone || null, 'admin']
      );
      const userId = uResult.insertId || uResult.id;

      // 5. Generate Auth Credentials
      const token = generateToken(userId);
      const refreshToken = await createRefreshToken(userId);

      const users = await trx.query(
        'SELECT id, tenant_id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?',
        [userId]
      );
      const user = users[0];

      logger.info(`New SaaS Tenant onboarded: ${companyName} (${normalizedSlug}) by ${email}`);

      res.status(201).json({
        success: true,
        message: 'Organization provisioned and admin user created successfully',
        data: {
          tenant: {
            id: tenantId,
            name: companyName,
            slug: normalizedSlug,
            plan,
            status: 'active'
          },
          user,
          token,
          refreshToken
        }
      });
    });

  } catch (error) {
    logger.error('Tenant registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during tenant provisioning' });
  }
};

// @desc    Public Tenant Metadata Lookup (for custom tenant login portals)
// @route   GET /api/auth/tenant/:slug
// @access  Public
const getPublicTenantInfo = async (req, res) => {
  try {
    const { slug } = req.params;
    const tenants = await db.query(
      'SELECT id, name, slug, plan, status, created_at FROM tenants WHERE slug = ?',
      [slug.toLowerCase()]
    );

    if (tenants.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant organization not found' });
    }

    res.json({
      success: true,
      data: { tenant: tenants[0] }
    });
  } catch (error) {
    logger.error('Error fetching tenant info:', error);
    res.status(500).json({ success: false, message: 'Server error fetching tenant info' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if user exists
    const users = await db.query(
      'SELECT id, tenant_id, email, password_hash, first_name, last_name, phone, role, is_active FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    // Update last login
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          tenant_id: user.tenant_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Refresh Access Token
// @route   POST /api/auth/refresh
// @access  Public
const refreshTokenHandler = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const records = await db.query(
      'SELECT id, user_id, expires_at, revoked FROM refresh_tokens WHERE token_hash = ?',
      [tokenHash]
    );

    if (records.length === 0 || records[0].revoked) {
      return res.status(401).json({ success: false, message: 'Invalid or revoked refresh token' });
    }

    const record = records[0];
    if (new Date(record.expires_at) < new Date()) {
      return res.status(401).json({ success: false, message: 'Refresh token has expired' });
    }

    // Token rotation: Revoke used token
    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', [record.id]);

    // Issue new pair
    const users = await db.query(
      'SELECT id, tenant_id, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
      [record.user_id]
    );
    if (users.length === 0 || !users[0].is_active) {
      return res.status(401).json({ success: false, message: 'User is inactive or deleted' });
    }

    const user = users[0];
    const newAccessToken = generateToken(user.id);
    const newRefreshToken = await createRefreshToken(user.id);

    res.json({
      success: true,
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ success: false, message: 'Server error during token refresh' });
  }
};

// @desc    Logout and invalidate tokens
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // Add current Bearer token to blocklist
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      const token = req.headers.authorization.split(' ')[1];
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await db.query(
        'INSERT INTO token_blocklist (token_hash, expires_at) VALUES (?, ?)',
        [tokenHash, expiresAt]
      );
    }

    // Revoke all refresh tokens for this user
    if (req.user && req.user.id) {
      await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [req.user.id]);
    }

    res.json({
      success: true,
      message: 'Logged out successfully. Tokens have been revoked.'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Server error during logout' });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const users = await db.query(
      'SELECT id, tenant_id, email, first_name, last_name, phone, role, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          tenant_id: user.tenant_id,
          email: user.email,
          first_name: user.first_name,
          firstName: user.first_name,
          last_name: user.last_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role,
          isActive: user.is_active,
          lastLogin: user.last_login,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    logger.error('Get me error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching user profile' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { firstName, lastName, phone } = req.body;

    await db.query(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?',
      [firstName, lastName, phone, req.user.id]
    );

    const users = await db.query(
      'SELECT id, tenant_id, email, first_name, last_name, phone, role, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    const user = users[0];
    logger.info(`User profile updated: ${user.email}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          tenant_id: user.tenant_id,
          email: user.email,
          first_name: user.first_name,
          firstName: user.first_name,
          last_name: user.last_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role,
          isActive: user.is_active,
          lastLogin: user.last_login,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating profile' });
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    const users = await db.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await db.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    // Revoke existing refresh tokens when password changes
    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [req.user.id]);

    logger.info(`Password changed for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error during password change' });
  }
};

module.exports = {
  register,
  registerTenant,
  getPublicTenantInfo,
  login,
  refreshTokenHandler,
  logout,
  getMe,
  updateProfile,
  changePassword
};
