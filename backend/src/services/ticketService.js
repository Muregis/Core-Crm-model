const ticketModel = require('../models/ticketModel');
const propertyModel = require('../models/propertyModel');
const db = require('../config/database');
const logger = require('../utils/logger');
const {
  enqueueSlaReminder,
  enqueueApprovalReminder,
  enqueueTechnicianDigest
} = require('../jobs/producers/ticketProducer');

const ALLOWED_CATEGORIES = new Set([
  'plumbing',
  'electrical',
  'roofing',
  'painting',
  'general',
  'solar',
  'other'
]);

const ALLOWED_PRIORITIES = new Set(['emergency', 'standard', 'planned']);

const ALLOWED_STATUSES = new Set([
  'reported',
  'triaged',
  'scheduled',
  'in_progress',
  'awaiting_parts',
  'resolved',
  'verified',
  'closed',
  'reopened'
]);

const ALLOWED_TRANSITIONS = {
  reported: ['triaged', 'scheduled', 'closed'],
  triaged: ['scheduled', 'awaiting_parts', 'in_progress', 'closed'],
  scheduled: ['in_progress', 'triaged', 'closed'],
  in_progress: ['awaiting_parts', 'resolved', 'scheduled'],
  awaiting_parts: ['in_progress', 'scheduled', 'triaged'],
  resolved: ['verified', 'reopened', 'closed'],
  verified: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['triaged', 'scheduled', 'in_progress']
};

class TicketService {
  canTransition(currentStatus, targetStatus) {
    if (!currentStatus || !targetStatus) return false;
    if (currentStatus === targetStatus) return true;
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    return Array.isArray(allowed) && allowed.includes(targetStatus);
  }

  async createTicket(tenantId, userId, ticketData) {
    const {
      property_id,
      customer_id,
      reported_by,
      category = 'general',
      priority = 'standard',
      description,
      assigned_technician_id,
      scheduled_at,
      landlord_approval_required,
      approval_threshold_kes,
      notes,
      internal_notes,
      photo_urls
    } = ticketData;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      const err = new Error('Ticket description is required');
      err.statusCode = 400;
      throw err;
    }

