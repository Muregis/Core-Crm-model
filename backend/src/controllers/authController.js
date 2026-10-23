const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const resolveJwtSecret = () => process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';

const generateToken = (id) => {
  return jwt.sign({ id }, resolveJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
};

const createRefreshToken = async (userId) => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
};

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, firstName, lastName, phone, role = 'sales_rep', tenantName } = req.body;

    const existingUsers = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const tenantResult = await db.query(
      'INSERT INTO tenants (name, slug, status) VALUES (?, ?, ?)',
      [tenantName || `${firstName}'s Organization`, (tenantName || firstName).toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'active']
    );
    const tenantId = tenantResult.insertId;

    const userResult = await db.query(
      'INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tenantId, email, passwordHash, firstName, lastName, phone, role]
    );

    const users = await db.query(
      'SELECT id, tenant_id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?',
      [userResult.insertId]
    );
    const user = users[0];

    const token = generateToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    logger.info('New user registered: ' + email);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          tenant_id: user.tenant_id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone,
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

const registerTenant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      organizationName,
      slug,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      adminPhone,
      kraPin
    } = req.body;

    const existingSlug = await db.query('SELECT id FROM tenants WHERE slug = ?', [slug]);
    if (existingSlug.length > 0) {
      return res.status(400).json({ success: false, message: 'Organization slug is already taken' });
    }

    const existingUser = await db.query('SELECT id FROM users WHERE email = ?', [adminEmail]);
    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const tenantResult = await db.query(
      'INSERT INTO tenants (name, slug, kra_pin, status) VALUES (?, ?, ?, ?)',
      [organizationName, slug, kraPin || null, 'active']
    );
    const tenantId = tenantResult.insertId;

    const defaultStages = [
      ['Prospecting', 1, 10, '#6c757d'],
      ['Qualification', 2, 25, '#17a2b8'],
      ['Proposal', 3, 50, '#ffc107'],
      ['Negotiation', 4, 75, '#fd7e14'],
      ['Closed Won', 5, 100, '#28a745'],
      ['Closed Lost', 6, 0, '#dc3545']
    ];
    for (const [name, orderIndex, probability, color] of defaultStages) {
      await db.query(
        'INSERT INTO deal_stages (tenant_id, name, order_index, probability, color) VALUES (?, ?, ?, ?, ?)',
        [tenantId, name, orderIndex, probability, color]
      );
    }

    const userResult = await db.query(
      'INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tenantId, adminEmail, passwordHash, adminFirstName, adminLastName, adminPhone || null, 'admin']
    );

    const users = await db.query(
      'SELECT id, tenant_id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?',
      [userResult.insertId]
    );
    const user = users[0];

    const token = generateToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    logger.info(`New SaaS Tenant onboarded: ${organizationName} (${slug}) by ${adminEmail}`);

    res.status(201).json({
      success: true,
      message: 'Tenant provisioned successfully',
      data: {
        token,
        refreshToken,
        tenant: { id: tenantId, name: organizationName, slug },
        user: {
          id: user.id,
          tenant_id: user.tenant_id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.error('Register tenant error:', error);
    res.status(500).json({ success: false, message: 'Server error during tenant registration' });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const users = await db.query(
      'SELECT id, tenant_id, email, password_hash, first_name, last_name, phone, role, is_active FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const token = generateToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          tenant_id: user.tenant_id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone,
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const rows = await db.query(
      'SELECT id, user_id, expires_at, revoked FROM refresh_tokens WHERE token_hash = ?',
      [tokenHash]
    );

    if (!rows.length || rows[0].revoked) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    if (new Date(rows[0].expires_at) < new Date()) {
      return res.status(401).json({ success: false, message: 'Refresh token expired' });
    }

    await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', [rows[0].id]);

    const users = await db.query(
      'SELECT id, tenant_id, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
      [rows[0].user_id]
    );
    if (!users.length || !users[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    const user = users[0];
    const token = generateToken(user.id);
    const newRefresh = await createRefreshToken(user.id);

    res.json({
      success: true,
      data: {
        token,
        refreshToken: newRefresh,
        user: {
          id: user.id,
          tenant_id: user.tenant_id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        }
      }
    });
  } catch (error) {
    logger.error('Refresh error:', error);
    res.status(500).json({ success: false, message: 'Server error during token refresh' });
  }
};

const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const decoded = jwt.decode(token);
      const expiresAt =
        decoded && decoded.exp
          ? new Date(decoded.exp * 1000).toISOString()
          : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

      await db.query('INSERT OR IGNORE INTO token_blocklist (token_hash, expires_at) VALUES (?, ?)', [
        tokenHash,
        expiresAt
      ]);
    }

    if (req.user) {
      await db.query('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [req.user.id]);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Server error during logout' });
  }
};

const getMe = async (req, res) => {
  try {
    const users = await db.query(
      'SELECT id, tenant_id, email, first_name, last_name, phone, role, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: { user: users[0] } });
  } catch (error) {
    logger.error('Get me error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    await db.query(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [firstName, lastName, phone, req.user.id]
    );

    const users = await db.query(
      'SELECT id, tenant_id, email, first_name, last_name, phone, role, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Profile updated',
      data: { user: users[0] }
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const users = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const ok = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!ok) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      passwordHash,
      req.user.id
    ]);

    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error changing password' });
  }
};

module.exports = {
  register,
  registerTenant,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
  changePassword
};
