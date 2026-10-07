const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

// Protect routes
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database
      const users = await db.query(
        'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
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
      next();
    } catch (error) {
      logger.error('Auth middleware error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }
};

// Grant access to specific roles
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

// Log activity
const logActivity = (action, entityType) => {
  return async (req, res, next) => {
    try {
      if (req.user && req.method !== 'GET') {
        const entityId = req.params.id || (req.body.id ? req.body.id : null);
        const oldValues = req.oldValues || null;
        const newValues = req.body || null;

        await db.query(
          `INSERT INTO activity_log (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
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
      next(); // Don't block the request if logging fails
    }
  };
};

module.exports = {
  protect,
  authorize,
  logActivity
};
