const fs = require('fs');
const path = require('path');

const controllerFile = path.join(__dirname, '../src/controllers/parcelController.js');
let controllerContent = fs.readFileSync(controllerFile, 'utf8');

const matrixMethods = `
// =========================================================================
// PLOT MATRIX STATE MACHINE & AUTOMATED RESERVATION EXPIRATION
// =========================================================================

async function autoExpireHolds(tenantId) {
  try {
    const expiredHolds = await db.query(
      \`SELECT r.id, r.parcel_id, p.title_ref, p.plot_number
       FROM parcel_reservations r
       JOIN parcels p ON r.parcel_id = p.id
       WHERE r.tenant_id = ? AND r.status = 'active_hold' AND r.expires_at <= datetime('now')\`,
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
        note: \`Timed reservation hold expired without deposit; plot automatically released back to Available.\`
      });
      logger.info(\`[Plot Matrix State Machine] Auto-released expired hold on parcel #\${hold.parcel_id} (\${hold.title_ref})\`);
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
      \`SELECT p.*,
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
       ORDER BY COALESCE(p.project_name, 'Phase 1'), p.plot_number ASC, p.id ASC\`,
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
        plotNumber: p.plot_number || \`Plot #\${p.id}\`,
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
          clientName: p.reserving_client_first_name ? \`\${p.reserving_client_first_name} \${p.reserving_client_last_name || ''}\`.trim() : 'Prospective Buyer',
          clientPhone: p.reserving_client_phone
        } : null
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
    const looRef = letterOfOfferRef || \`LOO-\${Date.now().toString(36).toUpperCase()}\`;

    // Cancel any previous active hold for this parcel
    await db.query(
      "UPDATE parcel_reservations SET status = 'cancelled' WHERE parcel_id = ? AND tenant_id = ? AND status = 'active_hold'",
      [parcelId, tenantId]
    );

    // Create reservation record
    const resResult = await db.query(
      \`INSERT INTO parcel_reservations (
        tenant_id, parcel_id, customer_id, deal_id, letter_of_offer_ref,
        hold_duration_hours, expires_at, status, deposit_required_kes, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active_hold', ?, ?, ?)\`,
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
      \`UPDATE parcels SET
         status = 'reserved',
         reservation_expires_at = ?,
         deal_id = COALESCE(?, deal_id),
         owner_customer_id = COALESCE(?, owner_customer_id),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?\`,
      [expiresAt, dealId || null, customerId || null, parcelId, tenantId]
    );

    await recordStatusChange({
      tenantId,
      parcelId,
      fromStatus: parcel.status,
      toStatus: 'reserved',
      userId: req.user.id,
      note: \`Letter of Offer generated (\${looRef}). Timed hold set for \${hours} hours (expires \${new Date(expiresAt).toLocaleString()}).\`
    });

    res.json({
      success: true,
      message: \`Plot reserved with \${hours}-hour hold window\`,
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
      \`UPDATE parcels SET
         status = 'sold',
         reservation_expires_at = NULL,
         deal_id = COALESCE(?, deal_id),
         owner_customer_id = COALESCE(?, owner_customer_id),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?\`,
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
`;

// Insert autoExpireHolds into getParcels
if (!controllerContent.includes('await autoExpireHolds(req.user.tenant_id);')) {
  controllerContent = controllerContent.replace(
    'const getParcels = async (req, res) => {\r\n  try {',
    'const getParcels = async (req, res) => {\r\n  try {\r\n    await autoExpireHolds(req.user.tenant_id);'
  );
  if (!controllerContent.includes('await autoExpireHolds(req.user.tenant_id);')) {
    controllerContent = controllerContent.replace(
      'const getParcels = async (req, res) => {\n  try {',
      'const getParcels = async (req, res) => {\n  try {\n    await autoExpireHolds(req.user.tenant_id);'
    );
  }
}

// Append methods before module.exports
const exportNeedle = 'module.exports = {';
const exportReplacement = matrixMethods + '\r\nmodule.exports = {\r\n  getPlotMatrix,\r\n  reserveParcelWithHold,\r\n  releaseParcelHold,\r\n  convertHoldToSale,';
controllerContent = controllerContent.replace(exportNeedle, exportReplacement);

fs.writeFileSync(controllerFile, controllerContent, 'utf8');
console.log('Successfully enhanced parcelController.js with Plot Matrix State Machine!');

// Now update routes/parcels.js
const routesFile = path.join(__dirname, '../src/routes/parcels.js');
let routesContent = fs.readFileSync(routesFile, 'utf8');

const routeImportNeedle = '  deleteParcel\r\n} = require(\'../controllers/parcelController\');';
const routeImportReplacement = '  deleteParcel,\r\n  getPlotMatrix,\r\n  reserveParcelWithHold,\r\n  releaseParcelHold,\r\n  convertHoldToSale\r\n} = require(\'../controllers/parcelController\');';
routesContent = routesContent.replace(routeImportNeedle, routeImportReplacement);
if (!routesContent.includes('getPlotMatrix')) {
  routesContent = routesContent.replace(
    '  deleteParcel\n} = require(\'../controllers/parcelController\');',
    '  deleteParcel,\n  getPlotMatrix,\n  reserveParcelWithHold,\n  releaseParcelHold,\n  convertHoldToSale\n} = require(\'../controllers/parcelController\');'
  );
}

const matrixRoutes = `
// Plot Matrix endpoints
router.get('/matrix/overview', getPlotMatrix);
router.post('/:id/hold', reserveParcelWithHold);
router.post('/:id/release-hold', releaseParcelHold);
router.post('/:id/convert-sale', convertHoldToSale);
`;

if (!routesContent.includes('/matrix/overview')) {
  routesContent = routesContent.replace('router.route(\'/\')', matrixRoutes + '\r\nrouter.route(\'/\')');
}

fs.writeFileSync(routesFile, routesContent, 'utf8');
console.log('Successfully updated routes/parcels.js with matrix routes!');
