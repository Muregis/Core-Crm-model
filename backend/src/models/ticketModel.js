const db = require('../config/database');

class TicketModel {
  async generateTicketNumber(tenant_id) {
    const year = new Date().getFullYear();
    const prefix = `SAW-${year}-`;

    const rows = await db.query(
      `SELECT COUNT(*) AS count FROM tickets WHERE tenant_id = ? AND ticket_number LIKE ?`,
      [tenant_id, `${prefix}%`]
    );
    let nextSeq = (rows[0]?.count || 0) + 1;

    // Guard against collision by probing
    while (true) {
      const candidate = `${prefix}${String(nextSeq).padStart(5, '0')}`;
      const check = await db.query(
        `SELECT id FROM tickets WHERE tenant_id = ? AND ticket_number = ? LIMIT 1`,
        [tenant_id, candidate]
      );
      if (!check || check.length === 0) {
        return candidate;
      }
      nextSeq++;
    }
  }

  async create(data) {
    const {
      tenant_id,
      ticket_number,
      property_id = null,
      customer_id = null,
      reported_by = null,
      category = 'general',
      priority = 'standard',
      status = 'reported',
      description,
      assigned_technician_id = null,
      scheduled_at = null,
      started_at = null,
      resolved_at = null,
      closed_at = null,
      landlord_approval_required = 0,
      approval_threshold_kes = 0,
      approved_at = null,
      approved_by = null,
      labour_hours = 0,
      parts_cost_kes = 0,
      total_cost_kes = 0,
      warranty_until = null,
      notes = null,
      internal_notes = null,
      created_by = null
    } = data;

    const finalNumber = ticket_number || (await this.generateTicketNumber(tenant_id));

    const result = await db.query(
      `INSERT INTO tickets (
        tenant_id, ticket_number, property_id, customer_id, reported_by,
        category, priority, status, description, assigned_technician_id,
        scheduled_at, started_at, resolved_at, closed_at,
        landlord_approval_required, approval_threshold_kes, approved_at, approved_by,
        labour_hours, parts_cost_kes, total_cost_kes,
        warranty_until, notes, internal_notes, created_by
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )`,
      [
        tenant_id,
        finalNumber,
        property_id ? Number(property_id) : null,
        customer_id ? Number(customer_id) : null,
        reported_by || null,
        category,
        priority,
        status,
        description,
        assigned_technician_id ? Number(assigned_technician_id) : null,
        scheduled_at || null,
        started_at || null,
        resolved_at || null,
        closed_at || null,
        landlord_approval_required ? 1 : 0,
        Number(approval_threshold_kes) || 0,
        approved_at || null,
        approved_by ? Number(approved_by) : null,
        Number(labour_hours) || 0,
        Number(parts_cost_kes) || 0,
        Number(total_cost_kes) || 0,
        warranty_until || null,
        notes || null,
        internal_notes || null,
        created_by ? Number(created_by) : null
      ]
    );

    const ticketId = result.insertId || result.id;

    // Record initial status in history
    await this.recordStatusHistory({
      tenant_id,
      ticket_id: ticketId,
      from_status: null,
      to_status: status,
      changed_by: created_by,
      note: 'Ticket created'
    });

    return this.findById(ticketId, tenant_id);
  }

