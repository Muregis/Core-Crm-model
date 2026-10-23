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
    await autoExpireHolds(req.user.tenant_id);
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


// =========================================================================
// PLOT MATRIX STATE MACHINE & AUTOMATED RESERVATION EXPIRATION
// =========================================================================

async function autoExpireHolds(tenantId) {
  try {
    const expiredHolds = await db.query(
      `SELECT r.id, r.parcel_id, p.title_ref, p.plot_number
       FROM parcel_reservations r
       JOIN parcels p ON r.parcel_id = p.id
       WHERE r.tenant_id = ? AND r.status = 'active_hold' AND r.expires_at <= datetime('now')`,
      [tenantId]
    );

    for (const hold of expiredHolds) {
      await db.query(
        "UPDATE parcel_reservations SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [hold.id]
      );
      await db.query(
        "UPDATE parcels SET status = 'available', reservation_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ? AND status = 'reserved'",
        [hold.parcel_id, tenantId]
      );
      await recordStatusChange({
        tenantId,
        parcelId: hold.parcel_id,
        fromStatus: 'reserved',
        toStatus: 'available',
        userId: null,
        note: `Timed reservation hold expired without deposit; plot automatically released back to Available.`
      });
      logger.info(`[Plot Matrix State Machine] Auto-released expired hold on parcel #${hold.parcel_id} (${hold.title_ref})`);
    }
  } catch (err) {
    logger.error('Error running autoExpireHolds:', err);
  }
}

// @desc    Get visual plot matrix with green/yellow/red grid & timer data
// @route   GET /api/parcels/matrix/overview
// @access  Private
const getPlotMatrix = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    await autoExpireHolds(tenantId);

    const parcels = await db.query(
      `SELECT p.*,
              c.first_name AS owner_first_name,
              c.last_name AS owner_last_name,
              c.phone AS owner_phone,
              r.id AS active_reservation_id,
              r.letter_of_offer_ref,
              r.expires_at AS hold_expires_at,
              r.hold_duration_hours,
              r.deposit_required_kes,
              rc.first_name AS reserving_client_first_name,
              rc.last_name AS reserving_client_last_name,
              rc.phone AS reserving_client_phone
       FROM parcels p
       LEFT JOIN customers c ON p.owner_customer_id = c.id
       LEFT JOIN parcel_reservations r ON p.id = r.parcel_id AND r.status = 'active_hold'
       LEFT JOIN customers rc ON r.customer_id = rc.id
       WHERE p.tenant_id = ?
       ORDER BY COALESCE(p.project_name, 'Phase 1'), p.plot_number ASC, p.id ASC`,
      [tenantId]
    );

    // Group parcels by project / estate
    const projectsMap = {};
    let totalAvailable = 0;
    let totalReserved = 0;
    let totalSold = 0;
    let totalValuation = 0;

    for (const p of parcels) {
      const proj = p.project_name || p.name || 'Prime Estate Phase 1';
      if (!projectsMap[proj]) {
        projectsMap[proj] = {
          name: proj,
          county: p.county || 'Nairobi',
          plots: [],
          stats: { total: 0, available: 0, reserved: 0, sold: 0, valuationKes: 0 }
        };
      }

      // Calculate remaining countdown seconds for active holds
      let holdRemainingSeconds = null;
      if (p.status === 'reserved' && p.hold_expires_at) {
        const diffMs = new Date(p.hold_expires_at).getTime() - Date.now();
        holdRemainingSeconds = Math.max(0, Math.floor(diffMs / 1000));
      }

      const plotCard = {
        id: p.id,
        titleRef: p.title_ref,
        plotNumber: p.plot_number || `Plot #${p.id}`,
        name: p.name,
        sizeAcres: p.size_acres,
        sizeUnit: p.size_unit || 'acres',
        county: p.county,
        zoning: p.zoning || 'residential',
        status: p.status, // 'available' (green), 'reserved' (yellow), 'sold' (red)
        listPriceKes: p.list_price_kes,
        dealId: p.deal_id,
        holdDetails: p.active_reservation_id ? {
          reservationId: p.active_reservation_id,
          letterOfOfferRef: p.letter_of_offer_ref,
          holdExpiresAt: p.hold_expires_at,
          holdDurationHours: p.hold_duration_hours,
          remainingSeconds: holdRemainingSeconds,
          depositRequiredKes: p.deposit_required_kes,
          clientName: p.reserving_client_first_name ? `${p.reserving_client_first_name} ${p.reserving_client_last_name || ''}`.trim() : 'Prospective Buyer',
          clientPhone: p.reserving_client_phone
        } : (p.status === 'reserved' ? {
          reservationId: null,
          letterOfOfferRef: 'LOO Pending',
          holdExpiresAt: p.reservation_expires_at || null,
          holdDurationHours: 48,
          remainingSeconds: holdRemainingSeconds,
          depositRequiredKes: 0,
          clientName: p.owner_first_name ? `${p.owner_first_name} ${p.owner_last_name || ''}`.trim() : 'Reserved Buyer',
          clientPhone: p.owner_phone
        } : null)
      };

      projectsMap[proj].plots.push(plotCard);
      projectsMap[proj].stats.total += 1;
      totalValuation += (Number(p.list_price_kes) || 0);
      projectsMap[proj].stats.valuationKes += (Number(p.list_price_kes) || 0);

      if (p.status === 'available') {
        projectsMap[proj].stats.available += 1;
        totalAvailable += 1;
      } else if (p.status === 'reserved') {
        projectsMap[proj].stats.reserved += 1;
        totalReserved += 1;
      } else if (p.status === 'sold') {
        projectsMap[proj].stats.sold += 1;
        totalSold += 1;
      }
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalPlots: parcels.length,
          availablePlots: totalAvailable,
          reservedPlots: totalReserved,
          soldPlots: totalSold,
          totalValuationKes: totalValuation,
          availableRate: parcels.length > 0 ? Math.round((totalAvailable / parcels.length) * 100) : 0
        },
        projects: Object.values(projectsMap)
      }
    });
  } catch (error) {
    logger.error('Get plot matrix error:', error);
    res.status(500).json({ success: false, message: 'Server error while loading plot matrix' });
  }
};

