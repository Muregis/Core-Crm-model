const db = require('../config/database');
const logger = require('../utils/logger');

const ALLOWED_STATUSES = new Set(['active', 'pending_hearing', 'closed', 'on_hold']);
const ALLOWED_BILLING = new Set(['fixed_fee', 'hourly', 'retainer', 'pro_bono']);

// @desc    Get all matters for tenant
// @route   GET /api/matters
// @access  Private
const getMatters = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      practiceArea,
      clientId,
      q,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE m.tenant_id = ?';
    const params = [req.user.tenant_id];

    if (status) {
      where += ' AND m.status = ?';
      params.push(String(status));
    }
    if (practiceArea) {
      where += ' AND m.practice_area = ?';
      params.push(String(practiceArea));
    }
    if (clientId) {
      where += ' AND m.client_id = ?';
      params.push(parseInt(clientId, 10));
    }
    if (q) {
      where += ' AND (m.title LIKE ? OR m.case_number LIKE ? OR m.court_name LIKE ? OR m.opposing_party LIKE ?)';
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }

    const countSql = `SELECT COUNT(*) as count FROM matters m ${where}`;
    const totalRecords = await db.query(countSql, params);
    const total = totalRecords[0]?.count || 0;

    const dataSql = `
      SELECT m.*,
        (c.first_name || ' ' || c.last_name) as client_name,
        c.phone as client_phone,
        c.company_name as client_company,
        (u.first_name || ' ' || u.last_name) as advocate_name
      FROM matters m
      LEFT JOIN customers c ON m.client_id = c.id
      LEFT JOIN users u ON m.assigned_advocate_id = u.id
      ${where}
      ORDER BY m.next_hearing_date ASC, m.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const matters = await db.query(dataSql, [...params, limitNum, offset]);

    res.json({
      success: true,
      data: {
        matters,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching matters:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching legal matters' });
  }
};

// @desc    Get single matter with time entries
// @route   GET /api/matters/:id
// @access  Private
const getMatter = async (req, res) => {
  try {
    const matterId = parseInt(req.params.id, 10);
    const matters = await db.query(
      `SELECT m.*,
        (c.first_name || ' ' || c.last_name) as client_name,
        c.phone as client_phone,
        c.email as client_email,
        c.company_name as client_company,
        (u.first_name || ' ' || u.last_name) as advocate_name
       FROM matters m
       LEFT JOIN customers c ON m.client_id = c.id
       LEFT JOIN users u ON m.assigned_advocate_id = u.id
       WHERE m.id = ? AND m.tenant_id = ?`,
      [matterId, req.user.tenant_id]
    );

    if (matters.length === 0) {
      return res.status(404).json({ success: false, message: 'Matter not found' });
    }

    const timeEntries = await db.query(
      `SELECT t.*, (u.first_name || ' ' || u.last_name) as logger_name
       FROM matter_time_entries t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.matter_id = ? AND t.tenant_id = ?
       ORDER BY t.date DESC, t.created_at DESC`,
      [matterId, req.user.tenant_id]
    );

    res.json({
      success: true,
      data: {
        matter: matters[0],
        timeEntries
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching matter details' });
  }
};

// @desc    Create new legal matter
// @route   POST /api/matters
// @access  Private
const createMatter = async (req, res) => {
  try {
    const {
      caseNumber,
      title,
      clientId,
      practiceArea = 'Conveyancing & Land Law',
      courtName,
      courtLevel,
      courtStation,
      coramTitle,
      partyRole = 'Plaintiff',
      opposingRole = 'Defendant',
      hearingPurpose,
      judgeOrArbitrator,
      opposingParty,
      opposingCounsel,
      billingType = 'fixed_fee',
      feeAmountKes,
      disbursementsKes,
      vatAmountKes,
      aroScale,
      hourlyRateKes,
      priority = 'medium',
      nextHearingDate,
      filingDeadline,
      assignedAdvocateId,
      notes
    } = req.body;

    if (!title || !clientId) {
      return res.status(400).json({
        success: false,
        message: 'Matter title and client ID are required'
      });
    }

    const parsedFee = feeAmountKes ? parseFloat(feeAmountKes) : null;
    const parsedDisbursements = disbursementsKes ? parseFloat(disbursementsKes) : 0;
    const calculatedVat = vatAmountKes !== undefined && vatAmountKes !== null && vatAmountKes !== ''
      ? parseFloat(vatAmountKes)
      : (parsedFee ? parseFloat((parsedFee * 0.16).toFixed(2)) : 0);

    const result = await db.query(
      `INSERT INTO matters (
        tenant_id, case_number, title, client_id, practice_area,
        court_name, court_level, court_station, coram_title, party_role, opposing_role, hearing_purpose,
        judge_or_arbitrator, opposing_party, opposing_counsel,
        billing_type, fee_amount_kes, disbursements_kes, vat_amount_kes, aro_scale, hourly_rate_kes,
        status, priority,
        next_hearing_date, filing_deadline, assigned_advocate_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      [
        req.user.tenant_id,
        caseNumber || null,
        title.trim(),
        parseInt(clientId, 10),
        practiceArea,
        courtName || null,
        courtLevel || null,
        courtStation || null,
        coramTitle || null,
        partyRole || 'Plaintiff',
        opposingRole || 'Defendant',
        hearingPurpose || null,
        judgeOrArbitrator || null,
        opposingParty || null,
        opposingCounsel || null,
        ALLOWED_BILLING.has(billingType) ? billingType : 'fixed_fee',
        parsedFee,
        parsedDisbursements,
        calculatedVat,
        aroScale || null,
        hourlyRateKes ? parseFloat(hourlyRateKes) : null,
        priority,
        nextHearingDate || null,
        filingDeadline || null,
        assignedAdvocateId ? parseInt(assignedAdvocateId, 10) : req.user.id,
        notes || null
      ]
    );

    logger.info(`Legal Matter created: ${title} (#${result.insertId}) for tenant ${req.user.tenant_id}`);

    res.status(201).json({
      success: true,
      message: 'Legal matter opened successfully',
      data: { matterId: result.insertId }
    });
  } catch (error) {
    logger.error('Error creating matter:', error);
    res.status(500).json({ success: false, message: 'Server error while creating legal matter' });
  }
};

