const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateStakingRewards,
  CHART_INTERVALS
} = require('../services/stakingCalculator');
const { InputValidationError } = require('../utils/errors');

const base = {
  principal: 1000,
  apy: 5,
  duration: 365,
  durationUnit: 'days',
  compoundingFrequency: 'daily'
};

const close = (actual, expected, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );

const rejects = (input, field) => {
  try {
    calculateStakingRewards(input);
  } catch (err) {
    assert.ok(err instanceof InputValidationError, 'wrong error type');
    assert.ok(
      err.details.some((d) => d.field === field),
      `expected a problem on "${field}", got ${JSON.stringify(err.details)}`
    );
    return;
  }
  assert.fail(`expected input to be rejected: ${JSON.stringify(input)}`);
};

test('daily compounding (nominal) matches the textbook value', () => {
  const r = calculateStakingRewards(base);
  close(r.finalBalance, 1051.26749647, 1e-6);
  close(r.totalRewards, 51.26749647, 1e-6);
  close(r.effectiveApy, 5.126749, 1e-4);
});

test('annual compounding over one year is simple 5%', () => {
  const r = calculateStakingRewards({ ...base, compoundingFrequency: 'annually' });
  close(r.finalBalance, 1050);
});

test('monthly compounding over one year', () => {
  const r = calculateStakingRewards({ ...base, compoundingFrequency: 'monthly' });
  close(r.finalBalance, 1051.16189788, 1e-6);
});

test('weekly compounding agrees with an independent evaluation of the formula', () => {
  const r = calculateStakingRewards({ ...base, compoundingFrequency: 'weekly' });
  close(r.finalBalance, 1000 * Math.pow(1 + 0.05 / 52, 52), 1e-6);
});

test('more frequent compounding never yields less (nominal rate)', () => {
  const balance = (compoundingFrequency) =>
    calculateStakingRewards({ ...base, compoundingFrequency }).finalBalance;
  assert.ok(balance('annually') < balance('monthly'));
  assert.ok(balance('monthly') < balance('weekly'));
  assert.ok(balance('weekly') < balance('daily'));
});

test('fractional duration: 1.5 years', () => {
  const r = calculateStakingRewards({
    ...base,
    duration: 1.5,
    durationUnit: 'years',
    compoundingFrequency: 'monthly',
    apy: 10
  });
  close(r.finalBalance, 1000 * Math.pow(1 + 0.1 / 12, 18), 1e-6);
  assert.equal(r.normalizedDuration.years, 1.5);
  assert.equal(r.normalizedDuration.periods, 18);
});

test('days and years describe the same duration', () => {
  const inDays = calculateStakingRewards({ ...base, duration: 730 });
  const inYears = calculateStakingRewards({
    ...base,
    duration: 2,
    durationUnit: 'years'
  });
  close(inDays.finalBalance, inYears.finalBalance, 1e-9);
  assert.equal(inDays.normalizedDuration.years, 2);
});

test('zero APY returns the principal with no rewards', () => {
  const r = calculateStakingRewards({ ...base, apy: 0 });
  assert.equal(r.finalBalance, 1000);
  assert.equal(r.totalRewards, 0);
  assert.ok(r.chartData.every((p) => p.balance === 1000 && p.rewards === 0));
});

test('effective APY: one year yields exactly the quoted APY for every frequency', () => {
  for (const compoundingFrequency of ['daily', 'weekly', 'monthly', 'annually']) {
    const r = calculateStakingRewards({
      ...base,
      compoundingFrequency,
      rateType: 'effective'
    });
    close(r.finalBalance, 1050, 1e-6);
    close(r.effectiveApy, 5, 1e-6);
  }
});

test('effective APY over fractional time follows P(1+APY)^t', () => {
  const r = calculateStakingRewards({
    ...base,
    apy: 8,
    duration: 2.5,
    durationUnit: 'years',
    rateType: 'effective'
  });
  close(r.finalBalance, 1000 * Math.pow(1.08, 2.5), 1e-6);
});

