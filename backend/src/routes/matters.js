const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getMatters,
  getMatter,
  createMatter,
  updateMatter,
  logTimeEntry,
  deleteMatter
} = require('../controllers/matterController');

const router = express.Router();

router.use(protect);

router.get('/', getMatters);
router.get('/:id', getMatter);
router.post('/', createMatter);
router.put('/:id', updateMatter);
router.post('/:id/time-entries', logTimeEntry);
router.delete('/:id', deleteMatter);

module.exports = router;
