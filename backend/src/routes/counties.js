const express = require('express');
const { protect } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// All routes are protected
router.use(protect);

// @desc    Get all counties
// @route   GET /api/counties
// @access  Private
router.get('/', async (req, res) => {
  try {
    const counties = await db.query(
      'SELECT id, name, code FROM counties ORDER BY name'
    );

    res.json({
      success: true,
      data: { counties }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching counties'
    });
  }
});

// @desc    Get sub-counties for a county
// @route   GET /api/counties/:countyId/sub-counties
// @access  Private
router.get('/:countyId/sub-counties', async (req, res) => {
  try {
    const { countyId } = req.params;

    const subCounties = await db.query(
      'SELECT id, name FROM sub_counties WHERE county_id = ? ORDER BY name',
      [countyId]
    );

    res.json({
      success: true,
      data: { subCounties }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sub-counties'
    });
  }
});

// @desc    Get business categories
// @route   GET /api/counties/business-categories
// @access  Private
router.get('/business-categories', async (req, res) => {
  try {
    const categories = await db.query(
      'SELECT id, name, description FROM business_categories ORDER BY name'
    );

    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error while fetching business categories'
    });
  }
});

module.exports = router;
