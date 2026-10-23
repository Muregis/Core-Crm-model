const db = require('../config/database');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const ALLOWED_STATUSES = new Set(['available', 'reserved', 'sold', 'withdrawn']);

function parseMoney(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function isUniqueConstraintError(error) {
  return /UNIQUE|constraint failed/i.test(String(error && error.message));
}

async function recordStatusChange({ tenantId, parcelId, fromStatus, toStatus, userId, note }) {
  await db.query(
    `INSERT INTO parcel_status_history (tenant_id, parcel_id, from_status, to_status, changed_by, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, parcelId, fromStatus || null, toStatus, userId || null, note || null]
  );
}

const getParcels = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      county,
      minPrice,
      maxPrice,
      dealId,
      q,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE p.tenant_id = ?';
    const params = [req.user.tenant_id];

    if (status) {
      where += ' AND p.status = ?';
      params.push(String(status));
    }
    if (county) {
      where += ' AND p.county = ?';
      params.push(String(county));
    }
    if (dealId) {
      where += ' AND p.deal_id = ?';
      params.push(Number(dealId));
    }
    if (minPrice !== undefined && minPrice !== '') {
      where += ' AND p.list_price_kes >= ?';
      params.push(Number(minPrice));
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      where += ' AND p.list_price_kes <= ?';
      params.push(Number(maxPrice));
    }
    if (q) {
      where += ' AND (p.title_ref LIKE ? OR p.plot_number LIKE ? OR p.name LIKE ? OR p.location_notes LIKE ?)';
      const like = `%${String(q)}%`;
      params.push(like, like, like, like);
    }

    const allowedSort = ['title_ref', 'status', 'list_price_kes', 'size_acres', 'created_at', 'county'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const sortDir = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const parcels = await db.query(
      `SELECT p.*,
              c.first_name AS owner_first_name,
              c.last_name AS owner_last_name,
              c.company_name AS owner_company_name,
              d.title AS deal_title
       FROM parcels p
       LEFT JOIN customers c ON p.owner_customer_id = c.id AND c.tenant_id = p.tenant_id
       LEFT JOIN deals d ON p.deal_id = d.id AND d.tenant_id = p.tenant_id
       ${where}
       ORDER BY p.${sortField} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const countRows = await db.query(`SELECT COUNT(*) AS total FROM parcels p ${where}`, params);
    const total = countRows[0]?.total || 0;

    res.json({
      success: true,
      data: {
        parcels,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum) || 0
        }
      }
    });
  } catch (error) {
    logger.error('Get parcels error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching parcels' });
  }
};

