const crypto = require('crypto');
const ticketModel = require('../models/ticketModel');
const propertyModel = require('../models/propertyModel');
const db = require('../config/database');
const logger = require('../utils/logger');
const {
  enqueueSlaReminder,
  enqueueApprovalReminder,
  enqueueTechnicianDigest
} = require('../jobs/producers/ticketProducer');

const EMERGENCY_SLA_HOURS = parseInt(process.env.EMERGENCY_SLA_HOURS || '6', 10);

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

  calculateSlaDeadline(priority, fromDate = new Date()) {
    const base = new Date(fromDate);
    if (priority === 'emergency') {
      // Configurable interim SLA (default 6h; target 2–6h window for Nairobi logistics)
      return new Date(base.getTime() + EMERGENCY_SLA_HOURS * 60 * 60 * 1000).toISOString();
    } else if (priority === 'planned') {
      // 96 hours (4 working days: 3–5 working days)
      return new Date(base.getTime() + 96 * 60 * 60 * 1000).toISOString();
    } else {
      // Standard: 36 hours (24–48 hours)
      return new Date(base.getTime() + 36 * 60 * 60 * 1000).toISOString();
    }
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
      callout_fee_kes,
      emergency_premium_kes,
      is_warranty_claim = 0,
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

    // Compute SLA response deadline
    const slaDueAt = this.calculateSlaDeadline(normPriority);

    // Default callout fee (v2.1 §4.3: KSh 1,500–2,500)
    let finalCalloutFee = callout_fee_kes !== undefined ? Number(callout_fee_kes) : 2000;
    let finalEmergencyPremium = emergency_premium_kes !== undefined
      ? Number(emergency_premium_kes)
      : (normPriority === 'emergency' ? 1000 : 0);

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
      callout_fee_kes: finalCalloutFee,
      emergency_premium_kes: finalEmergencyPremium,
      sla_response_due_at: slaDueAt,
      is_warranty_claim: is_warranty_claim ? 1 : 0,
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
          delayMs: EMERGENCY_SLA_HOURS * 60 * 60 * 1000
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

    // Check SLA response timing when acknowledged from reported
    if (ticket.status === 'reported' && ['triaged', 'scheduled', 'in_progress'].includes(normTarget)) {
      if (!ticket.responded_at) {
        updates.responded_at = nowIso;
        if (ticket.sla_response_due_at && nowIso > ticket.sla_response_due_at) {
          updates.is_sla_breached = 1;
        }
      }
    }

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
      // 30-day workmanship warranty (v2.1 §4.2)
      if (!ticket.warranty_until) {
        const warrantyDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        updates.warranty_until = warrantyDate;
      }
    } else if (normTarget === 'closed') {
      // Hard Operational Gate: Enforce Unit Economics Data Discipline
      // Co-director mandate: No ticket moves to closed unless labour hours, parts cost, travel cost, and invoice are recorded.
      const hasLabour = Number(ticket.labour_hours) > 0 || Number(ticket.labour_billed_kes) > 0;
      const hasInvoice = Number(ticket.total_cost_kes) > 0 || Number(ticket.invoice_amount_kes) > 0;
      const hasTravel = ticket.travel_cost_kes !== null && ticket.travel_cost_kes !== undefined && Number(ticket.travel_cost_kes) >= 0;

      if (!options.bypassCostCheck && (!hasLabour || !hasInvoice || !hasTravel)) {
        const missingFields = [];
        if (!hasLabour) missingFields.push('labour_hours');
        if (!hasInvoice) missingFields.push('invoice_amount_kes / total_cost_kes');
        if (!hasTravel) missingFields.push('travel_cost_kes');

        const err = new Error(
          `Cannot close ticket ${ticket.ticket_number}: Mandatory unit economics data is incomplete (${missingFields.join(', ')}). ` +
          'The ops coordinator must record labour hours, parts cost, travel cost, and invoice amount before closing.'
        );
        err.statusCode = 400;
        throw err;
      }

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
      if (!ticket.responded_at) {
        updates.responded_at = new Date().toISOString();
        if (ticket.sla_response_due_at && updates.responded_at > ticket.sla_response_due_at) {
          updates.is_sla_breached = 1;
        }
      }
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
      if (!ticket.approval_token) {
        updates.approval_token = 'appr_' + crypto.randomBytes(32).toString('hex');
      }
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
      // If customer approves repair, call-out fee is waived! (Product Document v2.1 §4.3)
      updates.callout_fee_waived = 1;

      // Recalculate invoice amount and margin if costs exist
      const labourBilled = Number(ticket.labour_billed_kes || 0);
      const partsBilled = Number(ticket.parts_billed_kes || 0);
      const premium = Number(ticket.emergency_premium_kes || 0);
      const newInvoice = premium + labourBilled + partsBilled;
      const cogs = Number(ticket.labour_cost_kes || 0) + Number(ticket.parts_cost_kes || 0) + Number(ticket.travel_cost_kes || 0);
      const margin = newInvoice - cogs;

      updates.invoice_amount_kes = newInvoice;
      updates.gross_margin_kes = margin;
      updates.margin_percentage = newInvoice > 0 ? Number(((margin / newInvoice) * 100).toFixed(1)) : 0;

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
        note: `Landlord approval recorded by user ${userId}. Callout fee waived per v2.1 pricing policy. ${notes || ''}`
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
      const err = new Error("Invalid approval action. Allowed: 'request', 'approve', 'record', 'reject'");
      err.statusCode = 400;
      throw err;
    }

    // Activity Log
    try {
      let logUserId = userId;
      if (!logUserId) {
        const uRows = await db.query('SELECT id FROM users WHERE tenant_id = ? ORDER BY id ASC LIMIT 1', [tenantId]);
        logUserId = uRows[0]?.id || 1;
      }
      await db.query(
        `INSERT INTO activity_log (tenant_id, user_id, action, entity_type, entity_id, new_values)
         VALUES (?, ?, 'LANDLORD_APPROVAL_ACTION', 'ticket', ?, ?)`,
        [tenantId, logUserId, ticketId, JSON.stringify({ action: normAction, notes })]
      );
    } catch (e) {
      logger.warn('Activity log write failed:', e.message);
    }

    return ticketModel.findById(ticketId, tenantId);
  }

  async recordCosts(ticketId, tenantId, userId, costData) {
    const {
      labour_hours,
      hourly_rate_kes,
      labour_cost_kes,
      labour_billed_kes,
      parts_cost_kes,
      parts_markup_percentage,
      parts_billed_kes,
      callout_fee_kes,
      callout_fee_waived,
      emergency_premium_kes,
      travel_cost_kes,
      total_cost_kes,
      invoice_amount_kes,
      notes
    } = costData;

    const ticket = await ticketModel.findById(ticketId, tenantId);
    if (!ticket) {
      const err = new Error('Ticket not found');
      err.statusCode = 404;
      throw err;
    }

    // 1. Labour calculations
    const finalLabourHours = labour_hours !== undefined ? Number(labour_hours) : Number(ticket.labour_hours || 0);
    const labourRate = hourly_rate_kes !== undefined ? Number(hourly_rate_kes) : 0;
    const finalLabourCost = labour_cost_kes !== undefined ? Number(labour_cost_kes) : Number(ticket.labour_cost_kes || 0);
    let finalLabourBilled = labour_billed_kes !== undefined
      ? Number(labour_billed_kes)
      : (labourRate > 0 ? finalLabourHours * labourRate : Number(ticket.labour_billed_kes || 0));

    // 2. Parts calculations (wholesale cost + 15–25% margin markup per v2.1 §4.3)
    const finalPartsCost = parts_cost_kes !== undefined ? Number(parts_cost_kes) : Number(ticket.parts_cost_kes || 0);
    const finalPartsMarkup = parts_markup_percentage !== undefined
      ? Number(parts_markup_percentage)
      : Number(ticket.parts_markup_percentage || 20);
    const finalPartsBilled = parts_billed_kes !== undefined
      ? Number(parts_billed_kes)
      : (finalPartsCost > 0 ? finalPartsCost * (1 + finalPartsMarkup / 100) : 0);

    // 3. Callout & Travel
    const finalCalloutFee = callout_fee_kes !== undefined ? Number(callout_fee_kes) : Number(ticket.callout_fee_kes || 0);
    const isCalloutWaived = callout_fee_waived !== undefined ? Boolean(callout_fee_waived) : Boolean(ticket.callout_fee_waived);
    const effectiveCallout = isCalloutWaived ? 0 : finalCalloutFee;

    const finalEmergencyPremium = emergency_premium_kes !== undefined
      ? Number(emergency_premium_kes)
      : Number(ticket.emergency_premium_kes || 0);
    const finalTravelCost = travel_cost_kes !== undefined ? Number(travel_cost_kes) : Number(ticket.travel_cost_kes || 0);

    // 4. Invoiced Amount (Gross Revenue)
    let finalInvoiceAmount;
    if (invoice_amount_kes !== undefined && invoice_amount_kes !== null) {
      finalInvoiceAmount = Number(invoice_amount_kes);
    } else {
      finalInvoiceAmount = effectiveCallout + finalEmergencyPremium + finalLabourBilled + finalPartsBilled;
    }

    // 5. Total Cost (backward compatible with labour_hours * hourly_rate + parts_cost if total_cost_kes not given)
    let computedTotalCost;
    if (total_cost_kes !== undefined && total_cost_kes !== null) {
      computedTotalCost = Number(total_cost_kes);
    } else if (labourRate > 0 || finalPartsCost > 0) {
      computedTotalCost = (finalLabourHours * labourRate) + finalPartsCost;
    } else {
      computedTotalCost = finalLabourCost + finalPartsCost + finalTravelCost;
    }

    // 6. Direct COGS and Gross Margin
    const directCogs = finalLabourCost + finalPartsCost + finalTravelCost;
    const grossMargin = finalInvoiceAmount > 0 && directCogs > 0 ? finalInvoiceAmount - directCogs : (finalInvoiceAmount - computedTotalCost);
    const marginPercentage = finalInvoiceAmount > 0
      ? Number(((grossMargin / finalInvoiceAmount) * 100).toFixed(1))
      : 0;

    const updates = {
      labour_hours: finalLabourHours,
      labour_cost_kes: finalLabourCost,
      labour_billed_kes: finalLabourBilled,
      parts_cost_kes: finalPartsCost,
      parts_markup_percentage: finalPartsMarkup,
      parts_billed_kes: finalPartsBilled,
      callout_fee_kes: finalCalloutFee,
      callout_fee_waived: isCalloutWaived ? 1 : 0,
      emergency_premium_kes: finalEmergencyPremium,
      travel_cost_kes: finalTravelCost,
      total_cost_kes: computedTotalCost,
      invoice_amount_kes: finalInvoiceAmount,
      gross_margin_kes: grossMargin,
      margin_percentage: marginPercentage
    };

    if (notes) {
      updates.notes = ticket.notes ? `${ticket.notes}\n[Cost Update]: ${notes}` : `[Cost Update]: ${notes}`;
    }

    // If total invoice exceeds approval threshold and not yet approved, flag approval required
    if (ticket.approval_threshold_kes > 0 && finalInvoiceAmount > ticket.approval_threshold_kes && !ticket.approved_at) {
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

    // Property auto-provisioning with security guardrails and verification tagging
    let pendingVerificationNote = null;
    if (!property && propertyIdentifier) {
      property = await propertyModel.create({
        tenant_id: tenantId,
        customer_id: customerId,
        name: propertyIdentifier,
        address: unitNumber ? `Unit ${unitNumber}, ${propertyIdentifier}` : propertyIdentifier,
        unit_count: 1,
        notes: customerId
          ? `Auto-created from WhatsApp intake for ${reportedBy || 'tenant'}`
          : `Auto-provisioned from WhatsApp intake for ${reportedBy || 'tenant'}. Pending landlord verification.`
      });
      if (!customerId) {
        pendingVerificationNote = `[Pending Landlord Verification: "${propertyIdentifier}"]`;
      }
    }

    const normCategory = ALLOWED_CATEGORIES.has(String(category).toLowerCase())
      ? String(category).toLowerCase()
      : 'general';
    const normPriority = ALLOWED_PRIORITIES.has(String(priority).toLowerCase())
      ? String(priority).toLowerCase()
      : 'standard';

    const slaDueAt = this.calculateSlaDeadline(normPriority);

    const ticket = await ticketModel.create({
      tenant_id: tenantId,
      property_id: property ? property.id : null,
      customer_id: customerId || (property ? property.customer_id : null),
      reported_by: reportedBy || null,
      category: normCategory,
      priority: normPriority,
      status: 'reported',
      description: description.trim(),
      callout_fee_kes: 2000,
      emergency_premium_kes: normPriority === 'emergency' ? 1000 : 0,
      sla_response_due_at: slaDueAt,
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
          delayMs: EMERGENCY_SLA_HOURS * 60 * 60 * 1000
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

    const savedTicket = await ticketModel.findById(ticket.id, tenantId);
    const trackingUrl = `https://sawarepairs.co.ke/track/${savedTicket.tracking_token}`;
    return {
      ...savedTicket,
      tracking_url: trackingUrl,
      whatsapp_confirmation: `Habari ${reportedBy || 'valued customer'}, your repair ticket #${savedTicket.ticket_number} has been logged. Priority: ${savedTicket.priority.toUpperCase()}. Our vetted specialist has been notified. Track live progress here: ${trackingUrl}`
    };
  }

  async getDashboardStats(tenantId) {
    return ticketModel.getDashboardStats(tenantId);
  }

  async getCompanyPlanMetrics(tenantId) {
    return ticketModel.getCompanyPlanMetrics(tenantId);
  }

  async getRepeatCustomers(tenantId, days = 90) {
    return ticketModel.getRepeatCustomers(tenantId, days);
  }

  async createSawaCareContract(tenantId, userId, contractData) {
    const { customer_id, tier = 'home', status = 'prospect' } = contractData;

    if (!customer_id) {
      const err = new Error('customer_id is required for Sawa Care contract');
      err.statusCode = 400;
      throw err;
    }

    const cust = await db.query(
      `SELECT id FROM customers WHERE id = ? AND tenant_id = ?`,
      [Number(customer_id), tenantId]
    );
    if (!cust || cust.length === 0) {
      const err = new Error('Customer not found for this tenant');
      err.statusCode = 404;
      throw err;
    }

    const contract = await ticketModel.createSawaCareContract({
      ...contractData,
      tenant_id: tenantId,
      created_by: userId
    });

    try {
      await db.query(
        `INSERT INTO activity_log (tenant_id, user_id, action, entity_type, entity_id, new_values)
         VALUES (?, ?, 'CREATE_SAWA_CARE_CONTRACT', 'sawa_care_contract', ?, ?)`,
        [tenantId, userId, contract.id, JSON.stringify({ customer_id, tier, status })]
      );
    } catch (e) {
      logger.warn('Activity log write failed:', e.message);
    }

    return contract;
  }

  async getSawaCareContracts(tenantId, filters = {}) {
    return ticketModel.getSawaCareContracts(tenantId, filters);
  }

  async getSawaCareContractById(id, tenantId) {
    return ticketModel.getSawaCareContractById(id, tenantId);
  }

  async updateSawaCareContract(id, tenantId, userId, data) {
    const updated = await ticketModel.updateSawaCareContract(id, tenantId, data);
    if (!updated) {
      const err = new Error('Sawa Care contract not found');
      err.statusCode = 404;
      throw err;
    }
    return updated;
  }

  async getMaintenanceMemory(propertyId, tenantId) {
    const memory = await propertyModel.getMaintenanceMemory(propertyId, tenantId);
    if (!memory) {
      const err = new Error('Property not found');
      err.statusCode = 404;
      throw err;
    }
    return memory;
  }

  async getLandlordMonthlyReport(customerId, tenantId, monthYear = null) {
    const report = await propertyModel.getLandlordMonthlyReport(customerId, tenantId, monthYear);
    if (!report) {
      const err = new Error('Landlord customer not found');
      err.statusCode = 404;
      throw err;
    }
    return report;
  }
  async findByTrackingToken(token) {
    const ticket = await ticketModel.findByTrackingToken(token);
    if (!ticket) {
      const err = new Error('Tracking token not found or invalid');
      err.statusCode = 404;
      throw err;
    }
    return ticket;
  }

  async findByApprovalToken(token) {
    const approvalView = await ticketModel.findByApprovalToken(token);
    if (!approvalView) {
      const err = new Error('Approval token not found or invalid');
      err.statusCode = 404;
      throw err;
    }
    return approvalView;
  }

  async processPublicApproval(token, action, notes) {
    const ticketView = await ticketModel.findByApprovalToken(token);
    if (!ticketView) {
      const err = new Error('Approval token not found or invalid');
      err.statusCode = 404;
      throw err;
    }

    const normAction = String(action).toLowerCase();
    if (normAction !== 'approve' && normAction !== 'reject') {
      const err = new Error("Invalid action. Must be 'approve' or 'reject'");
      err.statusCode = 400;
      throw err;
    }

    const updated = await this.handleLandlordApproval(
      ticketView.ticket_id,
      ticketView.tenant_id,
      null,
      { action: normAction, notes }
    );

    return {
      success: true,
      action: normAction,
      message: normAction === 'approve'
        ? 'Quote approved. Call-out fee waived and repair scheduled.'
        : 'Quote rejected. Our team has been notified.',
      ticket: updated
    };
  }

  async processPublicPayment(token, phoneNumber, paymentAmount = null) {
    let ticket = await ticketModel.findByTrackingToken(token);
    if (!ticket) {
      const appr = await ticketModel.findByApprovalToken(token);
      if (appr) {
        ticket = await ticketModel.findById(appr.ticket_id, appr.tenant_id);
      }
    }
    if (!ticket) {
      const err = new Error('Invalid tracking or approval token');
      err.statusCode = 404;
      throw err;
    }

    if (!phoneNumber) {
      const err = new Error('Valid M-Pesa phone number is required');
      err.statusCode = 400;
      throw err;
    }

    let cleanPhone = String(phoneNumber).replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '254' + cleanPhone.slice(1);
    else if (cleanPhone.startsWith('7') || cleanPhone.startsWith('1')) cleanPhone = '254' + cleanPhone;
    if (!cleanPhone.startsWith('254') || cleanPhone.length !== 12) {
      const err = new Error('Phone number must be a valid 12-digit Kenyan number (+254XXXXXXXXX)');
      err.statusCode = 400;
      throw err;
    }

    const totalDue = Number(ticket.invoice_amount_kes || ticket.total_cost_kes || ticket.callout_fee_kes || 2000);
    const amount = paymentAmount ? parseFloat(paymentAmount) : totalDue;
    const receiptNo = 'SK' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

    // Insert M-Pesa transaction
    await db.query(
      `INSERT INTO mpesa_transactions (
        tenant_id, transaction_type, mpesa_receipt_number, receipt_number, amount,
        phone_number, customer_id, status, transaction_time
      ) VALUES (?, 'STK_PUSH', ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)`,
      [
        ticket.tenant_id,
        receiptNo,
        receiptNo,
        amount,
        `+${cleanPhone}`,
        ticket.customer_id || null
      ]
    );

    // Update ticket notes and waive callout fee on successful payment
    const paymentNote = `[M-Pesa Payment Received]: KES ${amount.toLocaleString()} received via STK Push from +${cleanPhone}. Receipt #${receiptNo}.`;
    await ticketModel.update(ticket.id, ticket.tenant_id, {
      notes: ticket.notes ? `${ticket.notes}\n${paymentNote}` : paymentNote,
      callout_fee_waived: 1
    });

    await ticketModel.recordStatusHistory({
      tenant_id: ticket.tenant_id,
      ticket_id: ticket.id,
      from_status: ticket.status,
      to_status: ticket.status,
      changed_by: null,
      note: paymentNote
    });

    logger.info(`Recorded public M-Pesa payment ${receiptNo} of KES ${amount} for ticket ${ticket.ticket_number}`);

    return {
      success: true,
      message: `M-Pesa payment of KES ${amount.toLocaleString()} received successfully.`,
      receiptNumber: receiptNo,
      amount,
      phoneNumber: `+${cleanPhone}`,
      ticketNumber: ticket.ticket_number
    };
  }

  async processTenantSignoff(trackingToken, signerName, comments = '') {
    const ticket = await ticketModel.findByTrackingToken(trackingToken);
    if (!ticket) {
      const err = new Error('Invalid tracking token');
      err.statusCode = 404;
      throw err;
    }

    if (!signerName || signerName.trim().length === 0) {
      const err = new Error('Signer name is required for completion sign-off');
      err.statusCode = 400;
      throw err;
    }

    const note = `Client sign-off recorded by ${signerName.trim()}.${comments ? ' Feedback: ' + comments : ''}`;
    const nextStatus = ticket.status === 'resolved' ? 'verified' : ticket.status;

    await ticketModel.update(ticket.id, ticket.tenant_id, {
      status: nextStatus,
      internal_notes: ticket.internal_notes ? `${ticket.internal_notes}\n[Sign-Off]: ${note}` : `[Sign-Off]: ${note}`
    });

    await ticketModel.recordStatusHistory({
      tenant_id: ticket.tenant_id,
      ticket_id: ticket.id,
      from_status: ticket.status,
      to_status: nextStatus,
      changed_by: null,
      note
    });

    return {
      success: true,
      message: 'Sign-off recorded successfully. Thank you for choosing Sawa Repairs!',
      ticketNumber: ticket.ticket_number,
      status: nextStatus
    };
  }

  async getMeasuredSlaPerformance(tenantId) {
    return ticketModel.getMeasuredSlaPerformance(tenantId);
  }

  async findByPassportToken(token) {
    const passport = await propertyModel.findByPassportToken(token);
    if (!passport) {
      const err = new Error('Property Maintenance Passport not found or invalid token');
      err.statusCode = 404;
      throw err;
    }
    return passport;
  }

  async getLandlordMonthlyReportByPassportToken(token, monthYear = null) {
    const report = await propertyModel.getLandlordMonthlyReportByPassportToken(token, monthYear);
    if (!report) {
      const err = new Error('Landlord monthly report not found for this passport token');
      err.statusCode = 404;
      throw err;
    }
    return report;
  }

  async getClientExperienceMetrics(tenantId) {
    return ticketModel.getClientExperienceMetrics(tenantId);
  }

  async schedulePreventiveInspection(propertyId, tenantId, userId, data) {
    return propertyModel.schedulePreventiveInspection({
      ...data,
      property_id: propertyId,
      tenant_id: tenantId,
      inspector_user_id: userId
    });
  }

  async getPreventiveInspections(tenantId, filters = {}) {
    return propertyModel.getPreventiveInspections(tenantId, filters);
  }

  async completePreventiveInspection(inspectionId, tenantId, userId, data) {
    const completed = await propertyModel.completePreventiveInspection(inspectionId, tenantId, data);
    if (!completed) {
      const err = new Error('Preventive inspection not found');
      err.statusCode = 404;
      throw err;
    }
    return completed;
  }
}

module.exports = new TicketService();
