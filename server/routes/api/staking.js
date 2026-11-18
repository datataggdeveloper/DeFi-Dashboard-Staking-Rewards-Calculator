const express = require('express');
const router = express.Router();
const { calculateRewards } = require('../../controllers/stakingController');

// @route    POST api/calculate-rewards
// @desc     Project staking rewards using compound interest
// @access   Public
router.post('/', calculateRewards);

module.exports = router;
