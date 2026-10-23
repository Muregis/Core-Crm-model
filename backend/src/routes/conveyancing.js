const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getConveyancingMatters,
  createConveyancingMatter,
  updateConveyancingStage
} = require('../controllers/conveyancingController');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getConveyancingMatters)
  .post(createConveyancingMatter);

router.route('/:id/stage')
  .put(updateConveyancingStage);

module.exports = router;
