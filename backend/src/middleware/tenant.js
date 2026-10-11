const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware to resolve tenant from Subdomain, Headers, or User Session
 */
const resolveTenant = async (req, res, next) => {
  try {
    let tenantSlug = null;
    let tenantId = null;

    // 1. Check custom headers
    if (req.headers['x-tenant-slug']) {
      tenantSlug = req.headers['x-tenant-slug'];
    } else if (req.headers['x-tenant-id']) {
      tenantId = parseInt(req.headers['x-tenant-id'], 10);
    }

    // 2. Check Host / Subdomain (e.g. "acme.corecrm.co.ke" or "acme.localhost:5000")
    if (!tenantSlug && !tenantId && req.headers.host) {
      const hostParts = req.headers.host.split(':')[0].split('.');
      if (hostParts.length > 2 && hostParts[0] !== 'www' && hostParts[0] !== 'api') {
        tenantSlug = hostParts[0];
      }
    }

    // 3. Fallback to authenticated user tenant_id
    if (!tenantSlug && !tenantId && req.user && req.user.tenant_id) {
      tenantId = req.user.tenant_id;
    }

    // Query tenant if identifier present
    if (tenantId) {
      const tenants = await db.query(
        'SELECT id, name, slug, plan, status FROM tenants WHERE id = ?',
        [tenantId]
      );
      if (tenants.length > 0) {
        req.tenant = tenants[0];
      }
    } else if (tenantSlug) {
      const tenants = await db.query(
        'SELECT id, name, slug, plan, status FROM tenants WHERE slug = ?',
        [tenantSlug.toLowerCase()]
      );
      if (tenants.length > 0) {
        req.tenant = tenants[0];
      }
    }

    next();
  } catch (error) {
    logger.error('Error in resolveTenant middleware:', error);
    next();
  }
};

/**
 * Route guard requiring an active tenant
 */
const requireTenant = (req, res, next) => {
  if (!req.tenant) {
    return res.status(400).json({
      success: false,
      message: 'Tenant context required. Please provide a valid X-Tenant-Slug header or host subdomain.'
    });
  }

  if (req.tenant.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: `Tenant organization '${req.tenant.name}' is currently suspended or inactive.`
    });
  }

  next();
};

module.exports = {
  resolveTenant,
  requireTenant
};
