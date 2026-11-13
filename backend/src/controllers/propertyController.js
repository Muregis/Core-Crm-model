const propertyModel = require('../models/propertyModel');
const logger = require('../utils/logger');

// @desc    Get all properties for tenant
// @route   GET /api/properties
// @access  Private
const getProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      customer_id,
      q,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const { properties, total } = await propertyModel.findAll(
      req.user.tenant_id,
      { customer_id, q },
      { limit: limitNum, offset, sortBy, sortOrder }
    );

    res.json({
      success: true,
      data: {
        properties,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching properties:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching properties' });
  }
};

// @desc    Get single property by ID
// @route   GET /api/properties/:id
// @access  Private
const getProperty = async (req, res) => {
  try {
    const property = await propertyModel.findById(req.params.id, req.user.tenant_id);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    res.json({ success: true, data: { property } });
  } catch (error) {
    logger.error('Error fetching property:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching property' });
  }
};

// @desc    Create new property
// @route   POST /api/properties
// @access  Private
const createProperty = async (req, res) => {
  try {
    const { name, customer_id, address, unit_count, notes } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Property name is required' });
    }

    const property = await propertyModel.create({
      tenant_id: req.user.tenant_id,
      customer_id: customer_id ? Number(customer_id) : null,
      name: name.trim(),
      address: address || null,
      unit_count: parseInt(unit_count, 10) || 1,
      notes: notes || null,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: { property }
    });
  } catch (error) {
    logger.error('Error creating property:', error);
    res.status(500).json({ success: false, message: 'Server error while creating property' });
  }
};

// @desc    Update property
// @route   PATCH /api/properties/:id
// @access  Private
const updateProperty = async (req, res) => {
  try {
    const existing = await propertyModel.findById(req.params.id, req.user.tenant_id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const updated = await propertyModel.update(req.params.id, req.user.tenant_id, req.body);
    res.json({
      success: true,
      message: 'Property updated successfully',
      data: { property: updated }
    });
  } catch (error) {
    logger.error('Error updating property:', error);
    res.status(500).json({ success: false, message: 'Server error while updating property' });
  }
};

// @desc    Delete property
// @route   DELETE /api/properties/:id
// @access  Private (admin/manager)
const deleteProperty = async (req, res) => {
  try {
    const existing = await propertyModel.findById(req.params.id, req.user.tenant_id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    await propertyModel.delete(req.params.id, req.user.tenant_id);
    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    logger.error('Error deleting property:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting property' });
  }
};

// @desc    Get complete property maintenance memory (health score, recurring alerts, lifetime spend, warranties, timeline)
// @route   GET /api/properties/:id/maintenance-memory
// @access  Private
const getMaintenanceMemory = async (req, res) => {
  try {
    const memory = await propertyModel.getMaintenanceMemory(req.params.id, req.user.tenant_id);
    if (!memory) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    res.json({
      success: true,
      data: memory
    });
  } catch (error) {
    logger.error('Error fetching maintenance memory:', error);
    res.status(500).json({ success: false, message: 'Server error fetching maintenance memory' });
  }
};

// @desc    Get consolidated landlord monthly property report
// @route   GET /api/properties/landlord/:customerId/monthly-report
// @access  Private
const getLandlordMonthlyReport = async (req, res) => {
  try {
    const report = await propertyModel.getLandlordMonthlyReport(
      req.params.customerId,
      req.user.tenant_id,
      req.query.month || req.query.monthYear
    );
    if (!report) {
      return res.status(404).json({ success: false, message: 'Landlord customer not found' });
    }
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Error fetching landlord monthly report:', error);
    res.status(500).json({ success: false, message: 'Server error fetching landlord monthly report' });
  }
};

module.exports = {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  getMaintenanceMemory,
  getLandlordMonthlyReport
};