  async findById(id, tenant_id) {
    const rows = await db.query(
      `SELECT t.*,
              p.name AS property_name,
              p.address AS property_address,
              p.unit_count AS property_unit_count,
              c.first_name AS landlord_first_name,
              c.last_name AS landlord_last_name,
              c.phone AS landlord_phone,
              c.email AS landlord_email,
              c.company_name AS landlord_company_name,
              u.first_name AS technician_first_name,
              u.last_name AS technician_last_name,
              u.phone AS technician_phone,
              u.email AS technician_email,
              u.role AS technician_role,
              ap.first_name AS approver_first_name,
              ap.last_name AS approver_last_name,
              cr.first_name AS creator_first_name,
              cr.last_name AS creator_last_name
       FROM tickets t
       LEFT JOIN properties p ON t.property_id = p.id AND p.tenant_id = t.tenant_id
       LEFT JOIN customers c ON t.customer_id = c.id AND c.tenant_id = t.tenant_id
       LEFT JOIN users u ON t.assigned_technician_id = u.id AND u.tenant_id = t.tenant_id
       LEFT JOIN users ap ON t.approved_by = ap.id AND ap.tenant_id = t.tenant_id
       LEFT JOIN users cr ON t.created_by = cr.id AND cr.tenant_id = t.tenant_id
       WHERE t.id = ? AND t.tenant_id = ?`,
      [id, tenant_id]
    );

    if (!rows || rows.length === 0) return null;

    const ticket = rows[0];
    ticket.landlord_name = ticket.landlord_first_name
      ? `${ticket.landlord_first_name} ${ticket.landlord_last_name || ''}`.trim()
      : null;
    ticket.technician_name = ticket.technician_first_name
      ? `${ticket.technician_first_name} ${ticket.technician_last_name || ''}`.trim()
      : null;
    ticket.approver_name = ticket.approver_first_name
      ? `${ticket.approver_first_name} ${ticket.approver_last_name || ''}`.trim()
      : null;
    ticket.creator_name = ticket.creator_first_name
      ? `${ticket.creator_first_name} ${ticket.creator_last_name || ''}`.trim()
      : null;

    // Attach status history, attachments, and linked tasks
    ticket.status_history = await this.getStatusHistory(id, tenant_id);
    ticket.attachments = await this.getAttachments(id, tenant_id);
    ticket.linked_tasks = await this.getLinkedTasks(id, tenant_id);

    return ticket;
  }

  async findByNumber(ticket_number, tenant_id) {
    const rows = await db.query(
      `SELECT id FROM tickets WHERE ticket_number = ? AND tenant_id = ? LIMIT 1`,
      [ticket_number, tenant_id]
    );
    if (!rows || rows.length === 0) return null;
    return this.findById(rows[0].id, tenant_id);
  }

