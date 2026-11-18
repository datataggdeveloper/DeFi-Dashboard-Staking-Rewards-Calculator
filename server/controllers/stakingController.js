const { calculateStakingRewards } = require('../services/stakingCalculator');

// @desc     Calculate projected staking rewards
// Thin by design: the service validates and computes, errors flow to the
// centralized error handler.
const calculateRewards = (req, res, next) => {
  try {
    res.json(calculateStakingRewards(req.body));
  } catch (err) {
    next(err);
  }
};

module.exports = { calculateRewards };
