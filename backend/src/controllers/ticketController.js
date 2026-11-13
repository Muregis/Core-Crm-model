const ticketService = require('../services/ticketService');
const ticketModel = require('../models/ticketModel');
const logger = require('../utils/logger');

// @desc    Get all tickets for tenant with filters & pagination
// @route   GET /api/tickets
// @access  Private
const getTickets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      property_id,
      customer_id,
      status,
      category,
      priority,
      assigned_technician_id,
      technician_id,
      landlord_approval_required,
      is_sla_breached,
      is_warranty_claim,
      startDate,
      endDate,
      from_date,
      to_date,
      q,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const filters = {
      property_id,
      customer_id,
      status,
      category,
      priority,
      assigned_technician_id: assigned_technician_id || technician_id,
      landlord_approval_required,
      is_sla_breached,
      is_warranty_claim,
      startDate: startDate || from_date,
      endDate: endDate || to_date,
      q
    };

    const { tickets, total } = await ticketModel.findAll(
      req.user.tenant_id,
      filters,
      { limit: limitNum, offset, sortBy, sortOrder }
    );

    res.json({
      success: true,
      data: {
        tickets,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching tickets' });
  }
};

// @desc    Get single ticket by ID
// @route   GET /api/tickets/:id
// @access  Private
const getTicket = async (req, res) => {
  try {
    const ticket = await ticketModel.findById(req.params.id, req.user.tenant_id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    res.json({ success: true, data: { ticket } });
  } catch (error) {
    logger.error('Error fetching ticket:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching ticket' });
  }
};

// @desc    Create new ticket
// @route   POST /api/tickets
// @access  Private
const createTicket = async (req, res) => {
  try {
    const ticket = await ticketService.createTicket(
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: { ticket }
    });
  } catch (error) {
    logger.error('Error creating ticket:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error while creating ticket'
    });
  }
};

// @desc    Update ticket details
// @route   PATCH /api/tickets/:id
// @access  Private
const updateTicket = async (req, res) => {
  try {
    const existing = await ticketModel.findById(req.params.id, req.user.tenant_id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const updated = await ticketModel.update(req.params.id, req.user.tenant_id, req.body);
    res.json({
      success: true,
      message: 'Ticket updated successfully',
      data: { ticket: updated }
    });
  } catch (error) {
    logger.error('Error updating ticket:', error);
    res.status(500).json({ success: false, message: 'Server error while updating ticket' });
  }
};

// @desc    Delete ticket
// @route   DELETE /api/tickets/:id
// @access  Private (admin/manager)
const deleteTicket = async (req, res) => {
  try {
    const existing = await ticketModel.findById(req.params.id, req.user.tenant_id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    await ticketModel.delete(req.params.id, req.user.tenant_id);
    res.json({ success: true, message: 'Ticket deleted successfully' });
  } catch (error) {
    logger.error('Error deleting ticket:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting ticket' });
  }
};

// @desc    Transition ticket status through lifecycle
// @route   PATCH /api/tickets/:id/status
// @access  Private
const transitionStatus = async (req, res) => {
  try {
    const { status, note, notes, scheduled_at, assigned_technician_id } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Target status is required' });
    }

    const ticket = await ticketService.transitionStatus(
      req.params.id,
      req.user.tenant_id,
      req.user.id,
      status,
      { note, notes, scheduled_at, assigned_technician_id }
    );

    res.json({
      success: true,
      message: `Ticket status updated to ${status}`,
      data: { ticket }
    });
  } catch (error) {
    logger.error('Error transitioning ticket status:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error transitioning ticket status'
    });
  }
};

// @desc    Assign technician and schedule ticket
// @route   POST /api/tickets/:id/schedule
// @access  Private
const scheduleTicket = async (req, res) => {
  try {
    const ticket = await ticketService.assignAndSchedule(
      req.params.id,
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    res.json({
      success: true,
      message: 'Ticket scheduled and technician assigned successfully',
      data: { ticket }
    });
  } catch (error) {
    logger.error('Error scheduling ticket:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error scheduling ticket'
    });
  }
};

