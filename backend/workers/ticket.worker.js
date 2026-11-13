const { Worker } = require('bullmq');
const connection = require('../src/queue/connection');
const logger = require('../src/utils/logger');
const db = require('../src/config/database');

const processTicketJob = async (job) => {
  logger.info(`Processing ticket job ${job.id} (${job.name})`);
  const { type, tenantId, ticketId, ticketNumber, technicianId } = job.data;

  if (job.name === 'ticket_sla_reminder' || type === 'sla_reminder') {
    const rows = await db.query(
      `SELECT id, tenant_id, ticket_number, priority, status, created_at
       FROM tickets
       WHERE id = ? AND tenant_id = ?`,
      [ticketId, tenantId]
    );

    if (!rows || rows.length === 0) {
      return { status: 'skipped', reason: 'Ticket not found' };
    }

    const ticket = rows[0];
    if (ticket.status === 'reported') {
      logger.warn(`SLA BREACH ALERT: Ticket ${ticket.ticket_number} (priority: ${ticket.priority}) has remained in 'reported' status for > 3h!`);

      try {
        const userRows = await db.query(
          'SELECT id FROM users WHERE tenant_id = ? ORDER BY id ASC LIMIT 1',
          [tenantId]
        );
        const auditUserId = userRows[0]?.id || null;
        if (auditUserId) {
          await db.query(
            `INSERT INTO activity_log (tenant_id, user_id, action, entity_type, entity_id, new_values)
             VALUES (?, ?, 'SLA_BREACH_ALERT', 'ticket', ?, ?)`,
            [
              tenantId,
              auditUserId,
              ticketId,
              JSON.stringify({
                alert: 'Emergency ticket unacknowledged after 3h SLA window',
                ticketNumber: ticket.ticket_number,
                priority: ticket.priority,
                status: ticket.status
              })
            ]
          );
        }
      } catch (e) {
        logger.warn('Failed to write SLA alert to activity_log:', e.message);
      }

      return { status: 'breached', ticketNumber: ticket.ticket_number, currentStatus: ticket.status };
    } else {
      return { status: 'ok', currentStatus: ticket.status };
    }
  }

  if (job.name === 'ticket_approval_reminder' || type === 'approval_reminder') {
    const rows = await db.query(
      `SELECT id, tenant_id, ticket_number, landlord_approval_required, approved_at, total_cost_kes, status
       FROM tickets
       WHERE id = ? AND tenant_id = ?`,
      [ticketId, tenantId]
    );

    if (!rows || rows.length === 0) {
      return { status: 'skipped', reason: 'Ticket not found' };
    }

    const ticket = rows[0];
    if (ticket.landlord_approval_required && !ticket.approved_at && ticket.status !== 'closed') {
      logger.warn(`APPROVAL REMINDER: Landlord approval is still pending for ticket ${ticket.ticket_number} (Cost: KES ${ticket.total_cost_kes})`);

      try {
        const userRows = await db.query(
          'SELECT id FROM users WHERE tenant_id = ? ORDER BY id ASC LIMIT 1',
          [tenantId]
        );
        const auditUserId = userRows[0]?.id || null;
        if (auditUserId) {
          await db.query(
            `INSERT INTO activity_log (tenant_id, user_id, action, entity_type, entity_id, new_values)
             VALUES (?, ?, 'APPROVAL_REMINDER', 'ticket', ?, ?)`,
            [
              tenantId,
              auditUserId,
              ticketId,
              JSON.stringify({
                reminder: 'Landlord approval pending > 24 hours',
                ticketNumber: ticket.ticket_number,
                totalCost: ticket.total_cost_kes
              })
            ]
          );
        }
      } catch (e) {
        logger.warn('Failed to write approval reminder to activity_log:', e.message);
      }

      return { status: 'reminder_sent', ticketNumber: ticket.ticket_number };
    }

    return { status: 'already_approved_or_closed' };
  }

  if (job.name === 'technician_daily_digest' || type === 'technician_digest') {
    const openTickets = await db.query(
      `SELECT t.id, t.ticket_number, t.category, t.priority, t.status, t.scheduled_at, p.name AS property_name
       FROM tickets t
       LEFT JOIN properties p ON t.property_id = p.id AND p.tenant_id = t.tenant_id
       WHERE t.tenant_id = ?
         AND t.assigned_technician_id = ?
         AND t.status NOT IN ('resolved', 'verified', 'closed')
       ORDER BY CASE WHEN t.priority = 'emergency' THEN 1 WHEN t.priority = 'standard' THEN 2 ELSE 3 END, t.scheduled_at ASC`,
      [tenantId, technicianId]
    );

    logger.info(`Generated daily digest for technician ${technicianId} (${openTickets.length} open tickets)`);
    return {
      status: 'success',
      technicianId,
      openTicketsCount: openTickets.length,
      tickets: openTickets
    };
  }

  return { status: 'unrecognized_job_type' };
};

const setupTicketWorker = () => {
  const worker = new Worker('ticket', processTicketJob, {
    connection,
    concurrency: 5
  });

  worker.on('completed', (job, returnvalue) => {
    logger.info(`Ticket Job ${job.id} completed with status:`, returnvalue);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Ticket Job ${job?.id} failed with ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`Ticket Worker error: ${err.message}`);
  });

  return worker;
};

module.exports = { setupTicketWorker, processTicketJob };
