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

// @desc    Update ticket
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

// @desc    Transition ticket status (with state machine validation)
// @route   PATCH /api/tickets/:id/status
// @access  Private
const transitionStatus = async (req, res) => {
  try {
    const targetStatus = req.body.status || req.body.target_status;
    if (!targetStatus) {
      return res.status(400).json({ success: false, message: 'Target status is required' });
    }

    const updated = await ticketService.transitionStatus(
      req.params.id,
      req.user.tenant_id,
      req.user.id,
      targetStatus,
      {
        note: req.body.note || req.body.notes,
        scheduled_at: req.body.scheduled_at,
        assigned_technician_id: req.body.assigned_technician_id
      }
    );

    res.json({
      success: true,
      message: `Ticket status transitioned to ${targetStatus}`,
      data: { ticket: updated }
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

// @desc    Assign technician and schedule service
// @route   POST /api/tickets/:id/schedule
// @access  Private
const scheduleTicket = async (req, res) => {
  try {
    const { assigned_technician_id, scheduled_at, notes } = req.body;
    if (!assigned_technician_id) {
      return res.status(400).json({ success: false, message: 'assigned_technician_id is required' });
    }

    const updated = await ticketService.assignAndSchedule(
      req.params.id,
      req.user.tenant_id,
      req.user.id,
      { assigned_technician_id, scheduled_at, notes }
    );

    res.json({
      success: true,
      message: 'Technician assigned and service scheduled successfully',
      data: { ticket: updated }
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
    const { action, approval_threshold_kes, notes } = req.body;
    if (!action) {
      return res.status(400).json({ success: false, message: "Action is required ('request', 'approve', or 'reject')" });
    }

    const updated = await ticketService.handleLandlordApproval(
      req.params.id,
      req.user.tenant_id,
      req.user.id,
      { action, approval_threshold_kes, notes }
    );

    res.json({
      success: true,
      message: `Landlord approval action '${action}' recorded successfully`,
      data: { ticket: updated }
    });
  } catch (error) {
    logger.error('Error handling landlord approval:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error handling approval'
    });
  }
};

// @desc    Record labour, parts, and total costs
// @route   POST /api/tickets/:id/costs
// @access  Private
const recordCosts = async (req, res) => {
  try {
    const updated = await ticketService.recordCosts(
      req.params.id,
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    res.json({
      success: true,
      message: 'Ticket costs updated successfully',
      data: { ticket: updated }
    });
  } catch (error) {
    logger.error('Error recording ticket costs:', error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Server error recording costs'
    });
  }
};

// @desc    Add photo or document attachment to ticket
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

    const name = filename || original_name || file_path.split('/').pop() || 'attachment';
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

// @desc    Get dashboard metrics (open emergencies, SLA breaches, monthly counts)
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
  whatsAppIntake
};
