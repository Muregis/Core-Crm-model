const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Placeholder routes - to be implemented
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Deals endpoint - Coming soon' });
});

module.exports = router;
