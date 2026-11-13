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
      callout_fee_kes = 0,
      callout_fee_waived = 0,
      emergency_premium_kes = 0,
      travel_cost_kes = 0,
      labour_cost_kes = 0,
      labour_billed_kes = 0,
      parts_markup_percentage = 20,
      parts_billed_kes = 0,
      invoice_amount_kes = 0,
      gross_margin_kes = 0,
      margin_percentage = 0,
      sla_response_due_at = null,
      responded_at = null,
      is_sla_breached = 0,
      is_warranty_claim = 0,
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
        callout_fee_kes, callout_fee_waived, emergency_premium_kes, travel_cost_kes,
        labour_cost_kes, labour_billed_kes, parts_markup_percentage, parts_billed_kes,
        invoice_amount_kes, gross_margin_kes, margin_percentage,
        sla_response_due_at, responded_at, is_sla_breached, is_warranty_claim,
        warranty_until, notes, internal_notes, created_by
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
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
        Number(callout_fee_kes) || 0,
        callout_fee_waived ? 1 : 0,
        Number(emergency_premium_kes) || 0,
        Number(travel_cost_kes) || 0,
        Number(labour_cost_kes) || 0,
        Number(labour_billed_kes) || 0,
        Number(parts_markup_percentage) || 20,
        Number(parts_billed_kes) || 0,
        Number(invoice_amount_kes) || 0,
        Number(gross_margin_kes) || 0,
        Number(margin_percentage) || 0,
        sla_response_due_at || null,
        responded_at || null,
        is_sla_breached ? 1 : 0,
        is_warranty_claim ? 1 : 0,
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
      is_sla_breached,
      is_warranty_claim,
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
    if (is_sla_breached !== undefined && is_sla_breached !== '') {
      where += ' AND t.is_sla_breached = ?';
      params.push(Number(is_sla_breached) ? 1 : 0);
    }
    if (is_warranty_claim !== undefined && is_warranty_claim !== '') {
      where += ' AND t.is_warranty_claim = ?';
      params.push(Number(is_warranty_claim) ? 1 : 0);
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
      'ticket_number', 'total_cost_kes', 'invoice_amount_kes', 'gross_margin_kes', 'category'
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
      'parts_cost_kes', 'total_cost_kes', 'callout_fee_kes', 'callout_fee_waived',
      'emergency_premium_kes', 'travel_cost_kes', 'labour_cost_kes', 'labour_billed_kes',
      'parts_markup_percentage', 'parts_billed_kes', 'invoice_amount_kes',
      'gross_margin_kes', 'margin_percentage', 'sla_response_due_at',
      'responded_at', 'is_sla_breached', 'is_warranty_claim',
      'warranty_until', 'notes', 'internal_notes'
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
    // c) Tickets where is_sla_breached = 1
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const slaRows = await db.query(
      `SELECT COUNT(*) AS count
       FROM tickets
       WHERE tenant_id = ?
         AND (
           is_sla_breached = 1
           OR (priority = 'emergency' AND status = 'reported' AND created_at <= ?)
           OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?)
         )`,
      [tenant_id, threeHoursAgo, nowIso]
    );
    const slaBreaches = slaRows[0]?.count || 0;

    // 3. Tickets created this month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const monthRows = await db.query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(total_cost_kes), 0) AS total_costs,
              COALESCE(SUM(invoice_amount_kes), 0) AS total_invoiced,
              COALESCE(SUM(gross_margin_kes), 0) AS total_margin
       FROM tickets
       WHERE tenant_id = ? AND created_at >= ?`,
      [tenant_id, startOfMonth]
    );
    const ticketsThisMonth = monthRows[0]?.count || 0;
    const totalCostsThisMonth = Number(monthRows[0]?.total_costs || 0);
    const totalInvoicedThisMonth = Number(monthRows[0]?.total_invoiced || 0);
    const totalMarginThisMonth = Number(monthRows[0]?.total_margin || 0);

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
      totalInvoicedThisMonth,
      totalMarginThisMonth,
      pendingApprovals,
      byStatus,
      byCategory,
      byPriority
    };
  }

  // --- Sawa Repairs v2.1 Metrics & Conversions ---

  async getRepeatCustomers(tenant_id, days = 90) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const rows = await db.query(
      `SELECT c.id AS customer_id,
              c.first_name,
              c.last_name,
              c.phone,
              c.email,
              c.company_name,
              COUNT(t.id) AS tickets_count,
              COALESCE(SUM(t.invoice_amount_kes), 0) AS total_invoiced_kes,
              COALESCE(SUM(t.total_cost_kes), 0) AS total_cost_kes,
              MIN(t.created_at) AS first_ticket_at,
              MAX(t.created_at) AS last_ticket_at,
              (SELECT COUNT(*) FROM sawa_care_contracts scc WHERE scc.customer_id = c.id AND scc.tenant_id = c.tenant_id AND scc.status = 'active') AS active_contract_count
       FROM customers c
       INNER JOIN tickets t ON t.customer_id = c.id AND t.tenant_id = c.tenant_id
       WHERE c.tenant_id = ?
         AND t.created_at >= ?
       GROUP BY c.id
       HAVING COUNT(t.id) >= 3
       ORDER BY tickets_count DESC, total_invoiced_kes DESC`,
      [tenant_id, cutoffDate]
    );

    return (rows || []).map((r) => ({
      customer_id: r.customer_id,
      name: `${r.first_name} ${r.last_name || ''}`.trim(),
      phone: r.phone,
      email: r.email,
      company_name: r.company_name,
      tickets_count_90d: Number(r.tickets_count),
      total_invoiced_kes: Number(r.total_invoiced_kes),
      total_cost_kes: Number(r.total_cost_kes),
      first_ticket_at: r.first_ticket_at,
      last_ticket_at: r.last_ticket_at,
      has_active_contract: Number(r.active_contract_count) > 0,
      sawa_care_eligible: Number(r.tickets_count) >= 3 && Number(r.active_contract_count) === 0,
      qualification_criteria: '3+ tickets within 90 days (Product Document v2.1 §5)'
    }));
  }

  async getCompanyPlanMetrics(tenant_id) {
    // 1. Completed tickets
    const completedRows = await db.query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(invoice_amount_kes), 0) AS total_invoiced,
              COALESCE(SUM(labour_cost_kes + parts_cost_kes + travel_cost_kes), 0) AS total_cogs,
              COALESCE(SUM(gross_margin_kes), 0) AS total_gross_margin,
              COALESCE(SUM(callout_fee_kes), 0) AS total_callout_fees,
              COALESCE(SUM(emergency_premium_kes), 0) AS total_emergency_premiums,
              COALESCE(SUM(labour_billed_kes), 0) AS total_labour_billed,
              COALESCE(SUM(parts_billed_kes), 0) AS total_parts_billed
       FROM tickets
       WHERE tenant_id = ? AND status IN ('resolved', 'verified', 'closed')`,
      [tenant_id]
    );

    const completedTickets = completedRows[0]?.count || 0;
    const totalInvoiced = Number(completedRows[0]?.total_invoiced || 0);
    const totalCogs = Number(completedRows[0]?.total_cogs || 0);
    const totalGrossMargin = Number(completedRows[0]?.total_gross_margin || 0);

    // Margin percentage
    const overallMarginPct = totalInvoiced > 0
      ? Number(((totalGrossMargin / totalInvoiced) * 100).toFixed(1))
      : 0;

    // 2. Paying customers (unique customers who have generated revenue or costs)
    const payingCustRows = await db.query(
      `SELECT COUNT(DISTINCT customer_id) AS count
       FROM tickets
       WHERE tenant_id = ?
         AND customer_id IS NOT NULL
         AND (invoice_amount_kes > 0 OR total_cost_kes > 0)`,
      [tenant_id]
    );
    const payingCustomers = payingCustRows[0]?.count || 0;

    // 3. Repeat customers (>= 3 tickets in past 90 days)
    const repeatCustomersList = await this.getRepeatCustomers(tenant_id, 90);
    const repeatCustomersCount = repeatCustomersList.length;

    // 4. Active Sawa Care contracts
    let activeContracts = 0;
    try {
      const contractRows = await db.query(
        `SELECT COUNT(*) AS count FROM sawa_care_contracts WHERE tenant_id = ? AND status = 'active'`,
        [tenant_id]
      );
      activeContracts = contractRows[0]?.count || 0;
    } catch (e) {
      // Table might be empty or uninitialized
      activeContracts = 0;
    }

    // 5. Total all tickets (any status)
    const totalTicketsRows = await db.query(
      `SELECT COUNT(*) AS total FROM tickets WHERE tenant_id = ?`,
      [tenant_id]
    );
    const totalTickets = totalTicketsRows[0]?.total || 0;

    // 6. SLA & Emergency response performance
    const emergencyRows = await db.query(
      `SELECT COUNT(*) AS total_emergencies,
              SUM(CASE WHEN is_sla_breached = 1 THEN 1 ELSE 0 END) AS emergency_breaches
       FROM tickets
       WHERE tenant_id = ? AND priority = 'emergency'`,
      [tenant_id]
    );
    const totalEmergencies = emergencyRows[0]?.total_emergencies || 0;
    const emergencyBreaches = Number(emergencyRows[0]?.emergency_breaches || 0);
    const emergencyCompliancePct = totalEmergencies > 0
      ? Number((((totalEmergencies - emergencyBreaches) / totalEmergencies) * 100).toFixed(1))
      : 100.0;

    // 7. Total SLA breaches overall
    const allBreachRows = await db.query(
      `SELECT COUNT(*) AS count FROM tickets WHERE tenant_id = ? AND is_sla_breached = 1`,
      [tenant_id]
    );
    const totalSlaBreaches = allBreachRows[0]?.count || 0;

    // 8. Workmanship warranty claims
    const warrantyRows = await db.query(
      `SELECT COUNT(*) AS count FROM tickets WHERE tenant_id = ? AND is_warranty_claim = 1`,
      [tenant_id]
    );
    const warrantyClaimsCount = warrantyRows[0]?.count || 0;
    const warrantyRatePct = completedTickets > 0
      ? Number(((warrantyClaimsCount / completedTickets) * 100).toFixed(1))
      : 0.0;

    // 9. Callout fees waived vs collected
    const calloutRows = await db.query(
      `SELECT 
         SUM(CASE WHEN callout_fee_waived = 1 THEN 1 ELSE 0 END) AS waived_count,
         SUM(CASE WHEN callout_fee_waived = 0 AND callout_fee_kes > 0 THEN callout_fee_kes ELSE 0 END) AS collected_kes
       FROM tickets
       WHERE tenant_id = ?`,
      [tenant_id]
    );
    const calloutWaivedCount = Number(calloutRows[0]?.waived_count || 0);
    const calloutCollectedKes = Number(calloutRows[0]?.collected_kes || 0);

    return {
      phase1_scorecard: {
        completed_tickets: {
          current: completedTickets,
          target_range: '50–100 tickets',
          target_min: 50,
          target_max: 100,
          status: completedTickets >= 50 ? 'achieved' : 'in_progress',
          progress_pct: Math.min(100, Math.round((completedTickets / 50) * 100))
        },
        paying_customers: {
          current: payingCustomers,
          target_range: '20–30 customers',
          target_min: 20,
          target_max: 30,
          status: payingCustomers >= 20 ? 'achieved' : 'in_progress',
          progress_pct: Math.min(100, Math.round((payingCustomers / 20) * 100))
        },
        repeat_customers_90d: {
          current: repeatCustomersCount,
          target_range: '8–12 repeat customers',
          target_min: 8,
          target_max: 12,
          status: repeatCustomersCount >= 8 ? 'achieved' : 'in_progress',
          progress_pct: Math.min(100, Math.round((repeatCustomersCount / 8) * 100))
        },
        sawa_care_contracts: {
          current: activeContracts,
          target_range: '5–10 contracts',
          target_min: 5,
          target_max: 10,
          status: activeContracts >= 5 ? 'achieved' : 'in_progress',
          progress_pct: Math.min(100, Math.round((activeContracts / 5) * 100))
        }
      },
      unit_economics: {
        total_invoiced_kes: totalInvoiced,
        total_cogs_kes: totalCogs,
        gross_margin_kes: totalGrossMargin,
        margin_percentage: overallMarginPct,
        average_ticket_value_kes: completedTickets > 0 ? Math.round(totalInvoiced / completedTickets) : 0,
        callout_fees_collected_kes: calloutCollectedKes,
        callout_fees_waived_count: calloutWaivedCount,
        labour_billed_kes: Number(completedRows[0]?.total_labour_billed || 0),
        parts_billed_kes: Number(completedRows[0]?.total_parts_billed || 0),
        emergency_premiums_kes: Number(completedRows[0]?.total_emergency_premiums || 0)
      },
      service_quality_and_sla: {
        total_tickets: totalTickets,
        emergency_sla_compliance_pct: emergencyCompliancePct,
        total_sla_breaches: totalSlaBreaches,
        emergency_breaches: emergencyBreaches,
        warranty_claims_count: warrantyClaimsCount,
        warranty_rate_pct: warrantyRatePct,
        target_warranty_rate_max: 5.0
      }
    };
  }

  // --- Sawa Care Contracts CRUD ---

  async createSawaCareContract({
    tenant_id,
    customer_id,
    tier = 'home',
    status = 'prospect',
    start_date = null,
    end_date = null,
    monthly_retainer_kes = 0,
    discount_percentage = 10,
    included_properties_count = 1,
    priority_sla_tier = 'standard',
    quarterly_inspection_scheduled = null,
    notes = null,
    created_by = null
  }) {
    const result = await db.query(
      `INSERT INTO sawa_care_contracts (
         tenant_id, customer_id, tier, status, start_date, end_date,
         monthly_retainer_kes, discount_percentage, included_properties_count,
         priority_sla_tier, quarterly_inspection_scheduled, notes, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenant_id,
        Number(customer_id),
        tier,
        status,
        start_date || null,
        end_date || null,
        Number(monthly_retainer_kes) || 0,
        Number(discount_percentage) || 10,
        Number(included_properties_count) || 1,
        priority_sla_tier,
        quarterly_inspection_scheduled || null,
        notes || null,
        created_by ? Number(created_by) : null
      ]
    );

    const contractId = result.insertId || result.id;
    return this.getSawaCareContractById(contractId, tenant_id);
  }

  async getSawaCareContracts(tenant_id, filters = {}) {
    const { customer_id, status, tier } = filters;
    let where = 'WHERE scc.tenant_id = ?';
    const params = [tenant_id];

    if (customer_id) {
      where += ' AND scc.customer_id = ?';
      params.push(Number(customer_id));
    }
    if (status) {
      where += ' AND scc.status = ?';
      params.push(String(status));
    }
    if (tier) {
      where += ' AND scc.tier = ?';
      params.push(String(tier));
    }

    const rows = await db.query(
      `SELECT scc.*,
              c.first_name,
              c.last_name,
              c.phone,
              c.email,
              c.company_name
       FROM sawa_care_contracts scc
       LEFT JOIN customers c ON scc.customer_id = c.id AND c.tenant_id = scc.tenant_id
       ${where}
       ORDER BY scc.created_at DESC`,
      params
    );

    return (rows || []).map((r) => ({
      ...r,
      customer_name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.company_name
    }));
  }

  async getSawaCareContractById(id, tenant_id) {
    const rows = await db.query(
      `SELECT scc.*,
              c.first_name,
              c.last_name,
              c.phone,
              c.email,
              c.company_name
       FROM sawa_care_contracts scc
       LEFT JOIN customers c ON scc.customer_id = c.id AND c.tenant_id = scc.tenant_id
       WHERE scc.id = ? AND scc.tenant_id = ?`,
      [id, tenant_id]
    );

    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    r.customer_name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.company_name;
    return r;
  }

  async updateSawaCareContract(id, tenant_id, data = {}) {
    const existing = await this.getSawaCareContractById(id, tenant_id);
    if (!existing) return null;

    const fields = [];
    const params = [];

    const allowed = [
      'tier', 'status', 'start_date', 'end_date', 'monthly_retainer_kes',
      'discount_percentage', 'included_properties_count', 'priority_sla_tier',
      'quarterly_inspection_scheduled', 'notes'
    ];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(data[key]);
      }
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, tenant_id);

    await db.query(
      `UPDATE sawa_care_contracts SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    );

    return this.getSawaCareContractById(id, tenant_id);
  }
}

module.exports = new TicketModel();
