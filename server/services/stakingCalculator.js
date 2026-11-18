const { InputValidationError } = require('../utils/errors');
const {
  validateStakingInput,
  PERIODS_PER_YEAR,
  DAYS_PER_YEAR
} = require('../validation/stakingInput');

/** Number of intervals in the chart series (the series has CHART_INTERVALS + 1 points). */
const CHART_INTERVALS = 60;

/** Output precision; avoids float noise like 1051.2674964674473 in responses. */
const DECIMALS = 8;
const round = (value, decimals = DECIMALS) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/**
 * Rate applied per compounding period.
 *
 * - nominal:   i = r / n                 (the textbook A = P(1 + r/n)^(nt))
 * - effective: i = (1 + r)^(1/n) - 1     (r is the effective annual yield)
 *
 * With an effective rate, (1 + i)^n = 1 + r exactly, so the final balance is
 * P(1 + r)^t regardless of frequency; frequency then only shapes the curve.
 * expm1/log1p keep precision for small rates.
 */
const periodicRate = (rate, periodsPerYear, rateType) =>
  rateType === 'effective'
    ? Math.expm1(Math.log1p(rate) / periodsPerYear)
    : rate / periodsPerYear;

/** Balance after `years` years: P * (1 + i)^(n * years). O(1). */
const balanceAfter = (principal, ratePerPeriod, periodsPerYear, years) =>
  principal * Math.pow(1 + ratePerPeriod, periodsPerYear * years);

const toYears = (duration, unit) =>
  unit === 'days' ? duration / DAYS_PER_YEAR : duration;

/**
 * Compound-interest staking projection.
 *
 * Rate convention (documented API contract): `apy` is a percentage. By default
 * it is treated as a NOMINAL annual rate compounded `n` times per year, which
 * is the formula in the brief. Pass `rateType: 'effective'` to treat it as an
 * effective annual yield instead. The response always reports both.
 *
 * Fractional durations (e.g. 1.5 years) use a fractional exponent n*t, i.e. the
 * final partial period accrues pro rata.
 *
 * Complexity: the summary is O(1); the chart series is O(k) time and O(k)
 * space for k = CHART_INTERVALS + 1 points.
 *
 * @param {object} rawInput  Untrusted request-shaped input; validated here.
 * @returns {object} Summary, normalised duration and chart series.
 * @throws {InputValidationError} on invalid, out-of-range or overflowing input.
 */
const calculateStakingRewards = (rawInput) => {
  const input = validateStakingInput(rawInput);
  const { principal, tokenPrice, rateType } = input;

  const periodsPerYear = PERIODS_PER_YEAR[input.compoundingFrequency];
  const rate = input.apy / 100;
  const years = toYears(input.duration, input.durationUnit);
  const i = periodicRate(rate, periodsPerYear, rateType);

  const finalBalance = balanceAfter(principal, i, periodsPerYear, years);
  if (!Number.isFinite(finalBalance)) {
    throw new InputValidationError(
      'Inputs are too large: the projected balance exceeds the supported range.',
      [{ field: 'apy', message: 'Reduce apy or duration.' }]
    );
  }

  const chartData = [];
  for (let step = 0; step <= CHART_INTERVALS; step += 1) {
    // Use the exact duration for the last point to avoid float drift.
    const t = step === CHART_INTERVALS ? years : (years * step) / CHART_INTERVALS;
    const balance =
      step === CHART_INTERVALS
        ? finalBalance
        : balanceAfter(principal, i, periodsPerYear, t);
    const point = {
      years: round(t, 6),
      day: round(t * DAYS_PER_YEAR, 4),
      balance: round(balance),
      rewards: round(balance - principal)
    };
    if (tokenPrice !== null) {
      point.balanceUsd = round(balance * tokenPrice, 2);
    }
    chartData.push(point);
  }

  const totalRewards = finalBalance - principal;
  const effectiveApy = (Math.pow(1 + i, periodsPerYear) - 1) * 100;

  const result = {
    principal,
    apy: input.apy,
    rateType,
    compoundingFrequency: input.compoundingFrequency,
    periodsPerYear,
    duration: { value: input.duration, unit: input.durationUnit },
    normalizedDuration: {
      years: round(years, 6),
      days: round(years * DAYS_PER_YEAR, 4),
      periods: round(years * periodsPerYear, 6)
    },
    nominalRate: round(i * periodsPerYear * 100, 6),
    effectiveApy: round(effectiveApy, 6),
    finalBalance: round(finalBalance),
    totalRewards: round(totalRewards),
    chartData
  };

  if (tokenPrice !== null) {
    result.tokenPrice = tokenPrice;
    result.usd = {
      principal: round(principal * tokenPrice, 2),
      finalBalance: round(finalBalance * tokenPrice, 2),
      totalRewards: round(totalRewards * tokenPrice, 2)
    };
  }

  return result;
};

module.exports = { calculateStakingRewards, periodicRate, balanceAfter, CHART_INTERVALS };