  async findAll(tenant_id, filters = {}, pagination = {}) {
    const {
      property_id,
      customer_id,
      status,
      category,
      priority,
      assigned_technician_id,
      landlord_approval_required,
      startDate,
      endDate,
      q
    } = filters;

    const {
      limit = 20,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = pagination;

    let where = 'WHERE t.tenant_id = ?';
    const params = [tenant_id];

    if (property_id) {
      where += ' AND t.property_id = ?';
      params.push(Number(property_id));
    }
    if (customer_id) {
      where += ' AND t.customer_id = ?';
      params.push(Number(customer_id));
    }
    if (status) {
      where += ' AND t.status = ?';
      params.push(String(status));
    }
    if (category) {
      where += ' AND t.category = ?';
      params.push(String(category));
    }
    if (priority) {
      where += ' AND t.priority = ?';
      params.push(String(priority));
    }
    if (assigned_technician_id) {
      where += ' AND t.assigned_technician_id = ?';
      params.push(Number(assigned_technician_id));
    }
    if (landlord_approval_required !== undefined && landlord_approval_required !== '') {
      where += ' AND t.landlord_approval_required = ?';
      params.push(Number(landlord_approval_required) ? 1 : 0);
    }
    if (startDate) {
      where += ' AND t.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      where += ' AND t.created_at <= ?';
      params.push(endDate);
    }
    if (q) {
      where += ' AND (t.ticket_number LIKE ? OR t.description LIKE ? OR t.reported_by LIKE ? OR p.name LIKE ?)';
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM tickets t
      LEFT JOIN properties p ON t.property_id = p.id AND p.tenant_id = t.tenant_id
      ${where}
    `;
    const countRows = await db.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const allowedSort = [
      'created_at', 'updated_at', 'scheduled_at', 'priority', 'status',
      'ticket_number', 'total_cost_kes', 'category'
    ];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT t.*,
             p.name AS property_name,
             p.address AS property_address,
             c.first_name AS landlord_first_name,
             c.last_name AS landlord_last_name,
             c.phone AS landlord_phone,
             c.company_name AS landlord_company_name,
             u.first_name AS technician_first_name,
             u.last_name AS technician_last_name,
             u.phone AS technician_phone
      FROM tickets t
      LEFT JOIN properties p ON t.property_id = p.id AND p.tenant_id = t.tenant_id
      LEFT JOIN customers c ON t.customer_id = c.id AND c.tenant_id = t.tenant_id
      LEFT JOIN users u ON t.assigned_technician_id = u.id AND u.tenant_id = t.tenant_id
      ${where}
      ORDER BY t.${sortField} ${sortDir}
      LIMIT ? OFFSET ?
    `;

    const tickets = await db.query(sql, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

    return {
      tickets: tickets.map((t) => ({
        ...t,
        landlord_name: t.landlord_first_name
          ? `${t.landlord_first_name} ${t.landlord_last_name || ''}`.trim()
          : null,
        technician_name: t.technician_first_name
          ? `${t.technician_first_name} ${t.technician_last_name || ''}`.trim()
          : null
      })),
      total
    };
  }

  async update(id, tenant_id, data = {}) {
    const existing = await this.findById(id, tenant_id);
    if (!existing) return null;

    const fields = [];
    const params = [];

    const allowedFields = [
      'property_id', 'customer_id', 'reported_by', 'category', 'priority',
      'status', 'description', 'assigned_technician_id', 'scheduled_at',
      'started_at', 'resolved_at', 'closed_at', 'landlord_approval_required',
      'approval_threshold_kes', 'approved_at', 'approved_by', 'labour_hours',
      'parts_cost_kes', 'total_cost_kes', 'warranty_until', 'notes', 'internal_notes'
    ];

    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(data[key]);
      }
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, tenant_id);

    await db.query(
      `UPDATE tickets SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    );

    return this.findById(id, tenant_id);
  }

  async delete(id, tenant_id) {
    const existing = await this.findById(id, tenant_id);
    if (!existing) return false;

    await db.query('DELETE FROM tickets WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    return true;
  }

  async recordStatusHistory({ tenant_id, ticket_id, from_status, to_status, changed_by = null, note = null }) {
    await db.query(
      `INSERT INTO ticket_status_history (tenant_id, ticket_id, from_status, to_status, changed_by, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenant_id, ticket_id, from_status || null, to_status, changed_by || null, note || null]
    );
  }

  async getStatusHistory(ticket_id, tenant_id) {
    const rows = await db.query(
      `SELECT h.*,
              u.first_name AS user_first_name,
              u.last_name AS user_last_name
       FROM ticket_status_history h
       LEFT JOIN users u ON h.changed_by = u.id AND u.tenant_id = h.tenant_id
       WHERE h.ticket_id = ? AND h.tenant_id = ?
       ORDER BY h.created_at ASC`,
      [ticket_id, tenant_id]
    );

    return (rows || []).map((r) => ({
      ...r,
      changed_by_name: r.user_first_name
        ? `${r.user_first_name} ${r.user_last_name || ''}`.trim()
        : 'System'
    }));
  }

  async addAttachment({ tenant_id, ticket_id, customer_id = null, filename, original_name, file_path, file_size = 0, mime_type = 'image/jpeg', uploaded_by = 1 }) {
    const result = await db.query(
      `INSERT INTO attachments (tenant_id, ticket_id, customer_id, filename, original_name, file_path, file_size, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenant_id,
        ticket_id,
        customer_id ? Number(customer_id) : null,
        filename,
        original_name,
        file_path,
        file_size,
        mime_type,
        uploaded_by
      ]
    );
    return result.insertId || result.id;
  }

  async getAttachments(ticket_id, tenant_id) {
    return db.query(
      `SELECT * FROM attachments WHERE ticket_id = ? AND tenant_id = ? ORDER BY created_at DESC`,
      [ticket_id, tenant_id]
    );
  }

  async getLinkedTasks(ticket_id, tenant_id) {
    return db.query(
      `SELECT t.*, 
              (u.first_name || ' ' || u.last_name) AS assigned_to_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id AND u.tenant_id = t.tenant_id
       WHERE t.ticket_id = ? AND t.tenant_id = ?
       ORDER BY t.created_at DESC`,
      [ticket_id, tenant_id]
    );
  }

  async createOrUpdateLinkedTask({ tenant_id, ticket_id, title, description, customer_id, assigned_to, due_date, priority = 'medium', created_by }) {
    const existing = await db.query(
      `SELECT id FROM tasks WHERE ticket_id = ? AND tenant_id = ? LIMIT 1`,
      [ticket_id, tenant_id]
    );

    if (existing && existing.length > 0) {
      await db.query(
        `UPDATE tasks SET
           title = ?,
           description = ?,
           customer_id = ?,
           assigned_to = ?,
           due_date = ?,
           priority = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [title, description, customer_id || null, assigned_to, due_date, priority, existing[0].id, tenant_id]
      );
      return existing[0].id;
    } else {
      const res = await db.query(
        `INSERT INTO tasks (
           tenant_id, ticket_id, title, description, customer_id,
           assigned_to, created_by, status, priority, due_date, task_type
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'field_service')`,
        [tenant_id, ticket_id, title, description, customer_id || null, assigned_to, created_by, priority, due_date]
      );
      return res.insertId || res.id;
    }
  }

