const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const stakingRouter = require('../routes/api/staking');
const errorHandler = require('../middleware/errorHandler');

/** Builds an app wired the same way as server.js, plus a route that always fails. */
const startApp = async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/calculate-rewards', stakingRouter);
  app.get('/api/boom', () => {
    throw new Error('secret internal detail');
  });
  app.use(errorHandler);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { baseUrl, close: () => new Promise((r) => server.close(r)) };
};

const post = (baseUrl, body, raw = false) =>
  fetch(`${baseUrl}/api/calculate-rewards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? body : JSON.stringify(body)
  });

const valid = {
  principal: 1000,
  apy: 5,
  duration: 365,
  durationUnit: 'days',
  compoundingFrequency: 'daily'
};

test('POST /api/calculate-rewards returns the projection', async (t) => {
  const { baseUrl, close } = await startApp();
  t.after(close);

  const res = await post(baseUrl, valid);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Math.abs(body.finalBalance - 1051.26749647) < 1e-6);
  assert.ok(Math.abs(body.totalRewards - 51.26749647) < 1e-6);
  assert.equal(body.normalizedDuration.years, 1);
  assert.ok(Array.isArray(body.chartData) && body.chartData.length > 2);
});

test('invalid input returns 400 with a clear message and field details', async (t) => {
  const { baseUrl, close } = await startApp();
  t.after(close);

  const res = await post(baseUrl, { ...valid, principal: -10, apy: 5000 });
  assert.equal(res.status, 400);
  const { error } = await res.json();
  assert.match(error.message, /principal/);
  assert.deepEqual(
    error.details.map((d) => d.field),
    ['principal', 'apy']
  );
});

test('missing body returns 400', async (t) => {
  const { baseUrl, close } = await startApp();
  t.after(close);

  const res = await fetch(`${baseUrl}/api/calculate-rewards`, { method: 'POST' });
  assert.equal(res.status, 400);
});

test('malformed JSON returns 400, not a crash', async (t) => {
  const { baseUrl, close } = await startApp();
  t.after(close);

  const res = await post(baseUrl, '{"principal": 1000,', true);
  assert.equal(res.status, 400);
  const { error } = await res.json();
  assert.match(error.message, /invalid JSON/i);
});

test('unexpected failures return 500 without leaking details, and the server keeps serving', async (t) => {
  const { baseUrl, close } = await startApp();
  t.after(close);
  const originalError = console.error;
  console.error = () => {}; // keep expected failure out of the test output
  t.after(() => {
    console.error = originalError;
  });

  const failing = await fetch(`${baseUrl}/api/boom`);
  assert.equal(failing.status, 500);
  const { error } = await failing.json();
  assert.equal(error.message, 'Internal Server Error');
  assert.ok(!JSON.stringify(error).includes('secret internal detail'));

  const after = await post(baseUrl, valid);
  assert.equal(after.status, 200);
});
