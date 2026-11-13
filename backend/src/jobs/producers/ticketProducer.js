const { ticketQueue } = require('../../queue/queues');
const db = require('../../config/database');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Enqueue SLA reminder job for a ticket.
 * Typically 3 hours for emergency tickets.
 */
async function enqueueSlaReminder({ tenantId, ticketId, ticketNumber, priority, delayMs = 3 * 60 * 60 * 1000 }) {
  const tId = Number(tenantId);
  const tkId = Number(ticketId);

  if (!tId || !tkId) {
    throw new Error('Valid tenantId and ticketId are required to enqueue SLA reminder');
  }

  const jobId = `sla-reminder-${tId}-${tkId}-${Date.now()}`;
  const payload = {
    type: 'sla_reminder',
    tenantId: tId,
    ticketId: tkId,
    ticketNumber,
    priority
  };

  try {
    await db.query(
      `INSERT INTO jobs (job_id, tenant_id, type, status, payload, created_at, updated_at)
       VALUES (?, ?, 'ticket_sla', 'waiting', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [jobId, tId, JSON.stringify(payload)]
    );
  } catch (err) {
    logger.warn('Could not insert SLA job into jobs table:', err.message);
  }

  try {
    const job = await ticketQueue.add('ticket_sla_reminder', payload, {
      jobId,
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: true,
      removeOnFail: false
    });
    logger.info(`Enqueued SLA reminder job ${job.id} for ticket ${ticketNumber} (delay: ${delayMs}ms)`);
    return job;
  } catch (error) {
    logger.warn(`Failed to enqueue SLA reminder job to BullMQ: ${error.message}`);
    return { id: jobId, data: payload, name: 'ticket_sla_reminder' };
  }
}

/**
 * Enqueue landlord approval reminder job.
 */
async function enqueueApprovalReminder({ tenantId, ticketId, ticketNumber, customerId, delayMs = 24 * 60 * 60 * 1000 }) {
  const tId = Number(tenantId);
  const tkId = Number(ticketId);

  if (!tId || !tkId) {
    throw new Error('Valid tenantId and ticketId are required to enqueue approval reminder');
  }

  const jobId = `approval-reminder-${tId}-${tkId}-${Date.now()}`;
  const payload = {
    type: 'approval_reminder',
    tenantId: tId,
    ticketId: tkId,
    ticketNumber,
    customerId: customerId ? Number(customerId) : null
  };

  try {
    await db.query(
      `INSERT INTO jobs (job_id, tenant_id, type, status, payload, created_at, updated_at)
       VALUES (?, ?, 'ticket_approval', 'waiting', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [jobId, tId, JSON.stringify(payload)]
    );
  } catch (err) {
    logger.warn('Could not insert approval job into jobs table:', err.message);
  }

  try {
    const job = await ticketQueue.add('ticket_approval_reminder', payload, {
      jobId,
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: true,
      removeOnFail: false
    });
    logger.info(`Enqueued Landlord approval reminder job ${job.id} for ticket ${ticketNumber}`);
    return job;
  } catch (error) {
    logger.warn(`Failed to enqueue approval reminder to BullMQ: ${error.message}`);
    return { id: jobId, data: payload, name: 'ticket_approval_reminder' };
  }
}

/**
 * Enqueue technician daily digest of open assigned tickets.
 */
async function enqueueTechnicianDigest({ tenantId, technicianId }) {
  const tId = Number(tenantId);
  const techId = Number(technicianId);

  if (!tId || !techId) {
    throw new Error('Valid tenantId and technicianId are required to enqueue digest');
  }

  const jobId = `tech-digest-${tId}-${techId}-${new Date().toISOString().slice(0, 10)}`;
  const payload = {
    type: 'technician_digest',
    tenantId: tId,
    technicianId: techId
  };

  try {
    const job = await ticketQueue.add('technician_daily_digest', payload, {
      jobId,
      attempts: 2,
      removeOnComplete: true
    });
    logger.info(`Enqueued technician daily digest job ${job.id} for tech ${techId}`);
    return job;
  } catch (error) {
    logger.warn(`Failed to enqueue technician digest: ${error.message}`);
    return { id: jobId, data: payload, name: 'technician_daily_digest' };
  }
}

module.exports = {
  enqueueSlaReminder,
  enqueueApprovalReminder,
  enqueueTechnicianDigest
};