  async getDashboardStats(tenant_id) {
    // 1. Open emergencies
    const emergencyRows = await db.query(
      `SELECT COUNT(*) AS count
       FROM tickets
       WHERE tenant_id = ?
         AND priority = 'emergency'
         AND status NOT IN ('resolved', 'verified', 'closed')`,
      [tenant_id]
    );
    const openEmergencies = emergencyRows[0]?.count || 0;

    // 2. SLA breaches:
    // a) Emergency tickets still in 'reported' created > 3 hours ago
    // b) Scheduled tickets with scheduled_at in the past that are still 'scheduled'
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const slaRows = await db.query(
      `SELECT COUNT(*) AS count
       FROM tickets
       WHERE tenant_id = ?
         AND (
           (priority = 'emergency' AND status = 'reported' AND created_at <= ?)
           OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?)
         )`,
      [tenant_id, threeHoursAgo, nowIso]
    );
    const slaBreaches = slaRows[0]?.count || 0;

    // 3. Tickets created this month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const monthRows = await db.query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(total_cost_kes), 0) AS total_costs
       FROM tickets
       WHERE tenant_id = ? AND created_at >= ?`,
      [tenant_id, startOfMonth]
    );
    const ticketsThisMonth = monthRows[0]?.count || 0;
    const totalCostsThisMonth = Number(monthRows[0]?.total_costs || 0);

    // 4. Pending landlord approvals
    const approvalRows = await db.query(
      `SELECT COUNT(*) AS count
       FROM tickets
       WHERE tenant_id = ?
         AND landlord_approval_required = 1
         AND approved_at IS NULL
         AND status NOT IN ('closed')`,
      [tenant_id]
    );
    const pendingApprovals = approvalRows[0]?.count || 0;

    // 5. Group by status
    const statusRows = await db.query(
      `SELECT status, COUNT(*) AS count
       FROM tickets
       WHERE tenant_id = ?
       GROUP BY status`,
      [tenant_id]
    );
    const byStatus = {};
    (statusRows || []).forEach((r) => {
      byStatus[r.status] = r.count;
    });

    // 6. Group by category
    const catRows = await db.query(
      `SELECT category, COUNT(*) AS count
       FROM tickets
       WHERE tenant_id = ?
       GROUP BY category`,
      [tenant_id]
    );
    const byCategory = {};
    (catRows || []).forEach((r) => {
      byCategory[r.category] = r.count;
    });

    // 7. Group by priority
    const priorityRows = await db.query(
      `SELECT priority, COUNT(*) AS count
       FROM tickets
       WHERE tenant_id = ?
       GROUP BY priority`,
      [tenant_id]
    );
    const byPriority = {};
    (priorityRows || []).forEach((r) => {
      byPriority[r.priority] = r.count;
    });

    return {
      openEmergencies,
      slaBreaches,
      ticketsThisMonth,
      totalCostsThisMonth,
      pendingApprovals,
      byStatus,
      byCategory,
      byPriority
    };
  }
}

module.exports = new TicketModel();
