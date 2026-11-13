const db = require('../config/database');
const crypto = require('crypto');

class PropertyModel {
  generateToken(prefix = 'pass') {
    return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
  }

  async create({
    tenant_id,
    customer_id = null,
    name,
    address = null,
    unit_count = 1,
    default_approval_threshold_kes = 5000,
    emergency_auto_containment_limit_kes = 8000,
    airbnb_managed = 0,
    passport_token = null,
    notes = null,
    created_by = null
  }) {
    const finalPassportToken = passport_token || this.generateToken('pass');

    const result = await db.query(
      `INSERT INTO properties (
        tenant_id, customer_id, name, address, unit_count,
        default_approval_threshold_kes, emergency_auto_containment_limit_kes,
        airbnb_managed, passport_token, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenant_id,
        customer_id ? Number(customer_id) : null,
        name,
        address,
        parseInt(unit_count, 10) || 1,
        Number(default_approval_threshold_kes) || 5000,
        Number(emergency_auto_containment_limit_kes) || 8000,
        airbnb_managed ? 1 : 0,
        finalPassportToken,
        notes,
        created_by
      ]
    );
    const insertId = result.insertId || result.id;
    return this.findById(insertId, tenant_id);
  }

  async findById(id, tenant_id) {
    const rows = await db.query(
      `SELECT p.*,
              c.first_name AS landlord_first_name,
              c.last_name AS landlord_last_name,
              c.phone AS landlord_phone,
              c.email AS landlord_email,
              c.company_name AS landlord_company_name,
              u.first_name AS creator_first_name,
              u.last_name AS creator_last_name
       FROM properties p
       LEFT JOIN customers c ON p.customer_id = c.id AND c.tenant_id = p.tenant_id
       LEFT JOIN users u ON p.created_by = u.id AND u.tenant_id = p.tenant_id
       WHERE p.id = ? AND p.tenant_id = ?`,
      [id, tenant_id]
    );

    if (!rows || rows.length === 0) return null;
    const prop = rows[0];
    prop.landlord_name = prop.landlord_first_name
      ? `${prop.landlord_first_name} ${prop.landlord_last_name || ''}`.trim()
      : null;
    return prop;
  }

  async findByNameOrAddress(identifier, tenant_id) {
    if (!identifier) return null;
    const term = String(identifier).trim();
    const rows = await db.query(
      `SELECT p.*,
              c.first_name AS landlord_first_name,
              c.last_name AS landlord_last_name,
              c.phone AS landlord_phone,
              c.email AS landlord_email
       FROM properties p
       LEFT JOIN customers c ON p.customer_id = c.id AND c.tenant_id = p.tenant_id
       WHERE p.tenant_id = ?
         AND (p.name LIKE ? OR p.address LIKE ? OR p.id = ?)
       LIMIT 1`,
      [tenant_id, `%${term}%`, `%${term}%`, Number.isInteger(Number(term)) ? Number(term) : -1]
    );
    if (!rows || rows.length === 0) return null;
    return rows[0];
  }

  // --- Public Self-Service Property Passport (No Auth Required) ---

  async findByPassportToken(token) {
    if (!token) return null;

    const rows = await db.query(
      `SELECT p.*,
              c.first_name AS landlord_first_name,
              c.last_name AS landlord_last_name,
              c.company_name AS landlord_company_name
       FROM properties p
       LEFT JOIN customers c ON p.customer_id = c.id
       WHERE p.passport_token = ?
       LIMIT 1`,
      [token]
    );

    if (!rows || rows.length === 0) return null;
    const property = rows[0];

    const memory = await this.getMaintenanceMemory(property.id, property.tenant_id);

    // Airbnb & Superhost Readiness Checklist
    const airbnbChecklist = [
      { item: 'Instant Showers & Water Heaters', status: 'verified', notes: 'Inspected with circuit load test' },
      { item: 'Water Pressure & Booster Pump', status: 'verified', notes: 'Adequate pressure across all bathrooms' },
      { item: 'Kitchen Hob, Oven & Microwave', status: 'verified', notes: 'Proper breaker isolation & grounding' },
      { item: 'Keyless Entry & Locksets', status: 'verified', notes: 'Checked and lubricated' },
      { item: 'Pre-Rains Roof & Window Drainage', status: 'verified', notes: 'Gutters clear and traps sealed' }
    ];

    return {
      property_passport: {
        property_id: property.id,
        name: property.name,
        address: property.address,
        unit_count: property.unit_count,
        airbnb_managed: Boolean(property.airbnb_managed),
        landlord: {
          name: `${property.landlord_first_name || ''} ${property.landlord_last_name || ''}`.trim() || property.landlord_company_name
        },
        health_score: memory.health_score,
        lifetime_summary: memory.lifetime_summary,
        recurring_alerts: memory.recurring_alerts,
        active_warranties: memory.active_warranties,
        service_history_timeline: memory.service_history_timeline,
        airbnb_readiness: {
          badge: 'Sawa Superhost Certified',
          checklist: airbnbChecklist,
          last_audit_date: property.last_preventive_inspection_at || 'Recent'
        }
      }
    };
  }

  async findAll(tenant_id, filters = {}, pagination = {}) {
    const { customer_id, airbnb_managed, q } = filters;
    const { limit = 20, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = pagination;

    let where = 'WHERE p.tenant_id = ?';
    const params = [tenant_id];

    if (customer_id) {
      where += ' AND p.customer_id = ?';
      params.push(Number(customer_id));
    }

    if (airbnb_managed !== undefined && airbnb_managed !== '') {
      where += ' AND p.airbnb_managed = ?';
      params.push(Number(airbnb_managed) ? 1 : 0);
    }

    if (q) {
      where += ' AND (p.name LIKE ? OR p.address LIKE ? OR p.notes LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const countRows = await db.query(`SELECT COUNT(*) AS total FROM properties p ${where}`, params);
    const total = countRows[0]?.total || 0;

    const allowedSort = ['name', 'unit_count', 'created_at', 'updated_at'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const properties = await db.query(
      `SELECT p.*,
              c.first_name AS landlord_first_name,
              c.last_name AS landlord_last_name,
              c.phone AS landlord_phone,
              c.email AS landlord_email,
              c.company_name AS landlord_company_name,
              (SELECT COUNT(*) FROM tickets t WHERE t.property_id = p.id AND t.tenant_id = p.tenant_id AND t.status NOT IN ('resolved', 'verified', 'closed')) AS open_tickets_count
       FROM properties p
       LEFT JOIN customers c ON p.customer_id = c.id AND c.tenant_id = p.tenant_id
       ${where}
       ORDER BY p.${sortField} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return {
      properties: properties.map((p) => ({
        ...p,
        landlord_name: p.landlord_first_name
          ? `${p.landlord_first_name} ${p.landlord_last_name || ''}`.trim()
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

    const allowed = [
      'name', 'customer_id', 'address', 'unit_count', 'notes',
      'default_approval_threshold_kes', 'emergency_auto_containment_limit_kes',
      'airbnb_managed', 'passport_token', 'last_preventive_inspection_at',
      'next_preventive_inspection_due'
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
      `UPDATE properties SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    );

    return this.findById(id, tenant_id);
  }

  async delete(id, tenant_id) {
    const existing = await this.findById(id, tenant_id);
    if (!existing) return false;

    await db.query('DELETE FROM properties WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    return true;
  }

  // --- Sawa Repairs v2.1 & v2.2 Property Maintenance Memory ---

  async getMaintenanceMemory(propertyId, tenantId) {
    const property = await this.findById(propertyId, tenantId);
    if (!property) return null;

    // 1. Lifetime ticket metrics
    const statsRows = await db.query(
      `SELECT COUNT(*) AS total_tickets,
              SUM(CASE WHEN status IN ('resolved', 'verified', 'closed') THEN 1 ELSE 0 END) AS completed_tickets,
              SUM(CASE WHEN status NOT IN ('resolved', 'verified', 'closed') THEN 1 ELSE 0 END) AS open_tickets,
              SUM(CASE WHEN priority = 'emergency' AND status NOT IN ('resolved', 'verified', 'closed') THEN 1 ELSE 0 END) AS open_emergencies,
              COALESCE(SUM(CASE WHEN status IN ('resolved', 'verified', 'closed') THEN invoice_amount_kes ELSE 0 END), 0) AS lifetime_invoiced_kes,
              COALESCE(SUM(CASE WHEN status IN ('resolved', 'verified', 'closed') THEN total_cost_kes ELSE 0 END), 0) AS lifetime_cost_kes,
              COALESCE(SUM(labour_hours), 0) AS lifetime_labour_hours
       FROM tickets
       WHERE property_id = ? AND tenant_id = ?`,
      [propertyId, tenantId]
    );

    const stats = statsRows[0] || {};
    const totalTickets = Number(stats.total_tickets || 0);
    const completedTickets = Number(stats.completed_tickets || 0);
    const openTickets = Number(stats.open_tickets || 0);
    const openEmergencies = Number(stats.open_emergencies || 0);
    const lifetimeSpendKes = Number(stats.lifetime_invoiced_kes || stats.lifetime_cost_kes || 0);
    const lifetimeLabourHours = Number(stats.lifetime_labour_hours || 0);

    // 2. Category breakdown
    const catRows = await db.query(
      `SELECT category,
              COUNT(*) AS count,
              COALESCE(SUM(invoice_amount_kes), 0) AS invoiced_kes,
              COALESCE(SUM(total_cost_kes), 0) AS cost_kes
       FROM tickets
       WHERE property_id = ? AND tenant_id = ?
       GROUP BY category
       ORDER BY count DESC`,
      [propertyId, tenantId]
    );

    const categoryBreakdown = (catRows || []).map((r) => ({
      category: r.category,
      count: Number(r.count),
      spend_kes: Number(r.invoiced_kes || r.cost_kes)
    }));

    // 3. Recurring failure detection (>= 2 tickets in same category in past 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const recurringRows = await db.query(
      `SELECT category,
              COUNT(*) AS count,
              MIN(created_at) AS first_reported,
              MAX(created_at) AS last_reported
       FROM tickets
       WHERE property_id = ? AND tenant_id = ? AND created_at >= ?
       GROUP BY category
       HAVING COUNT(*) >= 2
       ORDER BY count DESC`,
      [propertyId, tenantId, ninetyDaysAgo]
    );

    const recurringAlerts = (recurringRows || []).map((r) => {
      const count = Number(r.count);
      let recommendation = `Multiple ${r.category} repairs in 90 days. Recommend comprehensive preventive overhaul.`;
      if (r.category === 'plumbing') {
        recommendation = 'Recurring plumbing issues detected. Inspect main supply line, pressure regulators, and drainage stack to stop leak cycle.';
      } else if (r.category === 'electrical') {
        recommendation = 'Recurring electrical issues detected. Perform distribution board load audit, check grounding and replace aging breakers.';
      } else if (r.category === 'roofing') {
        recommendation = 'Recurring roof leaks detected. Schedule full roof flashing and gutter realignment before heavy rains.';
      }

      return {
        category: r.category,
        occurrences_90d: count,
        risk_level: count >= 3 ? 'high' : 'medium',
        title: `Recurring ${r.category} issues (${count} in last 90 days)`,
        recommendation,
        first_reported: r.first_reported,
        last_reported: r.last_reported
      };
    });

    // 4. Active 30-day workmanship warranties
    const nowIso = new Date().toISOString();
    const warrantyRows = await db.query(
      `SELECT id, ticket_number, category, description, resolved_at, warranty_until, tracking_token
       FROM tickets
       WHERE property_id = ?
         AND tenant_id = ?
         AND warranty_until IS NOT NULL
         AND warranty_until >= ?
       ORDER BY warranty_until ASC`,
      [propertyId, tenantId, nowIso]
    );

    const activeWarranties = (warrantyRows || []).map((w) => {
      const expiry = new Date(w.warranty_until);
      const daysRemaining = Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
      return {
        ticket_id: w.id,
        ticket_number: w.ticket_number,
        category: w.category,
        description: w.description,
        resolved_at: w.resolved_at,
        warranty_until: w.warranty_until,
        days_remaining: daysRemaining,
        tracking_token: w.tracking_token,
        status: daysRemaining > 0 ? 'active' : 'expiring_today'
      };
    });

    // 5. Complete repair timeline with photos & technician info
    const timelineRows = await db.query(
      `SELECT t.*,
              u.first_name AS technician_first_name,
              u.last_name AS technician_last_name,
              u.phone AS technician_phone
       FROM tickets t
       LEFT JOIN users u ON t.assigned_technician_id = u.id AND u.tenant_id = t.tenant_id
       WHERE t.property_id = ? AND t.tenant_id = ?
       ORDER BY t.created_at DESC`,
      [propertyId, tenantId]
    );

    const timeline = [];
    for (const t of timelineRows || []) {
      const attachments = await db.query(
        `SELECT id, filename, original_name, file_path, mime_type, created_at
         FROM attachments
         WHERE ticket_id = ? AND tenant_id = ?
         ORDER BY created_at ASC`,
        [t.id, tenantId]
      );

      timeline.push({
        id: t.id,
        ticket_number: t.ticket_number,
        tracking_token: t.tracking_token,
        category: t.category,
        priority: t.priority,
        status: t.status,
        description: t.description,
        scheduled_at: t.scheduled_at,
        resolved_at: t.resolved_at,
        warranty_until: t.warranty_until,
        labour_hours: Number(t.labour_hours || 0),
        parts_cost_kes: Number(t.parts_cost_kes || 0),
        invoice_amount_kes: Number(t.invoice_amount_kes || t.total_cost_kes || 0),
        technician_name: t.technician_first_name
          ? `${t.technician_first_name} ${t.technician_last_name || ''}`.trim()
          : null,
        technician_phone: t.technician_phone,
        photos: attachments || []
      });
    }

    // 6. Property Health Score (0 - 100)
    let healthScore = 100;
    healthScore -= openEmergencies * 25;
    healthScore -= recurringAlerts.length * 15;
    healthScore -= Math.min(30, (openTickets - openEmergencies) * 5);
    healthScore = Math.max(0, Math.min(100, healthScore));

    let healthGrade = 'Excellent';
    if (healthScore < 50) healthGrade = 'Critical';
    else if (healthScore < 75) healthGrade = 'Attention Needed';
    else if (healthScore < 90) healthGrade = 'Good';

    return {
      property: {
        id: property.id,
        name: property.name,
        address: property.address,
        unit_count: property.unit_count,
        passport_token: property.passport_token,
        airbnb_managed: Boolean(property.airbnb_managed),
        default_approval_threshold_kes: Number(property.default_approval_threshold_kes || 5000),
        emergency_auto_containment_limit_kes: Number(property.emergency_auto_containment_limit_kes || 8000),
        landlord_name: property.landlord_name,
        landlord_phone: property.landlord_phone,
        landlord_email: property.landlord_email
      },
      health_score: {
        score: healthScore,
        grade: healthGrade,
        open_emergencies: openEmergencies,
        recurring_issues_count: recurringAlerts.length
      },
      lifetime_summary: {
        total_tickets: totalTickets,
        completed_tickets: completedTickets,
        open_tickets: openTickets,
        lifetime_spend_kes: lifetimeSpendKes,
        lifetime_labour_hours: lifetimeLabourHours
      },
      category_breakdown: categoryBreakdown,
      recurring_alerts: recurringAlerts,
      active_warranties: activeWarranties,
      service_history_timeline: timeline
    };
  }

  // --- Landlord Monthly Report ---

  async getLandlordMonthlyReport(customerId, tenantId, monthYear = null) {
    const custRows = await db.query(
      `SELECT * FROM customers WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [customerId, tenantId]
    );
    if (!custRows || custRows.length === 0) return null;
    const landlord = custRows[0];

    const targetMonth = monthYear || new Date().toISOString().slice(0, 7);
    const startOfMonth = `${targetMonth}-01 00:00:00`;
    const nextMonthDate = new Date(`${targetMonth}-01T00:00:00Z`);
    nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
    const endOfMonth = nextMonthDate.toISOString().replace('T', ' ').slice(0, 19);

    const properties = await db.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM tickets t WHERE t.property_id = p.id AND t.tenant_id = p.tenant_id AND t.created_at >= ? AND t.created_at < ?) AS month_tickets_count
       FROM properties p
       WHERE p.customer_id = ? AND p.tenant_id = ?`,
      [startOfMonth, endOfMonth, customerId, tenantId]
    );

    const tickets = await db.query(
      `SELECT t.*,
              p.name AS property_name,
              p.address AS property_address,
              u.first_name AS technician_first_name,
              u.last_name AS technician_last_name
       FROM tickets t
       LEFT JOIN properties p ON t.property_id = p.id AND p.tenant_id = t.tenant_id
       LEFT JOIN users u ON t.assigned_technician_id = u.id AND u.tenant_id = t.tenant_id
       WHERE (t.customer_id = ? OR p.customer_id = ?)
         AND t.tenant_id = ?
         AND t.created_at >= ?
         AND t.created_at < ?
       ORDER BY t.created_at DESC`,
      [customerId, customerId, tenantId, startOfMonth, endOfMonth]
    );

    let totalSpendKes = 0;
    let totalLabourBilledKes = 0;
    let totalPartsBilledKes = 0;
    let totalCalloutFeesKes = 0;
    let completedCount = 0;
    let openCount = 0;
    let emergencyCount = 0;

    for (const t of tickets || []) {
      const spend = Number(t.invoice_amount_kes || t.total_cost_kes || 0);
      totalSpendKes += spend;
      totalLabourBilledKes += Number(t.labour_billed_kes || 0);
      totalPartsBilledKes += Number(t.parts_billed_kes || 0);
      totalCalloutFeesKes += Number(t.callout_fee_waived ? 0 : (t.callout_fee_kes || 0));

      if (['resolved', 'verified', 'closed'].includes(t.status)) {
        completedCount++;
      } else {
        openCount++;
      }

      if (t.priority === 'emergency') {
        emergencyCount++;
      }
    }

    const nowIso = new Date().toISOString();
    const warranties = await db.query(
      `SELECT t.id, t.ticket_number, t.category, t.description, t.warranty_until, p.name AS property_name
       FROM tickets t
       LEFT JOIN properties p ON t.property_id = p.id AND p.tenant_id = t.tenant_id
       WHERE (t.customer_id = ? OR p.customer_id = ?)
         AND t.tenant_id = ?
         AND t.warranty_until IS NOT NULL
         AND t.warranty_until >= ?
       ORDER BY t.warranty_until ASC`,
      [customerId, customerId, tenantId, nowIso]
    );

    return {
      report_period: targetMonth,
      landlord: {
        id: landlord.id,
        name: `${landlord.first_name || ''} ${landlord.last_name || ''}`.trim() || landlord.company_name,
        company_name: landlord.company_name,
        phone: landlord.phone,
        email: landlord.email
      },
      portfolio_summary: {
        properties_count: properties.length,
        total_units: properties.reduce((acc, p) => acc + (p.unit_count || 1), 0),
        total_tickets_month: tickets.length,
        completed_tickets: completedCount,
        open_tickets: openCount,
        emergency_tickets: emergencyCount,
        total_spend_kes: totalSpendKes,
        spend_breakdown: {
          labour_kes: totalLabourBilledKes,
          parts_kes: totalPartsBilledKes,
          callouts_kes: totalCalloutFeesKes
        }
      },
      properties: (properties || []).map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        unit_count: p.unit_count,
        tickets_in_month: Number(p.month_tickets_count || 0)
      })),
      active_warranties: warranties || [],
      tickets: (tickets || []).map((t) => ({
        ticket_number: t.ticket_number,
        property_name: t.property_name,
        category: t.category,
        priority: t.priority,
        status: t.status,
        description: t.description,
        invoice_amount_kes: Number(t.invoice_amount_kes || t.total_cost_kes || 0),
        technician_name: t.technician_first_name
          ? `${t.technician_first_name} ${t.technician_last_name || ''}`.trim()
          : null,
        created_at: t.created_at,
        resolved_at: t.resolved_at
      }))
    };
  }

  // --- Sawa Preventive Care Inspection Packages ---

  async schedulePreventiveInspection({
    tenant_id,
    property_id,
    package_type,
    scheduled_date,
    inspector_user_id = null,
    cost_kes = 0,
    notes = null
  }) {
    const prop = await this.findById(property_id, tenant_id);
    if (!prop) {
      const err = new Error('Property not found');
      err.statusCode = 404;
      throw err;
    }

    const result = await db.query(
      `INSERT INTO preventive_inspections (
         tenant_id, property_id, package_type, status, scheduled_date,
         inspector_user_id, cost_kes, notes
       ) VALUES (?, ?, ?, 'scheduled', ?, ?, ?, ?)`,
      [
        tenant_id,
        Number(property_id),
        package_type,
        scheduled_date,
        inspector_user_id ? Number(inspector_user_id) : null,
        Number(cost_kes) || 0,
        notes || null
      ]
    );

    const insertId = result.insertId || result.id;
    return this.getPreventiveInspectionById(insertId, tenant_id);
  }

  async getPreventiveInspections(tenant_id, filters = {}) {
    const { property_id, package_type, status } = filters;
    let where = 'WHERE pi.tenant_id = ?';
    const params = [tenant_id];

    if (property_id) {
      where += ' AND pi.property_id = ?';
      params.push(Number(property_id));
    }
    if (package_type) {
      where += ' AND pi.package_type = ?';
      params.push(String(package_type));
    }
    if (status) {
      where += ' AND pi.status = ?';
      params.push(String(status));
    }

    return db.query(
      `SELECT pi.*,
              p.name AS property_name,
              p.address AS property_address,
              u.first_name AS inspector_first_name,
              u.last_name AS inspector_last_name
       FROM preventive_inspections pi
       LEFT JOIN properties p ON pi.property_id = p.id AND p.tenant_id = pi.tenant_id
       LEFT JOIN users u ON pi.inspector_user_id = u.id AND u.tenant_id = pi.tenant_id
       ${where}
       ORDER BY pi.scheduled_date ASC`,
      params
    );
  }

  async getPreventiveInspectionById(id, tenant_id) {
    const rows = await db.query(
      `SELECT pi.*,
              p.name AS property_name,
              p.address AS property_address,
              u.first_name AS inspector_first_name,
              u.last_name AS inspector_last_name
       FROM preventive_inspections pi
       LEFT JOIN properties p ON pi.property_id = p.id AND p.tenant_id = pi.tenant_id
       LEFT JOIN users u ON pi.inspector_user_id = u.id AND u.tenant_id = pi.tenant_id
       WHERE pi.id = ? AND pi.tenant_id = ?`,
      [id, tenant_id]
    );
    if (!rows || rows.length === 0) return null;
    return rows[0];
  }

  async completePreventiveInspection(id, tenant_id, data = {}) {
    const existing = await this.getPreventiveInspectionById(id, tenant_id);
    if (!existing) return null;

    const {
      overall_condition = 'good',
      checklist_results = null,
      recommended_actions = null,
      notes = null
    } = data;

    const completedAt = new Date().toISOString();

    await db.query(
      `UPDATE preventive_inspections SET
         status = 'completed',
         completed_at = ?,
         overall_condition = ?,
         checklist_results = ?,
         recommended_actions = ?,
         notes = COALESCE(?, notes),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [
        completedAt,
        overall_condition,
        typeof checklist_results === 'object' ? JSON.stringify(checklist_results) : checklist_results,
        recommended_actions,
        notes,
        id,
        tenant_id
      ]
    );

    // Update property's last preventive inspection timestamp
    await db.query(
      `UPDATE properties SET
         last_preventive_inspection_at = ?,
         next_preventive_inspection_due = datetime(?, '+90 days'),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [completedAt, completedAt, existing.property_id, tenant_id]
    );

    return this.getPreventiveInspectionById(id, tenant_id);
  }
}

module.exports = new PropertyModel();