const getParcel = async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT p.*,
              c.first_name AS owner_first_name,
              c.last_name AS owner_last_name,
              d.title AS deal_title
       FROM parcels p
       LEFT JOIN customers c ON p.owner_customer_id = c.id AND c.tenant_id = p.tenant_id
       LEFT JOIN deals d ON p.deal_id = d.id AND d.tenant_id = p.tenant_id
       WHERE p.id = ? AND p.tenant_id = ?`,
      [req.params.id, req.user.tenant_id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Parcel not found' });
    }

    // id DESC is stable when created_at ties (SQLite second resolution)
    const history = await db.query(
      `SELECT h.*, (u.first_name || ' ' || u.last_name) AS changed_by_name
       FROM parcel_status_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.parcel_id = ? AND h.tenant_id = ?
       ORDER BY h.id DESC
       LIMIT 50`,
      [req.params.id, req.user.tenant_id]
    );

    res.json({ success: true, data: { parcel: rows[0], statusHistory: history } });
  } catch (error) {
    logger.error('Get parcel error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching parcel' });
  }
};

const createParcel = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const tenantId = req.user.tenant_id;
    const {
      titleRef,
      plotNumber,
      name,
      sizeAcres,
      sizeUnit = 'acres',
      county,
      ward,
      locationNotes,
      zoning,
      status = 'available',
      listPriceKes,
      dealId,
      ownerCustomerId,
      notes
    } = req.body;

    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    if (ownerCustomerId) {
      const owners = await db.query('SELECT id FROM customers WHERE id = ? AND tenant_id = ?', [
        ownerCustomerId,
        tenantId
      ]);
      if (!owners.length) {
        return res.status(400).json({ success: false, message: 'Owner customer not found in your tenant' });
      }
    }

    if (dealId) {
      const deals = await db.query('SELECT id FROM deals WHERE id = ? AND tenant_id = ?', [dealId, tenantId]);
      if (!deals.length) {
        return res.status(400).json({ success: false, message: 'Deal not found in your tenant' });
      }
    }

    const result = await db.query(
      `INSERT INTO parcels (
         tenant_id, title_ref, plot_number, name, size_acres, size_unit,
         county, ward, location_notes, zoning, status, list_price_kes, currency,
         deal_id, owner_customer_id, notes, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'KES', ?, ?, ?, ?)`,
      [
        tenantId,
        String(titleRef).trim(),
        plotNumber || null,
        name || null,
        sizeAcres != null ? Number(sizeAcres) : null,
        sizeUnit || 'acres',
        county || null,
        ward || null,
        locationNotes || null,
        zoning || null,
        status,
        parseMoney(listPriceKes),
        dealId || null,
        ownerCustomerId || null,
        notes || null,
        req.user.id
      ]
    );

    const parcelId = result.insertId;
    await recordStatusChange({
      tenantId,
      parcelId,
      fromStatus: null,
      toStatus: status,
      userId: req.user.id,
      note: 'Created'
    });

    const created = await db.query('SELECT * FROM parcels WHERE id = ? AND tenant_id = ?', [
      parcelId,
      tenantId
    ]);

    res.status(201).json({ success: true, data: { parcel: created[0] } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        success: false,
        message: 'A parcel with this title reference already exists for your tenant'
      });
    }
    logger.error('Create parcel error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating parcel' });
  }
};

const updateParcel = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const existing = await db.query('SELECT * FROM parcels WHERE id = ? AND tenant_id = ?', [
      req.params.id,
      tenantId
    ]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Parcel not found' });
    }
    const current = existing[0];

    const {
      titleRef,
      plotNumber,
      name,
      sizeAcres,
      sizeUnit,
      county,
      ward,
      locationNotes,
      zoning,
      status,
      listPriceKes,
      dealId,
      ownerCustomerId,
      notes
    } = req.body;

    if (status !== undefined && !ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    if (ownerCustomerId) {
      const owners = await db.query('SELECT id FROM customers WHERE id = ? AND tenant_id = ?', [
        ownerCustomerId,
        tenantId
      ]);
      if (!owners.length) {
        return res.status(400).json({ success: false, message: 'Owner customer not found in your tenant' });
      }
    }

    if (dealId) {
      const deals = await db.query('SELECT id FROM deals WHERE id = ? AND tenant_id = ?', [dealId, tenantId]);
      if (!deals.length) {
        return res.status(400).json({ success: false, message: 'Deal not found in your tenant' });
      }
    }

    const nextStatus = status !== undefined ? status : current.status;

    await db.query(
      `UPDATE parcels SET
         title_ref = ?,
         plot_number = ?,
         name = ?,
         size_acres = ?,
         size_unit = ?,
         county = ?,
         ward = ?,
         location_notes = ?,
         zoning = ?,
         status = ?,
         list_price_kes = ?,
         deal_id = ?,
         owner_customer_id = ?,
         notes = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [
        titleRef !== undefined ? String(titleRef).trim() : current.title_ref,
        plotNumber !== undefined ? plotNumber : current.plot_number,
        name !== undefined ? name : current.name,
        sizeAcres !== undefined ? Number(sizeAcres) : current.size_acres,
        sizeUnit !== undefined ? sizeUnit : current.size_unit,
        county !== undefined ? county : current.county,
        ward !== undefined ? ward : current.ward,
        locationNotes !== undefined ? locationNotes : current.location_notes,
        zoning !== undefined ? zoning : current.zoning,
        nextStatus,
        listPriceKes !== undefined ? parseMoney(listPriceKes) : current.list_price_kes,
        dealId !== undefined ? dealId || null : current.deal_id,
        ownerCustomerId !== undefined ? ownerCustomerId || null : current.owner_customer_id,
        notes !== undefined ? notes : current.notes,
        req.params.id,
        tenantId
      ]
    );

    if (nextStatus !== current.status) {
      await recordStatusChange({
        tenantId,
        parcelId: Number(req.params.id),
        fromStatus: current.status,
        toStatus: nextStatus,
        userId: req.user.id,
        note: req.body.statusNote || null
      });
    }

    const updated = await db.query('SELECT * FROM parcels WHERE id = ? AND tenant_id = ?', [
      req.params.id,
      tenantId
    ]);

    res.json({ success: true, data: { parcel: updated[0] } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        success: false,
        message: 'A parcel with this title reference already exists for your tenant'
      });
    }
    logger.error('Update parcel error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating parcel' });
  }
};

const deleteParcel = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const existing = await db.query('SELECT id FROM parcels WHERE id = ? AND tenant_id = ?', [
      req.params.id,
      tenantId
    ]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Parcel not found' });
    }

    await db.query('DELETE FROM parcel_status_history WHERE parcel_id = ? AND tenant_id = ?', [
      req.params.id,
      tenantId
    ]);
    await db.query('DELETE FROM parcels WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);

    res.json({ success: true, message: 'Parcel deleted' });
  } catch (error) {
    logger.error('Delete parcel error:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting parcel' });
  }
};

module.exports = {
  getParcels,
  getParcel,
  createParcel,
  updateParcel,
  deleteParcel
};