// @desc    Update legal matter
// @route   PUT /api/matters/:id
// @access  Private
const updateMatter = async (req, res) => {
  try {
    const matterId = parseInt(req.params.id, 10);
    const existing = await db.query(
      'SELECT id FROM matters WHERE id = ? AND tenant_id = ?',
      [matterId, req.user.tenant_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Matter not found' });
    }

    const {
      caseNumber,
      title,
      practiceArea,
      courtName,
      courtLevel,
      courtStation,
      coramTitle,
      partyRole,
      opposingRole,
      hearingPurpose,
      judgeOrArbitrator,
      opposingParty,
      opposingCounsel,
      billingType,
      feeAmountKes,
      disbursementsKes,
      vatAmountKes,
      aroScale,
      hourlyRateKes,
      status,
      priority,
      nextHearingDate,
      filingDeadline,
      assignedAdvocateId,
      notes
    } = req.body;

    await db.query(
      `UPDATE matters SET
        case_number = COALESCE(?, case_number),
        title = COALESCE(?, title),
        practice_area = COALESCE(?, practice_area),
        court_name = COALESCE(?, court_name),
        court_level = COALESCE(?, court_level),
        court_station = COALESCE(?, court_station),
        coram_title = COALESCE(?, coram_title),
        party_role = COALESCE(?, party_role),
        opposing_role = COALESCE(?, opposing_role),
        hearing_purpose = COALESCE(?, hearing_purpose),
        judge_or_arbitrator = COALESCE(?, judge_or_arbitrator),
        opposing_party = COALESCE(?, opposing_party),
        opposing_counsel = COALESCE(?, opposing_counsel),
        billing_type = COALESCE(?, billing_type),
        fee_amount_kes = COALESCE(?, fee_amount_kes),
        disbursements_kes = COALESCE(?, disbursements_kes),
        vat_amount_kes = COALESCE(?, vat_amount_kes),
        aro_scale = COALESCE(?, aro_scale),
        hourly_rate_kes = COALESCE(?, hourly_rate_kes),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        next_hearing_date = COALESCE(?, next_hearing_date),
        filing_deadline = COALESCE(?, filing_deadline),
        assigned_advocate_id = COALESCE(?, assigned_advocate_id),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [
        caseNumber !== undefined ? caseNumber : null,
        title !== undefined ? title : null,
        practiceArea !== undefined ? practiceArea : null,
        courtName !== undefined ? courtName : null,
        courtLevel !== undefined ? courtLevel : null,
        courtStation !== undefined ? courtStation : null,
        coramTitle !== undefined ? coramTitle : null,
        partyRole !== undefined ? partyRole : null,
        opposingRole !== undefined ? opposingRole : null,
        hearingPurpose !== undefined ? hearingPurpose : null,
        judgeOrArbitrator !== undefined ? judgeOrArbitrator : null,
        opposingParty !== undefined ? opposingParty : null,
        opposingCounsel !== undefined ? opposingCounsel : null,
        billingType !== undefined ? billingType : null,
        feeAmountKes !== undefined && feeAmountKes !== '' ? parseFloat(feeAmountKes) : null,
        disbursementsKes !== undefined && disbursementsKes !== '' ? parseFloat(disbursementsKes) : null,
        vatAmountKes !== undefined && vatAmountKes !== '' ? parseFloat(vatAmountKes) : null,
        aroScale !== undefined ? aroScale : null,
        hourlyRateKes !== undefined && hourlyRateKes !== '' ? parseFloat(hourlyRateKes) : null,
        status !== undefined ? status : null,
        priority !== undefined ? priority : null,
        nextHearingDate !== undefined ? nextHearingDate : null,
        filingDeadline !== undefined ? filingDeadline : null,
        assignedAdvocateId !== undefined ? (assignedAdvocateId ? parseInt(assignedAdvocateId, 10) : null) : null,
        notes !== undefined ? notes : null,
        matterId,
        req.user.tenant_id
      ]
    );

    res.json({ success: true, message: 'Matter updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating matter' });
  }
};

// @desc    Log time entry for matter
// @route   POST /api/matters/:id/time-entries
// @access  Private
const logTimeEntry = async (req, res) => {
  try {
    const matterId = parseInt(req.params.id, 10);
    const { activityType = 'drafting', durationMinutes, hourlyRateKes, date, description } = req.body;

    if (!durationMinutes) {
      return res.status(400).json({ success: false, message: 'Duration in minutes is required' });
    }

    const matters = await db.query(
      'SELECT id, hourly_rate_kes FROM matters WHERE id = ? AND tenant_id = ?',
      [matterId, req.user.tenant_id]
    );
    if (matters.length === 0) {
      return res.status(404).json({ success: false, message: 'Matter not found' });
    }

    const rate = hourlyRateKes ? parseFloat(hourlyRateKes) : (matters[0].hourly_rate_kes || 0);
    const billableAmount = (parseFloat(durationMinutes) / 60) * rate;

    const result = await db.query(
      `INSERT INTO matter_time_entries (
        tenant_id, matter_id, user_id, activity_type, duration_minutes,
        hourly_rate_kes, billable_amount_kes, date, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.tenant_id,
        matterId,
        req.user.id,
        activityType,
        parseInt(durationMinutes, 10),
        rate,
        billableAmount,
        date || new Date().toISOString().split('T')[0],
        description || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Time entry recorded',
      data: { timeEntryId: result.insertId, billableAmount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error logging time entry' });
  }
};

// @desc    Delete matter
// @route   DELETE /api/matters/:id
// @access  Private
const deleteMatter = async (req, res) => {
  try {
    const matterId = parseInt(req.params.id, 10);
    await db.query(
      'DELETE FROM matters WHERE id = ? AND tenant_id = ?',
      [matterId, req.user.tenant_id]
    );

    res.json({ success: true, message: 'Matter deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting matter' });
  }
};

module.exports = {
  getMatters,
  getMatter,
  createMatter,
  updateMatter,
  logTimeEntry,
  deleteMatter
};
