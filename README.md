# DeFi Dashboard — Staking Rewards Calculator

A Staking Rewards Calculator integrated into the existing dashboard (`/dashboard`): an Express API that does the compound-interest maths, and a React widget that calls it, shows the result and plots balance growth.

## Environment

- Node v18 or later (developed on v25)
- OS: Mac, Linux, Windows

## Setup and run

```bash
npm install
npm start          # Express API on :5025 + React dev server on :3000
```

Open <http://localhost:3000/dashboard> and scroll to **Staking Rewards Calculator**.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5025` | Express port. If you change it, update `"proxy"` in `package.json`. |

No other configuration is needed and there is no database. In development the React dev server proxies `/api/*` to the Express server (`"proxy"` in `package.json`), so the widget calls the relative URL `/api/calculate-rewards`.

## Tests

```bash
npm run test:server                                   # backend: calculation engine + API (node:test, no extra deps)
CI=true npx react-scripts test --watchAll=false src/utils   # frontend validation (Jest)
```

Backend: 26 tests covering standard calculations (daily/weekly/monthly/annual), fractional durations, zero APY, effective vs nominal rates, chart series invariants, USD output, every invalid-input rule, overflow, and the HTTP layer (200, 400, malformed JSON, 500 without leaking details, server still serving after a 500).

## API

### `POST /api/calculate-rewards`

```json
{
  "principal": 1000,
  "apy": 5,
  "duration": 365,
  "durationUnit": "days",
  "compoundingFrequency": "daily",
  "rateType": "nominal",
  "tokenPrice": 2.5
}
```

| Field | Type | Rules |
| --- | --- | --- |
| `principal` | number | required, `> 0` and `<= 1e12` |
| `apy` | number (percent) | required, `0 – 1000` (0 is allowed) |
| `duration` | number | required, `> 0`, fractions allowed, at most 100 years |
| `durationUnit` | `"days"` \| `"years"` | required |
| `compoundingFrequency` | `"daily"` \| `"weekly"` \| `"monthly"` \| `"annually"` | required |
| `rateType` | `"nominal"` \| `"effective"` | optional, default `"nominal"` |
| `tokenPrice` | number | optional, `0 – 1e9`; adds USD fields |

**200 response** (abridged): `finalBalance`, `totalRewards`, `normalizedDuration {years, days, periods}`, `effectiveApy`, `nominalRate`, `usd {principal, finalBalance, totalRewards}` (only with `tokenPrice`), and `chartData` — 61 points of `{years, day, balance, rewards, balanceUsd?}`.

**Errors**

- `400` — invalid input or malformed JSON: `{ "error": { "message": "...", "details": [{ "field": "apy", "message": "..." }] } }`. All field problems are reported together.
- `500` — unexpected failure: `{ "error": { "message": "Internal Server Error", "details": [] } }`. The cause is logged server-side only.

```bash
curl -X POST localhost:5025/api/calculate-rewards -H 'Content-Type: application/json' \
  -d '{"principal":1000,"apy":5,"duration":365,"durationUnit":"days","compoundingFrequency":"daily"}'
```

## Mathematical assumptions

The model is `A = P (1 + i)^(n·t)` where `n` is periods per year (365 / 52 / 12 / 1), `t` is the duration in years and `i` is the rate per period.

**APY vs nominal rate (the key decision).** "APY" conventionally means *effective* annual yield, but the brief's formula `A = P(1 + r/n)^(nt)` uses a *nominal* rate. Applied to an effective APY, the two are inconsistent, and — more importantly — with a true effective APY the final balance is `P(1 + APY)^t` **regardless of compounding frequency**, which would make the frequency input pointless. So the API supports both, explicitly:

- `rateType: "nominal"` (default): `i = r / n`. This is exactly the brief's formula, and frequency matters. 5% daily over 1 year → **1051.26749647** (effective yield 5.1267%).
- `rateType: "effective"`: `i = (1 + r)^(1/n) − 1`. 5% over 1 year → **1050.00** for every frequency; frequency only changes the shape of the curve.