// @desc    Reserve plot with timed hold (24h or 48h) triggered by Letter of Offer
// @route   POST /api/parcels/:id/hold
// @access  Private
const reserveParcelWithHold = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const parcelId = req.params.id;
    const {
      customerId,
      dealId,
      holdHours = 48,
      letterOfOfferRef,
      depositRequiredKes,
      notes
    } = req.body;

    const existing = await db.query('SELECT * FROM parcels WHERE id = ? AND tenant_id = ?', [
      parcelId,
      tenantId
    ]);

    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Plot not found' });
    }

    const parcel = existing[0];
    if (parcel.status === 'sold') {
      return res.status(400).json({ success: false, message: 'Cannot place hold on a sold plot' });
    }

    const hours = Math.max(1, Math.min(parseInt(holdHours, 10) || 48, 168)); // 1h to 7 days
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    const looRef = letterOfOfferRef || `LOO-${Date.now().toString(36).toUpperCase()}`;

    // Cancel any previous active hold for this parcel
    await db.query(
      "UPDATE parcel_reservations SET status = 'cancelled' WHERE parcel_id = ? AND tenant_id = ? AND status = 'active_hold'",
      [parcelId, tenantId]
    );

    // Create reservation record
    const resResult = await db.query(
      `INSERT INTO parcel_reservations (
        tenant_id, parcel_id, customer_id, deal_id, letter_of_offer_ref,
        hold_duration_hours, expires_at, status, deposit_required_kes, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active_hold', ?, ?, ?)`,
      [
        tenantId,
        parcelId,
        customerId || null,
        dealId || null,
        looRef,
        hours,
        expiresAt,
        depositRequiredKes ? parseFloat(depositRequiredKes) : 0,
        notes || null,
        req.user.id
      ]
    );

    // Update parcel status to reserved with timer timestamp
    await db.query(
      `UPDATE parcels SET
         status = 'reserved',
         reservation_expires_at = ?,
         deal_id = COALESCE(?, deal_id),
         owner_customer_id = COALESCE(?, owner_customer_id),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [expiresAt, dealId || null, customerId || null, parcelId, tenantId]
    );

    await recordStatusChange({
      tenantId,
      parcelId,
      fromStatus: parcel.status,
      toStatus: 'reserved',
      userId: req.user.id,
      note: `Letter of Offer generated (${looRef}). Timed hold set for ${hours} hours (expires ${new Date(expiresAt).toLocaleString()}).`
    });

    res.json({
      success: true,
      message: `Plot reserved with ${hours}-hour hold window`,
      data: {
        reservationId: resResult.insertId,
        expiresAt,
        letterOfOfferRef: looRef,
        holdDurationHours: hours
      }
    });
  } catch (error) {
    logger.error('Reserve parcel hold error:', error);
    res.status(500).json({ success: false, message: 'Server error while reserving plot hold' });
  }
};

// @desc    Manually release hold early
// @route   POST /api/parcels/:id/release-hold
// @access  Private
const releaseParcelHold = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const parcelId = req.params.id;

    await db.query(
      "UPDATE parcel_reservations SET status = 'released', updated_at = CURRENT_TIMESTAMP WHERE parcel_id = ? AND tenant_id = ? AND status = 'active_hold'",
      [parcelId, tenantId]
    );

    await db.query(
      "UPDATE parcels SET status = 'available', reservation_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?",
      [parcelId, tenantId]
    );

    await recordStatusChange({
      tenantId,
      parcelId,
      fromStatus: 'reserved',
      toStatus: 'available',
      userId: req.user.id,
      note: 'Reservation hold released manually by agent/manager; plot returned to Available.'
    });

    res.json({ success: true, message: 'Plot hold released; status returned to Available' });
  } catch (error) {
    logger.error('Release parcel hold error:', error);
    res.status(500).json({ success: false, message: 'Server error while releasing plot hold' });
  }
};

// @desc    Convert reserved plot hold to confirmed sale
// @route   POST /api/parcels/:id/convert-sale
// @access  Private
const convertHoldToSale = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const parcelId = req.params.id;
    const { customerId, dealId, note } = req.body;

    await db.query(
      "UPDATE parcel_reservations SET status = 'converted_to_sale', updated_at = CURRENT_TIMESTAMP WHERE parcel_id = ? AND tenant_id = ? AND status = 'active_hold'",
      [parcelId, tenantId]
    );

    await db.query(
      `UPDATE parcels SET
         status = 'sold',
         reservation_expires_at = NULL,
         deal_id = COALESCE(?, deal_id),
         owner_customer_id = COALESCE(?, owner_customer_id),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [dealId || null, customerId || null, parcelId, tenantId]
    );

    await recordStatusChange({
      tenantId,
      parcelId,
      fromStatus: 'reserved',
      toStatus: 'sold',
      userId: req.user.id,
      note: note || 'Sale completed & deposit confirmed; plot permanently marked Sold.'
    });

    res.json({ success: true, message: 'Plot successfully confirmed as Sold' });
  } catch (error) {
    logger.error('Convert hold to sale error:', error);
    res.status(500).json({ success: false, message: 'Server error while confirming plot sale' });
  }
};

module.exports = {
  getPlotMatrix,
  reserveParcelWithHold,
  releaseParcelHold,
  convertHoldToSale,
  getParcels,
  getParcel,
  createParcel,
  updateParcel,
  deleteParcel
};
