const { InputValidationError } = require('../utils/errors');

/** Compounding periods per year for each supported frequency. */
const PERIODS_PER_YEAR = Object.freeze({
  daily: 365,
  weekly: 52,
  monthly: 12,
  annually: 1
});

/** Days per year used to convert day-based durations (no leap years). */
const DAYS_PER_YEAR = 365;

const DURATION_UNITS = Object.freeze(['days', 'years']);
const RATE_TYPES = Object.freeze(['nominal', 'effective']);

const LIMITS = Object.freeze({
  MAX_PRINCIPAL: 1e12,
  MAX_APY_PERCENT: 1000,
  MAX_DURATION_YEARS: 100,
  MAX_TOKEN_PRICE: 1e9
});

const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Validates a raw staking request and returns a normalised copy.
 * All problems are collected so the caller can fix them in one round trip.
 *
 * @param {unknown} body  Untrusted input (e.g. a parsed JSON body).
 * @returns {{
 *   principal: number, apy: number, duration: number,
 *   durationUnit: 'days'|'years', compoundingFrequency: string,
 *   rateType: 'nominal'|'effective', tokenPrice: number|null
 * }}
 * @throws {InputValidationError}
 */
const validateStakingInput = (body) => {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new InputValidationError('Request body must be a JSON object.', [
      { field: 'body', message: 'Expected a JSON object.' }
    ]);
  }

  const errors = [];
  const fail = (field, message) => errors.push({ field, message });

  const {
    principal,
    apy,
    duration,
    durationUnit,
    compoundingFrequency,
    rateType = 'nominal',
    tokenPrice
  } = body;

  if (!isFiniteNumber(principal)) {
    fail('principal', 'principal is required and must be a number.');
  } else if (principal <= 0 || principal > LIMITS.MAX_PRINCIPAL) {
    fail(
      'principal',
      `principal must be greater than 0 and at most ${LIMITS.MAX_PRINCIPAL}.`
    );
  }

  if (!isFiniteNumber(apy)) {
    fail('apy', 'apy is required and must be a number (percent, e.g. 5).');
  } else if (apy < 0 || apy > LIMITS.MAX_APY_PERCENT) {
    fail('apy', `apy must be between 0 and ${LIMITS.MAX_APY_PERCENT} percent.`);
  }

  if (!DURATION_UNITS.includes(durationUnit)) {
    fail('durationUnit', `durationUnit must be one of: ${DURATION_UNITS.join(', ')}.`);
  }

  if (!isFiniteNumber(duration)) {
    fail('duration', 'duration is required and must be a number.');
  } else if (duration <= 0) {
    fail('duration', 'duration must be greater than 0.');
  } else if (DURATION_UNITS.includes(durationUnit)) {
    const years = durationUnit === 'days' ? duration / DAYS_PER_YEAR : duration;
    if (years > LIMITS.MAX_DURATION_YEARS) {
      fail(
        'duration',
        `duration must not exceed ${LIMITS.MAX_DURATION_YEARS} years.`
      );
    }
  }

  if (!Object.prototype.hasOwnProperty.call(PERIODS_PER_YEAR, compoundingFrequency)) {
    fail(
      'compoundingFrequency',
      `compoundingFrequency must be one of: ${Object.keys(PERIODS_PER_YEAR).join(', ')}.`
    );
  }

  if (!RATE_TYPES.includes(rateType)) {
    fail('rateType', `rateType must be one of: ${RATE_TYPES.join(', ')}.`);
  }

  let normalisedPrice = null;
  if (tokenPrice !== undefined && tokenPrice !== null && tokenPrice !== '') {
    if (!isFiniteNumber(tokenPrice)) {
      fail('tokenPrice', 'tokenPrice must be a number when provided.');
    } else if (tokenPrice < 0 || tokenPrice > LIMITS.MAX_TOKEN_PRICE) {
      fail(
        'tokenPrice',
        `tokenPrice must be between 0 and ${LIMITS.MAX_TOKEN_PRICE}.`
      );
    } else {
      normalisedPrice = tokenPrice;
    }
  }

  if (errors.length > 0) {
    throw new InputValidationError(errors[0].message, errors);
  }

  return {
    principal,
    apy,
    duration,
    durationUnit,
    compoundingFrequency,
    rateType,
    tokenPrice: normalisedPrice
  };
};

module.exports = {
  validateStakingInput,
  PERIODS_PER_YEAR,
  DAYS_PER_YEAR,
  DURATION_UNITS,
  RATE_TYPES,
  LIMITS
};