Every response includes both `nominalRate` and `effectiveApy` so the two are never confused. The UI exposes this as **Rate type**.

Other conventions:

- Days convert to years as `days / 365` (no leap years).
- Fractional durations use a fractional exponent `n·t`, so the final partial period accrues pro rata (1.5 years monthly = 18 periods; 100 days weekly ≈ 14.25 periods).
- Output is rounded to 8 decimals at the boundary only; nothing is rounded mid-computation. `expm1/log1p` keep the effective-rate conversion accurate for small rates.
- Inputs that would overflow to `Infinity` (e.g. 1000% for 100 years) are rejected with a 400 rather than returned.

### Complexity

- Single closed-form result: **O(1)** time and space.
- Chart series of `k` points: **O(k)** time and **O(k)** space (each point is an independent O(1) closed form, no iteration over periods). `k` is fixed at 61, so a request costs the same whether the duration is one day or one hundred years.

## Architecture

```
server.js                         mounts the route + central error handler
server/
  routes/api/staking.js           route only
  controllers/stakingController.js  thin HTTP adapter (req -> service -> res)
  services/stakingCalculator.js   pure maths, no Express (reusable, unit-testable)
  validation/stakingInput.js      pure validation + limits, no Express
  middleware/errorHandler.js      400 / 500 mapping
  utils/errors.js                 InputValidationError
  tests/                          node:test suites
src/
  api/staking.ts                  typed client, turns failures into user-safe messages
  utils/stakingValidation.ts      instant form feedback (mirrors server limits)
  components/staking/             StakingCalculator, StakingGrowthChart, formatting
  views/dashboard/Dashboard.tsx   renders <StakingCalculator /> (only change to the existing UI)
```

**Choices and trade-offs**

- **The engine validates its own input.** The service calls the validator itself, so it rejects bad input even when used outside HTTP, and the controller stays trivial. The cost is that validation isn't an Express middleware.
- **Hand-written validation instead of `express-validator`** (already a dependency): strict number typing (`"1000"` is rejected), one list of limits shared by engine and API, and it runs without Express in unit tests.
- **Server limits are duplicated on the client** for instant feedback. The server is the source of truth; the duplication is small and commented. A `/limits` endpoint would remove it at the cost of an extra request.
- **Plain JS on the backend** to match the existing `server/` code; TypeScript on the frontend to match `src/`.
- **Chart: `recharts`** (the template had no chart library). It's the one new runtime dependency.
- **`node:test` for the backend** avoids adding a test framework, and CRA's Jest only looks under `src/`.
- **No persistence**: the calculation is stateless, so there is nothing to store.

## Frontend notes

- States: idle (prompt), loading (spinner, button disabled), success (stats + chart), error (server/network message). In-flight requests are cancelled on resubmit or unmount.
- Validation shows after a field is touched or Calculate is pressed; the server's messages are shown if it still rejects.
- Styling reuses the dashboard's palette (`#00dbe3` / `#173039` / `#23a2bb`, 2px cyan borders, uppercase bold buttons) and the existing `CustomTextField`. Text and surface colours come from the MUI theme.
- Layout: two columns on desktop, stacked on mobile.

## Known limitations

- **Dark theme:** the theme folder defines a dark palette, but the app is hard-wired to the light theme (`createTheme(false)`) and the dashboard uses hard-coded colours, so there is no theme switch to test against. The widget reads `background.paper` / `text.*` from the theme, so it follows if a switch is added, but I could not verify dark mode visually.
- **Pre-existing mobile overflow:** at phone widths the template's own dashboard (fixed 352px buttons beside the offers table) makes the page wider than the screen. This is unrelated to the calculator, which stacks and fits correctly, and I left the original layout untouched.
- Rewards are projected from a constant rate; real staking yields vary, and fees, lock-ups and slashing are not modelled.
- `server/` contains pre-existing code (auth, posts, mongoose) that this feature does not touch. The existing `src/App.test.tsx` was not modified.
