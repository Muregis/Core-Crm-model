const db = require('../config/database');
const logger = require('../utils/logger');

const CONVEYANCING_STAGES = [
  'search_due_diligence',
  'beacon_mutation',
  'lcb_consent',
  'stamp_duty_valuation',
  'title_issuance_handover'
];

// @desc    Get all conveyancing cases with regulatory milestones
// @route   GET /api/conveyancing
// @access  Private
const getConveyancingMatters = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { stage, parcelId, customerId } = req.query;

    let where = 'WHERE cm.tenant_id = ?';
    const params = [tenantId];

    if (stage) {
      where += ' AND cm.stage = ?';
      params.push(stage);
    }
    if (parcelId) {
      where += ' AND cm.parcel_id = ?';
      params.push(Number(parcelId));
    }
    if (customerId) {
      where += ' AND cm.customer_id = ?';
      params.push(Number(customerId));
    }

    const cases = await db.query(
      `SELECT cm.*,
              p.title_ref,
              p.plot_number,
              p.name AS parcel_name,
              p.county,
              p.size_acres,
              c.first_name AS client_first_name,
              c.last_name AS client_last_name,
              c.company_name AS client_company_name,
              c.phone AS client_phone,
              d.title AS deal_title,
              d.value AS deal_value,
              (u.first_name || ' ' || u.last_name) AS advocate_name
       FROM conveyancing_matters cm
       LEFT JOIN parcels p ON cm.parcel_id = p.id
       LEFT JOIN customers c ON cm.customer_id = c.id
       LEFT JOIN deals d ON cm.deal_id = d.id
       LEFT JOIN users u ON cm.assigned_advocate_id = u.id
       ${where}
       ORDER BY cm.updated_at DESC`,
      params
    );

    // Compute stage counts for Kanban headers
    const counts = {
      search_due_diligence: 0,
      beacon_mutation: 0,
      lcb_consent: 0,
      stamp_duty_valuation: 0,
      title_issuance_handover: 0
    };
    for (const c of cases) {
      if (counts[c.stage] !== undefined) {
        counts[c.stage] += 1;
      }
    }

    res.json({
      success: true,
      data: {
        cases,
        stageCounts: counts
      }
    });
  } catch (error) {
    logger.error('Get conveyancing matters error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching conveyancing matters' });
  }
};

// @desc    Initiate a conveyancing regulatory file
// @route   POST /api/conveyancing
// @access  Private
const createConveyancingMatter = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const {
      parcelId,
      customerId,
      dealId,
      stage = 'search_due_diligence',
      searchRef,
      beaconCertNumber,
      lcbBoardName,
      assignedAdvocateId,
      notes
    } = req.body;

    if (!parcelId || !customerId) {
      return res.status(400).json({ success: false, message: 'Parcel and Customer are required' });
    }

    const result = await db.query(
      `INSERT INTO conveyancing_matters (
        tenant_id, parcel_id, customer_id, deal_id, stage,
        search_ref, beacon_cert_number, lcb_board_name,
        assigned_advocate_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        parcelId,
        customerId,
        dealId || null,
        stage,
        searchRef || null,
        beaconCertNumber || null,
        lcbBoardName || null,
        assignedAdvocateId || null,
        notes || null
      ]
    );

    const created = await db.query('SELECT * FROM conveyancing_matters WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Conveyancing case registered',
      data: { matter: created[0] }
    });
  } catch (error) {
    logger.error('Create conveyancing matter error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating conveyancing case' });
  }
};

// @desc    Update conveyancing milestone stage & legal evidence
// @route   PUT /api/conveyancing/:id/stage
// @access  Private
const updateConveyancingStage = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const id = req.params.id;
    const {
      stage,
      searchRef,
      searchStatus,
      beaconCertNumber,
      mutationFormRef,
      lcbBoardName,
      lcbHearingDate,
      lcbConsentRef,
      valuationAmountKes,
      stampDutyAmountKes,
      cgtClearanceRef,
      titleDeedNumber,
      titleCollectionDate,
      assignedAdvocateId,
      notes
    } = req.body;

    if (stage && !CONVEYANCING_STAGES.includes(stage)) {
      return res.status(400).json({ success: false, message: 'Invalid conveyancing regulatory stage' });
    }

    const existing = await db.query('SELECT * FROM conveyancing_matters WHERE id = ? AND tenant_id = ?', [
      id,
      tenantId
    ]);

    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Conveyancing case not found' });
    }

    await db.query(
      `UPDATE conveyancing_matters SET
         stage = COALESCE(?, stage),
         search_ref = COALESCE(?, search_ref),
         search_status = COALESCE(?, search_status),
         beacon_cert_number = COALESCE(?, beacon_cert_number),
         mutation_form_ref = COALESCE(?, mutation_form_ref),
         lcb_board_name = COALESCE(?, lcb_board_name),
         lcb_hearing_date = COALESCE(?, lcb_hearing_date),
         lcb_consent_ref = COALESCE(?, lcb_consent_ref),
         valuation_amount_kes = COALESCE(?, valuation_amount_kes),
         stamp_duty_amount_kes = COALESCE(?, stamp_duty_amount_kes),
         cgt_clearance_ref = COALESCE(?, cgt_clearance_ref),
         title_deed_number = COALESCE(?, title_deed_number),
         title_collection_date = COALESCE(?, title_collection_date),
         assigned_advocate_id = COALESCE(?, assigned_advocate_id),
         notes = COALESCE(?, notes),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [
        stage || null,
        searchRef || null,
        searchStatus || null,
        beaconCertNumber || null,
        mutationFormRef || null,
        lcbBoardName || null,
        lcbHearingDate || null,
        lcbConsentRef || null,
        valuationAmountKes !== undefined ? parseFloat(valuationAmountKes) : null,
        stampDutyAmountKes !== undefined ? parseFloat(stampDutyAmountKes) : null,
        cgtClearanceRef || null,
        titleDeedNumber || null,
        titleCollectionDate || null,
        assignedAdvocateId || null,
        notes || null,
        id,
        tenantId
      ]
    );

    const updated = await db.query('SELECT * FROM conveyancing_matters WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Conveyancing stage & documentation updated',
      data: { matter: updated[0] }
    });
  } catch (error) {
    logger.error('Update conveyancing stage error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating conveyancing case' });
  }
};

module.exports = {
  getConveyancingMatters,
  createConveyancingMatter,
  updateConveyancingStage
};