// @desc    Request or record landlord approval
// @route   POST /api/tickets/:id/approval
// @access  Private
const handleApproval = async (req, res) => {
  try {
    const ticket = await ticketService.handleLandlordApproval(
      req.params.id,
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    res.json({
      success: true,
      message: `Landlord approval action '${req.body.action}' processed`,
      data: { ticket }
    });
  } catch (error) {
    logger.error('Error handling landlord approval:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error handling landlord approval'
    });
  }
};

// @desc    Record labour, parts, travel and pricing unit economics
// @route   POST /api/tickets/:id/costs
// @access  Private
const recordCosts = async (req, res) => {
  try {
    const ticket = await ticketService.recordCosts(
      req.params.id,
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    res.json({
      success: true,
      message: 'Ticket unit economics and costs recorded successfully',
      data: { ticket }
    });
  } catch (error) {
    logger.error('Error recording costs:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error recording costs'
    });
  }
};

// @desc    Upload / add attachment to ticket (before/after photos)
// @route   POST /api/tickets/:id/attachments
// @access  Private
const addAttachment = async (req, res) => {
  try {
    const ticket = await ticketModel.findById(req.params.id, req.user.tenant_id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const { filename, original_name, file_path, file_size, mime_type } = req.body;
    if (!file_path) {
      return res.status(400).json({ success: false, message: 'file_path is required' });
    }

    const name = filename || original_name || file_path.split('/').pop() || 'photo.jpg';
    const attachmentId = await ticketModel.addAttachment({
      tenant_id: req.user.tenant_id,
      ticket_id: ticket.id,
      customer_id: ticket.customer_id,
      filename: name,
      original_name: original_name || name,
      file_path,
      file_size: parseInt(file_size, 10) || 0,
      mime_type: mime_type || 'image/jpeg',
      uploaded_by: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Attachment added successfully',
      data: { attachmentId }
    });
  } catch (error) {
    logger.error('Error adding attachment:', error);
    res.status(500).json({ success: false, message: 'Server error adding attachment' });
  }
};

// @desc    Get ticket attachments
// @route   GET /api/tickets/:id/attachments
// @access  Private
const getAttachments = async (req, res) => {
  try {
    const ticket = await ticketModel.findById(req.params.id, req.user.tenant_id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const attachments = await ticketModel.getAttachments(req.params.id, req.user.tenant_id);
    res.json({ success: true, data: { attachments } });
  } catch (error) {
    logger.error('Error fetching ticket attachments:', error);
    res.status(500).json({ success: false, message: 'Server error fetching attachments' });
  }
};

// @desc    Get basic dashboard metrics (open emergencies, SLA breaches, monthly counts)
// @route   GET /api/tickets/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const stats = await ticketService.getDashboardStats(req.user.tenant_id);
    res.json({ success: true, data: { stats } });
  } catch (error) {
    logger.error('Error fetching ticket dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Server error fetching dashboard stats' });
  }
};

// @desc    Get Sawa Repairs Company Plan 90-day targets scorecard and unit economics
// @route   GET /api/tickets/dashboard/company-plan
// @access  Private
const getCompanyPlanMetrics = async (req, res) => {
  try {
    const metrics = await ticketService.getCompanyPlanMetrics(req.user.tenant_id);
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error fetching company plan metrics:', error);
    res.status(500).json({ success: false, message: 'Server error fetching company plan metrics' });
  }
};