    const normCategory = String(category).toLowerCase();
    if (!ALLOWED_CATEGORIES.has(normCategory)) {
      const err = new Error(`Invalid category. Allowed: ${Array.from(ALLOWED_CATEGORIES).join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const normPriority = String(priority).toLowerCase();
    if (!ALLOWED_PRIORITIES.has(normPriority)) {
      const err = new Error(`Invalid priority. Allowed: ${Array.from(ALLOWED_PRIORITIES).join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    // Verify property if provided
    let finalCustomerId = customer_id ? Number(customer_id) : null;
    if (property_id) {
      const prop = await propertyModel.findById(property_id, tenantId);
      if (!prop) {
        const err = new Error('Property not found for this tenant');
        err.statusCode = 404;
        throw err;
      }
      if (!finalCustomerId && prop.customer_id) {
        finalCustomerId = prop.customer_id;
      }
    }

    // Verify customer (landlord) if provided
    if (finalCustomerId) {
      const custRows = await db.query(
        'SELECT id FROM customers WHERE id = ? AND tenant_id = ?',
        [finalCustomerId, tenantId]
      );
      if (!custRows || custRows.length === 0) {
        const err = new Error('Landlord customer not found for this tenant');
        err.statusCode = 404;
        throw err;
      }
    }

    // Verify technician if provided
    let initialStatus = 'reported';
    if (assigned_technician_id) {
      const techRows = await db.query(
        'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
        [Number(assigned_technician_id), tenantId]
      );
      if (!techRows || techRows.length === 0) {
        const err = new Error('Technician user not found for this tenant');
        err.statusCode = 404;
        throw err;
      }
      if (scheduled_at) {
        initialStatus = 'scheduled';
      }
    }

    const ticket = await ticketModel.create({
      tenant_id: tenantId,
      property_id: property_id ? Number(property_id) : null,
      customer_id: finalCustomerId,
      reported_by: reported_by || null,
      category: normCategory,
      priority: normPriority,
      status: initialStatus,
      description: description.trim(),
      assigned_technician_id: assigned_technician_id ? Number(assigned_technician_id) : null,
      scheduled_at: scheduled_at || null,
      landlord_approval_required: landlord_approval_required ? 1 : 0,
      approval_threshold_kes: Number(approval_threshold_kes) || 0,
      notes: notes || null,
      internal_notes: internal_notes || null,
      created_by: userId
    });

    // If initial status is scheduled, create linked task
    if (initialStatus === 'scheduled' && ticket.assigned_technician_id) {
      await ticketModel.createOrUpdateLinkedTask({
        tenant_id: tenantId,
        ticket_id: ticket.id,
        title: `Field Service: ${ticket.ticket_number} - ${ticket.category}`,
        description: `Scheduled maintenance: ${ticket.description}`,
        customer_id: ticket.customer_id,
        assigned_to: ticket.assigned_technician_id,
        due_date: ticket.scheduled_at,
        priority: ticket.priority === 'emergency' ? 'high' : 'medium',
        created_by: userId
      });
    }

    // Add photo URLs if supplied
    if (Array.isArray(photo_urls) && photo_urls.length > 0) {
      for (const url of photo_urls) {
        if (typeof url === 'string' && url.trim().length > 0) {
          const filename = url.split('/').pop() || 'photo.jpg';
          await ticketModel.addAttachment({
            tenant_id: tenantId,
            ticket_id: ticket.id,
            customer_id: ticket.customer_id,
            filename,
            original_name: filename,
            file_path: url,
            mime_type: 'image/jpeg',
            uploaded_by: userId || 1
          });
        }
      }
    }

    // Enqueue SLA reminder if priority is emergency
    if (ticket.priority === 'emergency') {
      try {
        await enqueueSlaReminder({
          tenantId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          priority: ticket.priority,
          delayMs: 3 * 60 * 60 * 1000 // 3 hours
        });
      } catch (qErr) {
        logger.warn('Failed to enqueue SLA reminder:', qErr.message);
      }
    }

    // Activity Log
    try {
      await db.query(
        `INSERT INTO activity_log (tenant_id, user_id, action, entity_type, entity_id, new_values)
         VALUES (?, ?, 'CREATE_TICKET', 'ticket', ?, ?)`,
        [tenantId, userId, ticket.id, JSON.stringify({ ticket_number: ticket.ticket_number, category: ticket.category, priority: ticket.priority })]
      );
    } catch (e) {
      logger.warn('Activity log write failed:', e.message);
    }

    return ticketModel.findById(ticket.id, tenantId);
  }

  async transitionStatus(ticketId, tenantId, userId, targetStatus, options = {}) {
    const ticket = await ticketModel.findById(ticketId, tenantId);
    if (!ticket) {
      const err = new Error('Ticket not found');
      err.statusCode = 404;
      throw err;
    }

    const normTarget = String(targetStatus).toLowerCase();
    if (!ALLOWED_STATUSES.has(normTarget)) {
      const err = new Error(`Invalid status. Allowed: ${Array.from(ALLOWED_STATUSES).join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    if (!this.canTransition(ticket.status, normTarget)) {
      const allowed = ALLOWED_TRANSITIONS[ticket.status] || [];
      const err = new Error(
        `Invalid status transition from '${ticket.status}' to '${normTarget}'. Allowed transitions: ${allowed.join(', ') || 'none'}`
      );
      err.statusCode = 400;
      throw err;
    }

    const updates = { status: normTarget };
    const nowIso = new Date().toISOString();

    if (normTarget === 'scheduled') {
      if (options.scheduled_at) {
        updates.scheduled_at = options.scheduled_at;
      } else if (!ticket.scheduled_at) {
        updates.scheduled_at = nowIso;
      }
    } else if (normTarget === 'in_progress') {
      if (!ticket.started_at) {
        updates.started_at = nowIso;
      }
    } else if (normTarget === 'resolved') {
      updates.resolved_at = nowIso;
    } else if (normTarget === 'closed') {
      updates.closed_at = nowIso;
    } else if (normTarget === 'reopened') {
      updates.closed_at = null;
      updates.resolved_at = null;
    }

    if (options.notes) {
      updates.notes = options.notes;
    }

    const updated = await ticketModel.update(ticketId, tenantId, updates);

    // Record status history
    await ticketModel.recordStatusHistory({
      tenant_id: tenantId,
      ticket_id: ticketId,
      from_status: ticket.status,
      to_status: normTarget,
      changed_by: userId,
      note: options.note || options.notes || `Transitioned status to ${normTarget}`
    });

    // If transitioned to scheduled, ensure linked task exists
    if (normTarget === 'scheduled' && (updated.assigned_technician_id || options.assigned_technician_id)) {
      const assignedTech = options.assigned_technician_id || updated.assigned_technician_id;
      await ticketModel.createOrUpdateLinkedTask({
        tenant_id: tenantId,
        ticket_id: ticketId,
        title: `Field Service: ${updated.ticket_number} - ${updated.category}`,
        description: `Scheduled maintenance: ${updated.description}`,
        customer_id: updated.customer_id,
        assigned_to: assignedTech,
        due_date: updated.scheduled_at || updates.scheduled_at || nowIso,
        priority: updated.priority === 'emergency' ? 'high' : 'medium',
        created_by: userId
      });
    }

    // Activity Log
    try {
      await db.query(
        `INSERT INTO activity_log (tenant_id, user_id, action, entity_type, entity_id, old_values, new_values)
         VALUES (?, ?, 'TRANSITION_TICKET_STATUS', 'ticket', ?, ?, ?)`,
        [
          tenantId,
          userId,
          ticketId,
          JSON.stringify({ from_status: ticket.status }),
          JSON.stringify({ to_status: normTarget, note: options.note || null })
        ]
      );
    } catch (e) {
      logger.warn('Activity log write failed:', e.message);
    }

    return ticketModel.findById(ticketId, tenantId);
  }

  async assignAndSchedule(ticketId, tenantId, userId, scheduleData) {
    const { assigned_technician_id, scheduled_at, notes } = scheduleData;

    const ticket = await ticketModel.findById(ticketId, tenantId);
    if (!ticket) {
      const err = new Error('Ticket not found');
      err.statusCode = 404;
      throw err;
    }

    if (!assigned_technician_id) {
      const err = new Error('assigned_technician_id is required');
      err.statusCode = 400;
      throw err;
    }

    // Verify technician user exists in tenant
    const techRows = await db.query(
      'SELECT id, first_name, last_name, role FROM users WHERE id = ? AND tenant_id = ?',
      [Number(assigned_technician_id), tenantId]
    );
    if (!techRows || techRows.length === 0) {
      const err = new Error('Technician not found in this tenant organization');
      err.statusCode = 404;
      throw err;
    }

    const finalScheduledAt = scheduled_at || new Date().toISOString();
    const updates = {
      assigned_technician_id: Number(assigned_technician_id),
      scheduled_at: finalScheduledAt
    };

    if (notes) {
      updates.notes = notes;
    }

    // If status is reported or triaged, advance to scheduled
    let targetStatus = ticket.status;
    if (ticket.status === 'reported' || ticket.status === 'triaged') {
      targetStatus = 'scheduled';
      updates.status = 'scheduled';
    }

    await ticketModel.update(ticketId, tenantId, updates);

    // Record status history if status changed or assignment made
    await ticketModel.recordStatusHistory({
      tenant_id: tenantId,
      ticket_id: ticketId,
      from_status: ticket.status,
      to_status: targetStatus,
      changed_by: userId,
      note: `Assigned technician ${techRows[0].first_name} ${techRows[0].last_name} and scheduled for ${finalScheduledAt}`
    });

    // Create or update linked Task
    await ticketModel.createOrUpdateLinkedTask({
      tenant_id: tenantId,
      ticket_id: ticketId,
      title: `Field Service: ${ticket.ticket_number} - ${ticket.category}`,
      description: `Technician assigned: ${ticket.description}`,
      customer_id: ticket.customer_id,
      assigned_to: Number(assigned_technician_id),
      due_date: finalScheduledAt,
      priority: ticket.priority === 'emergency' ? 'high' : 'medium',
      created_by: userId
    });

    // Activity Log
    try {
      await db.query(
        `INSERT INTO activity_log (tenant_id, user_id, action, entity_type, entity_id, new_values)
         VALUES (?, ?, 'SCHEDULE_TICKET', 'ticket', ?, ?)`,
        [
          tenantId,
          userId,
          ticketId,
          JSON.stringify({
            assigned_technician_id,
            scheduled_at: finalScheduledAt,
            status: targetStatus
          })
        ]
      );
    } catch (e) {
      logger.warn('Activity log write failed:', e.message);
    }

    return ticketModel.findById(ticketId, tenantId);
  }

  async handleLandlordApproval(ticketId, tenantId, userId, approvalData) {
    const { action, approval_threshold_kes, notes } = approvalData;

    const ticket = await ticketModel.findById(ticketId, tenantId);
    if (!ticket) {
      const err = new Error('Ticket not found');
      err.statusCode = 404;
      throw err;
    }

    const normAction = String(action).toLowerCase();
    const updates = {};
    const nowIso = new Date().toISOString();

    if (normAction === 'request') {
      updates.landlord_approval_required = 1;
      if (approval_threshold_kes !== undefined) {
        updates.approval_threshold_kes = Number(approval_threshold_kes);
      }
      if (notes) {
        updates.internal_notes = ticket.internal_notes
          ? `${ticket.internal_notes}\n[Approval Request]: ${notes}`
          : `[Approval Request]: ${notes}`;
      }

      await ticketModel.update(ticketId, tenantId, updates);

      // Enqueue landlord approval reminder
      try {
        await enqueueApprovalReminder({
          tenantId,
          ticketId,
          ticketNumber: ticket.ticket_number,
          customerId: ticket.customer_id,
          delayMs: 24 * 60 * 60 * 1000 // 24 hours
        });
      } catch (err) {
        logger.warn('Failed to enqueue approval reminder:', err.message);
      }

      await ticketModel.recordStatusHistory({
        tenant_id: tenantId,
        ticket_id: ticketId,
        from_status: ticket.status,
        to_status: ticket.status,
        changed_by: userId,
        note: `Requested landlord approval. Threshold: KES ${updates.approval_threshold_kes || ticket.approval_threshold_kes}. ${notes || ''}`
      });
    } else if (normAction === 'approve' || normAction === 'record') {
      updates.approved_at = nowIso;
      updates.approved_by = userId;
      if (notes) {
        updates.notes = ticket.notes ? `${ticket.notes}\n[Approved]: ${notes}` : `[Approved]: ${notes}`;
      }

      await ticketModel.update(ticketId, tenantId, updates);

      await ticketModel.recordStatusHistory({
        tenant_id: tenantId,
        ticket_id: ticketId,
        from_status: ticket.status,
        to_status: ticket.status,
        changed_by: userId,
        note: `Landlord approval recorded by user ${userId}. ${notes || ''}`
      });
    } else if (normAction === 'reject') {
      updates.internal_notes = ticket.internal_notes
        ? `${ticket.internal_notes}\n[Approval Rejected]: ${notes || 'No reason provided'}`
        : `[Approval Rejected]: ${notes || 'No reason provided'}`;

      await ticketModel.update(ticketId, tenantId, updates);

      await ticketModel.recordStatusHistory({
        tenant_id: tenantId,
        ticket_id: ticketId,
        from_status: ticket.status,
        to_status: ticket.status,
        changed_by: userId,
        note: `Landlord approval rejected. Reason: ${notes || 'Not specified'}`
      });
    } else {
      const err = new Error("Invalid approval action. Allowed: 'request', 'approve', 'reject'");
      err.statusCode = 400;
      throw err;
    }

    // Activity Log
    try {
      await db.query(
        `INSERT INTO activity_log (tenant_id, user_id, action, entity_type, entity_id, new_values)
         VALUES (?, ?, 'LANDLORD_APPROVAL_ACTION', 'ticket', ?, ?)`,
        [tenantId, userId, ticketId, JSON.stringify({ action: normAction, notes })]
      );
    } catch (e) {
      logger.warn('Activity log write failed:', e.message);
    }

    return ticketModel.findById(ticketId, tenantId);
  }

  async recordCosts(ticketId, tenantId, userId, costData) {
    const { labour_hours, parts_cost_kes, hourly_rate_kes, total_cost_kes, notes } = costData;

    const ticket = await ticketModel.findById(ticketId, tenantId);
    if (!ticket) {
      const err = new Error('Ticket not found');
      err.statusCode = 404;
      throw err;
    }

    const finalLabourHours = labour_hours !== undefined ? Number(labour_hours) : ticket.labour_hours;
    const finalPartsCost = parts_cost_kes !== undefined ? Number(parts_cost_kes) : ticket.parts_cost_kes;

    let computedTotal;
    if (total_cost_kes !== undefined && total_cost_kes !== null) {
      computedTotal = Number(total_cost_kes);
    } else {
      const labourRate = hourly_rate_kes !== undefined ? Number(hourly_rate_kes) : 0;
      computedTotal = (finalLabourHours * labourRate) + finalPartsCost;
    }

    const updates = {
      labour_hours: finalLabourHours,
      parts_cost_kes: finalPartsCost,
      total_cost_kes: computedTotal
    };

    if (notes) {
      updates.notes = ticket.notes ? `${ticket.notes}\n[Cost Update]: ${notes}` : `[Cost Update]: ${notes}`;
    }

    // If total cost exceeds approval threshold and not yet approved, flag approval required
    if (ticket.approval_threshold_kes > 0 && computedTotal > ticket.approval_threshold_kes && !ticket.approved_at) {
      updates.landlord_approval_required = 1;
    }

    await ticketModel.update(ticketId, tenantId, updates);

    // Activity log
    try {
      await db.query(
        `INSERT INTO activity_log (tenant_id, user_id, action, entity_type, entity_id, new_values)
         VALUES (?, ?, 'UPDATE_TICKET_COSTS', 'ticket', ?, ?)`,
        [tenantId, userId, ticketId, JSON.stringify(updates)]
      );
    } catch (e) {
      logger.warn('Activity log write failed:', e.message);
    }

    return ticketModel.findById(ticketId, tenantId);
  }

  async processWhatsAppIntake(payload) {
    const {
      tenant_id = 1,
      propertyIdentifier,
      category = 'general',
      priority = 'standard',
      description,
      reportedBy,
      photoUrls = [],
      landlordPhone,
      unitNumber
    } = payload;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      const err = new Error('Description is required for WhatsApp intake');
      err.statusCode = 400;
      throw err;
    }

    const tenantId = Number(tenant_id) || 1;

    // Find a valid user for tenant (for uploaded_by and activity log)
    const userRows = await db.query(
      'SELECT id FROM users WHERE tenant_id = ? ORDER BY id ASC LIMIT 1',
      [tenantId]
    );
    const tenantUserId = userRows[0]?.id || null;

    // 1. Resolve Property
    let property = null;
    if (propertyIdentifier) {
      property = await propertyModel.findByNameOrAddress(propertyIdentifier, tenantId);
    }

    let customerId = property ? property.customer_id : null;

    // 2. Resolve landlord customer by phone if not found
    if (!customerId && landlordPhone) {
      const custRows = await db.query(
        `SELECT id FROM customers WHERE tenant_id = ? AND (phone = ? OR phone LIKE ?) LIMIT 1`,
        [tenantId, landlordPhone, `%${landlordPhone.slice(-9)}`]
      );
      if (custRows && custRows.length > 0) {
        customerId = custRows[0].id;
      }
    }

    // If property wasn't found but propertyIdentifier given, auto-create property record
    if (!property && propertyIdentifier) {
      property = await propertyModel.create({
        tenant_id: tenantId,
        customer_id: customerId,
        name: propertyIdentifier,
        address: unitNumber ? `Unit ${unitNumber}, ${propertyIdentifier}` : propertyIdentifier,
        unit_count: 1,
        notes: `Auto-created from WhatsApp intake for ${reportedBy || 'tenant'}`
      });
    }

    const normCategory = ALLOWED_CATEGORIES.has(String(category).toLowerCase())
      ? String(category).toLowerCase()
      : 'general';
    const normPriority = ALLOWED_PRIORITIES.has(String(priority).toLowerCase())
      ? String(priority).toLowerCase()
      : 'standard';

    const ticket = await ticketModel.create({
      tenant_id: tenantId,
      property_id: property ? property.id : null,
      customer_id: customerId || (property ? property.customer_id : null),
      reported_by: reportedBy || null,
      category: normCategory,
      priority: normPriority,
      status: 'reported',
      description: description.trim(),
      notes: unitNumber ? `Unit/House: ${unitNumber}` : null,
      created_by: null
    });

    // 3. Attach photos
    if (Array.isArray(photoUrls) && photoUrls.length > 0) {
      for (const url of photoUrls) {
        if (typeof url === 'string' && url.trim().length > 0) {
          const filename = url.split('/').pop() || 'whatsapp_image.jpg';
          await ticketModel.addAttachment({
            tenant_id: tenantId,
            ticket_id: ticket.id,
            customer_id: ticket.customer_id,
            filename,
            original_name: filename,
            file_path: url,
            mime_type: 'image/jpeg',
            uploaded_by: tenantUserId || 1
          });
        }
      }
    }

    // 4. Emergency SLA reminder
    if (ticket.priority === 'emergency') {
      try {
        await enqueueSlaReminder({
          tenantId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          priority: ticket.priority,
          delayMs: 3 * 60 * 60 * 1000
        });
      } catch (err) {
        logger.warn('Failed to enqueue WhatsApp emergency SLA reminder:', err.message);
      }
    }

    // Activity log
    if (tenantUserId) {
      try {
        await db.query(
          `INSERT INTO activity_log (tenant_id, user_id, action, entity_type, entity_id, new_values)
           VALUES (?, ?, 'WHATSAPP_TICKET_INTAKE', 'ticket', ?, ?)`,
          [tenantId, tenantUserId, ticket.id, JSON.stringify({ ticket_number: ticket.ticket_number, reported_by: reportedBy })]
        );
      } catch (e) {
        logger.warn('Activity log write failed:', e.message);
      }
    }

    return ticketModel.findById(ticket.id, tenantId);
  }

  async getDashboardStats(tenantId) {
    return ticketModel.getDashboardStats(tenantId);
  }
}

module.exports = new TicketService();