test('chart series starts at the principal, ends at the final balance and is monotonic', () => {
  const r = calculateStakingRewards(base);
  assert.equal(r.chartData.length, CHART_INTERVALS + 1);
  assert.equal(r.chartData[0].balance, 1000);
  assert.equal(r.chartData[0].years, 0);
  const last = r.chartData[r.chartData.length - 1];
  assert.equal(last.balance, r.finalBalance);
  assert.equal(last.years, 1);
  for (let i = 1; i < r.chartData.length; i += 1) {
    assert.ok(r.chartData[i].balance >= r.chartData[i - 1].balance);
  }
});

test('token price adds USD projections; omitted price does not', () => {
  const withPrice = calculateStakingRewards({ ...base, tokenPrice: 2.5 });
  close(withPrice.usd.finalBalance, 2628.17, 0.01);
  close(withPrice.usd.principal, 2500, 0.01);
  assert.ok('balanceUsd' in withPrice.chartData[0]);

  const without = calculateStakingRewards(base);
  assert.equal(without.usd, undefined);
  assert.ok(!('balanceUsd' in without.chartData[0]));
});

test('does not mutate its input', () => {
  const input = { ...base };
  const snapshot = JSON.stringify(input);
  calculateStakingRewards(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test('rejects invalid principal', () => {
  rejects({ ...base, principal: 0 }, 'principal');
  rejects({ ...base, principal: -5 }, 'principal');
  rejects({ ...base, principal: 1e13 }, 'principal');
  rejects({ ...base, principal: '1000' }, 'principal');
  rejects({ ...base, principal: NaN }, 'principal');
  rejects({ ...base, principal: Infinity }, 'principal');
  rejects({ ...base, principal: undefined }, 'principal');
});

test('rejects invalid or out-of-range APY', () => {
  rejects({ ...base, apy: -1 }, 'apy');
  rejects({ ...base, apy: 1001 }, 'apy');
  rejects({ ...base, apy: null }, 'apy');
});

test('rejects invalid duration and unit', () => {
  rejects({ ...base, duration: 0 }, 'duration');
  rejects({ ...base, duration: -1 }, 'duration');
  rejects({ ...base, duration: 36501 }, 'duration');
  rejects({ ...base, duration: 101, durationUnit: 'years' }, 'duration');
  rejects({ ...base, durationUnit: 'hours' }, 'durationUnit');
  rejects({ ...base, durationUnit: undefined }, 'durationUnit');
});

test('rejects unknown compounding frequency and rate type', () => {
  rejects({ ...base, compoundingFrequency: 'hourly' }, 'compoundingFrequency');
  rejects({ ...base, compoundingFrequency: 'toString' }, 'compoundingFrequency');
  rejects({ ...base, rateType: 'simple' }, 'rateType');
});

test('rejects invalid token price', () => {
  rejects({ ...base, tokenPrice: -1 }, 'tokenPrice');
  rejects({ ...base, tokenPrice: 'abc' }, 'tokenPrice');
});

test('rejects a non-object body', () => {
  for (const bad of [null, undefined, 42, 'x', []]) {
    assert.throws(() => calculateStakingRewards(bad), InputValidationError);
  }
});

test('reports every problem at once', () => {
  try {
    calculateStakingRewards({});
    assert.fail('should have thrown');
  } catch (err) {
    const fields = err.details.map((d) => d.field).sort();
    assert.deepEqual(fields, [
      'apy',
      'compoundingFrequency',
      'duration',
      'durationUnit',
      'principal'
    ]);
  }
});

test('rejects combinations that overflow instead of returning Infinity', () => {
  rejects(
    {
      ...base,
      principal: 1e12,
      apy: 1000,
      duration: 100,
      durationUnit: 'years'
    },
    'apy'
  );
});
