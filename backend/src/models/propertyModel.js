const db = require('../config/database');

class PropertyModel {
  async create({ tenant_id, customer_id = null, name, address = null, unit_count = 1, notes = null, created_by = null }) {
    const result = await db.query(
      `INSERT INTO properties (tenant_id, customer_id, name, address, unit_count, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenant_id, customer_id, name, address, parseInt(unit_count, 10) || 1, notes, created_by]
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

  async findAll(tenant_id, filters = {}, pagination = {}) {
    const { customer_id, q } = filters;
    const { limit = 20, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = pagination;

    let where = 'WHERE p.tenant_id = ?';
    const params = [tenant_id];

    if (customer_id) {
      where += ' AND p.customer_id = ?';
      params.push(Number(customer_id));
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

    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.customer_id !== undefined) {
      fields.push('customer_id = ?');
      params.push(data.customer_id ? Number(data.customer_id) : null);
    }
    if (data.address !== undefined) {
      fields.push('address = ?');
      params.push(data.address);
    }
    if (data.unit_count !== undefined) {
      fields.push('unit_count = ?');
      params.push(parseInt(data.unit_count, 10) || 1);
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      params.push(data.notes);
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
}

module.exports = new PropertyModel();