// @desc    Get repeat customers qualified for Sawa Care conversion (>= 3 tickets in 90 days)
// @route   GET /api/tickets/sawa-care/eligible
// @access  Private
const getRepeatCustomers = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 90;
    const eligible = await ticketService.getRepeatCustomers(req.user.tenant_id, days);
    res.json({
      success: true,
      data: {
        qualified_customers: eligible,
        count: eligible.length,
        criteria: `Customers with >= 3 tickets within ${days} days without active contract`
      }
    });
  } catch (error) {
    logger.error('Error fetching Sawa Care eligible customers:', error);
    res.status(500).json({ success: false, message: 'Server error fetching eligible customers' });
  }
};

// @desc    List Sawa Care contracts
// @route   GET /api/tickets/sawa-care/contracts
// @access  Private
const getSawaCareContracts = async (req, res) => {
  try {
    const contracts = await ticketService.getSawaCareContracts(req.user.tenant_id, req.query);
    res.json({
      success: true,
      data: { contracts }
    });
  } catch (error) {
    logger.error('Error fetching Sawa Care contracts:', error);
    res.status(500).json({ success: false, message: 'Server error fetching Sawa Care contracts' });
  }
};

// @desc    Create Sawa Care contract
// @route   POST /api/tickets/sawa-care/contracts
// @access  Private
const createSawaCareContract = async (req, res) => {
  try {
    const contract = await ticketService.createSawaCareContract(
      req.user.tenant_id,
      req.user.id,
      req.body
    );
    res.status(201).json({
      success: true,
      message: 'Sawa Care contract created successfully',
      data: { contract }
    });
  } catch (error) {
    logger.error('Error creating Sawa Care contract:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error creating Sawa Care contract'
    });
  }
};

// @desc    Get single Sawa Care contract
// @route   GET /api/tickets/sawa-care/contracts/:id
// @access  Private
const getSawaCareContract = async (req, res) => {
  try {
    const contract = await ticketService.getSawaCareContractById(req.params.id, req.user.tenant_id);
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Sawa Care contract not found' });
    }
    res.json({ success: true, data: { contract } });
  } catch (error) {
    logger.error('Error fetching Sawa Care contract:', error);
    res.status(500).json({ success: false, message: 'Server error fetching Sawa Care contract' });
  }
};

// @desc    Update Sawa Care contract
// @route   PATCH /api/tickets/sawa-care/contracts/:id
// @access  Private
const updateSawaCareContract = async (req, res) => {
  try {
    const contract = await ticketService.updateSawaCareContract(
      req.params.id,
      req.user.tenant_id,
      req.user.id,
      req.body
    );
    res.json({
      success: true,
      message: 'Sawa Care contract updated successfully',
      data: { contract }
    });
  } catch (error) {
    logger.error('Error updating Sawa Care contract:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error updating Sawa Care contract'
    });
  }
};

// @desc    WhatsApp intake endpoint
// @route   POST /api/tickets/whatsapp-intake
// @access  Public / Token
const whatsAppIntake = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.body.tenant_id || req.tenantId || 1;
    const ticket = await ticketService.processWhatsAppIntake({
      ...req.body,
      tenant_id: tenantId
    });

    res.status(201).json({
      success: true,
      message: 'Ticket created from WhatsApp intake successfully',
      data: { ticket }
    });
  } catch (error) {
    logger.error('Error processing WhatsApp intake:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error processing WhatsApp intake'
    });
  }
};

// @desc    Get client experience metrics scorecard
// @route   GET /api/tickets/dashboard/client-experience-metrics
// @access  Private
const getClientExperienceMetrics = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const metrics = await ticketService.getClientExperienceMetrics(tenantId);
    res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error fetching client experience metrics:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error fetching client experience metrics'
    });
  }
};

module.exports = {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  transitionStatus,
  scheduleTicket,
  handleApproval,
  recordCosts,
  addAttachment,
  getAttachments,
  getDashboardStats,
  getCompanyPlanMetrics,
  getRepeatCustomers,
  getSawaCareContracts,
  createSawaCareContract,
  getSawaCareContract,
  updateSawaCareContract,
  whatsAppIntake,
  getClientExperienceMetrics
};
