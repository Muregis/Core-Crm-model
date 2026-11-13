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
    const {
      name,
      customer_id,
      address,
      unit_count,
      airbnb_managed,
      default_approval_threshold_kes,
      emergency_auto_containment_limit_kes,
      notes
    } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Property name is required' });
    }

    const property = await propertyModel.create({
      tenant_id: req.user.tenant_id,
      customer_id: customer_id ? Number(customer_id) : null,
      name: name.trim(),
      address: address || null,
      unit_count: parseInt(unit_count, 10) || 1,
      airbnb_managed: airbnb_managed ? 1 : 0,
      default_approval_threshold_kes: default_approval_threshold_kes !== undefined ? Number(default_approval_threshold_kes) : 5000,
      emergency_auto_containment_limit_kes: emergency_auto_containment_limit_kes !== undefined ? Number(emergency_auto_containment_limit_kes) : 8000,
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

// @desc    Schedule a preventive inspection package for a property
// @route   POST /api/properties/:id/preventive-inspections
// @access  Private
const schedulePreventiveInspection = async (req, res) => {
  try {
    const inspection = await propertyModel.schedulePreventiveInspection({
      tenant_id: req.user.tenant_id,
      property_id: req.params.id,
      package_type: req.body.package_type,
      scheduled_date: req.body.scheduled_date,
      inspector_user_id: req.body.inspector_user_id || req.user.id,
      cost_kes: req.body.cost_kes || 0,
      notes: req.body.notes
    });

    res.status(201).json({
      success: true,
      message: 'Preventive inspection package scheduled successfully',
      data: { inspection }
    });
  } catch (error) {
    logger.error('Error scheduling preventive inspection:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error scheduling preventive inspection'
    });
  }
};

// @desc    Get preventive inspections (by property or tenant-wide)
// @route   GET /api/properties/:id/preventive-inspections or GET /api/properties/preventive-inspections
// @access  Private
const getPreventiveInspections = async (req, res) => {
  try {
    const propertyId = req.params.id ? Number(req.params.id) : req.query.property_id;
    const inspections = await propertyModel.getPreventiveInspections(req.user.tenant_id, {
      property_id: propertyId,
      package_type: req.query.package_type,
      status: req.query.status
    });

    res.status(200).json({
      success: true,
      data: { inspections }
    });
  } catch (error) {
    logger.error('Error fetching preventive inspections:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching preventive inspections'
    });
  }
};

// @desc    Complete a preventive inspection with checklist and condition rating
// @route   PATCH /api/properties/preventive-inspections/:inspectionId
// @access  Private
const completePreventiveInspection = async (req, res) => {
  try {
    const updated = await propertyModel.completePreventiveInspection(
      req.params.inspectionId,
      req.user.tenant_id,
      req.body
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Preventive inspection not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Preventive inspection completed successfully',
      data: { inspection: updated }
    });
  } catch (error) {
    logger.error('Error completing preventive inspection:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error completing preventive inspection'
    });
  }
};

module.exports = {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  getMaintenanceMemory,
  getLandlordMonthlyReport,
  schedulePreventiveInspection,
  getPreventiveInspections,
  completePreventiveInspection
};
