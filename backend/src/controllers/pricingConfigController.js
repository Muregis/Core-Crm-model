// backend/src/controllers/pricingConfigController.js
const pricingConfigModel = require('../models/pricingConfigModel');
const logger = require('../utils/logger');

// @desc    Get all active pricing drivers and cost assumptions
// @route   GET /api/pricing-config
// @access  Private
const getActivePricingConfig = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { asOfDate } = req.query;
    const drivers = await pricingConfigModel.getAllActive(tenantId, asOfDate);
    const map = await pricingConfigModel.getDriversMap(tenantId, asOfDate);
    res.json({
      success: true,
      data: {
        drivers,
        driver_map: map
      }
    });
  } catch (error) {
    logger.error('Error fetching pricing config:', error);
    res.status(500).json({ success: false, message: 'Server error fetching pricing configuration' });
  }
};

// @desc    Update a pricing or cost driver with effective date and audit log
// @route   PATCH /api/pricing-config/:key
// @access  Private (Admin only)
const updatePricingDriver = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const { key } = req.params;
    const { value, unit, category, description, effective_from, reason } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({ success: false, message: 'Driver value is required' });
    }

    const updated = await pricingConfigModel.updateDriver(tenantId, userId, key, value, {
      unit,
      category,
      description,
      effective_from,
      reason: reason || `Updated by user ${req.user.email}`
    });

    res.json({
      success: true,
      message: `Pricing driver '${key}' successfully updated to ${updated.new_value} (effective: ${updated.effective_from})`,
      data: updated
    });
  } catch (error) {
    logger.error('Error updating pricing driver:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Server error updating pricing driver' });
  }
};

// @desc    Get audit trail history for a specific driver key
// @route   GET /api/pricing-config/:key/history
// @access  Private (Admin only)
const getDriverHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { key } = req.params;
    const history = await pricingConfigModel.getDriverHistory(tenantId, key);
    res.json({ success: true, data: { history } });
  } catch (error) {
    logger.error('Error fetching driver history:', error);
    res.status(500).json({ success: false, message: 'Server error fetching driver history' });
  }
};

// @desc    Get live Observable Financial & Break-Even Model (Model v2.0)
// @route   GET /api/pricing-config/financial-model (and /api/tickets/dashboard/financial-model)
// @access  Private
const getFinancialBreakEvenModel = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const model = await pricingConfigModel.getFinancialBreakEvenModel(tenantId);
    res.json({ success: true, data: model });
  } catch (error) {
    logger.error('Error computing financial break-even model:', error);
    res.status(500).json({ success: false, message: 'Server error computing financial model' });
  }
};

module.exports = {
  getActivePricingConfig,
  updatePricingDriver,
  getDriverHistory,
  getFinancialBreakEvenModel
};
