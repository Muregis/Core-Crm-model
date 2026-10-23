const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const blocked = await db.query('SELECT id FROM token_blocklist WHERE token_hash = ?', [
        tokenHash
      ]);
      if (blocked.length > 0) {
        return res.status(401).json({
          success: false,
          message: 'Token has been revoked. Please log in again.'
        });
      }

      const secret = process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';
      const decoded = jwt.verify(token, secret);

      const users = await db.query(
        'SELECT id, tenant_id, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = users[0];

      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      req.user = user;
      return next();
    } catch (error) {
      // Expected for tests that send garbage tokens (e.g. Bearer invalid.token).
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        logger.warn('Auth rejected token', { name: error.name, message: error.message });
      } else {
        logger.error('Auth middleware error:', error);
      }
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Not authorized, no token'
  });
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }

    next();
  };
};

const logActivity = (action, entityType) => {
  return async (req, res, next) => {
    try {
      if (req.user && req.method !== 'GET') {
        const entityId = req.params.id || (req.body.id ? req.body.id : null);
        const oldValues = req.oldValues || null;
        const newValues = req.body || null;

        await db.query(
          `INSERT INTO activity_log (tenant_id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.tenant_id,
            req.user.id,
            action,
            entityType,
            entityId,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            req.ip,
            req.get('User-Agent')
          ]
        );
      }
      next();
    } catch (error) {
      logger.error('Activity logging error:', error);
      next();
    }
  };
};

module.exports = {
  protect,
  authorize,
  logActivity
};
