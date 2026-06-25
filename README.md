# Roth Conversion Advisor

Visualize multi-year Roth conversions for retirees and the about-to-retire. The focus is narrow on purpose: **minimize lifetime tax** by converting tax-deferred (Trad IRA / 401k) balances to Roth during the years when your marginal rate is lowest — typically the gap between retirement and when RMDs + Social Security stack up.

Sibling app to [tax-talaivaa](../tax-talaivaa) (single-year tax calculator).

## What it answers

- **Is the conversion strategy worth it?** Side-by-side: lifetime-tax NPV and terminal real net worth, *with* vs *without* the strategy.
- **Where do I run into RMD spikes and IRMAA tiers?** Year-by-year chart with IRMAA tier shading and marginal-rate overlay.
- **How sensitive is the answer to market / inflation / spending?** Live sliders re-simulate instantly. Monte Carlo stress test shows the % of return paths where the strategy beats no-conversion.

## Modeling

- **Federal + state tax** via the same interpreter as tax-talaivaa (`src/lib/tax-core/`, mirrored verbatim — see note below).
- **RMDs** via IRS Uniform Lifetime Table (Pub 590-B, 2022+). Start age 73; switch to 75 for birth years 1960+ is a TODO.
- **Social Security** taxable-portion (provisional-income tier math; 1993 thresholds, not inflation-adjusted), with early-claim/delayed-credit adjustment vs FRA = 67.
- **IRMAA** (Income-Related Monthly Adjustment Amount) — Medicare Part B + D surcharge, 2025 CMS tables, projected forward by inflation. Uses **true 2-year MAGI lookback** per Medicare rules. Both spouses pay if both on Medicare.
- **Tax-law projection** — `freeze-current` (default — TCJA-era brackets indexed by inflation) or `tcja-sunset` (pre-TCJA schedule starting 2026 for what-if).
- **Monte Carlo** — correlated stocks/bonds normal returns, per-account allocation, runs both arms (with-strategy + baseline) on the same return path for direct comparison.

## Shared tax math — IMPORTANT

`src/lib/tax-core/interpreter.ts` and `public/tax-configs/*.yml` are **mirrored verbatim** from tax-talaivaa. If you change federal/state bracket math, deductions, or credits in one repo, mirror to the other. There is no shared package (yet — premature factoring). IRMAA lives in `src/lib/sim/irmaa.ts` because it's a Medicare premium surcharge, not income tax.

## Commands

```bash
npm install
npm run dev          # → http://localhost:5173
npm run build
npm run check
```

## Architecture

```
src/lib/
├── tax-core/        # mirrored from tax-talaivaa — DO NOT diverge
├── sim/             # pure simulation layer
│   ├── simulateYear.ts     # one year forward, given prev YearState
│   ├── simulatePath.ts     # full horizon (currentAge → planUntilAge)
│   ├── compare.ts          # with-strategy vs no-conversion baseline
│   ├── conversionStrategy.ts
│   ├── rmd.ts
│   ├── socialSecurity.ts
│   ├── irmaa.ts            # 2025 CMS tables + 2-yr MAGI lookback
│   ├── projectRules.ts     # TCJA sunset modeling, bracket inflation
│   ├── returns.ts          # PRNG + correlated draws for MC
│   ├── monteCarlo.ts
│   └── monteCarlo.worker.ts
├── types/           # ScenarioInputs, YearState, SimulationPath
├── stores/          # rules · scenario · path · comparison · overrides · profiles · mc
└── components/
    ├── inputs/      # InputsPanel · ProfileBar · SensitivitySliders · MCControls · NumberInput · SelectInput
    └── viz/         # ComparisonHeader · ConversionWindowChart · BalanceChart · YearTable · MCSummaryCards · FanChart
```

### Pure simulation layers

- `simulateYear(prev, scenario, ctx, returns?, magi2yrsAgo?) → YearState`
- `simulatePath(scenario, rules, opts?) → SimulationPath`
- `compare(scenario, rules) → { withStrategy, withoutStrategy, delta, perYear }`
- `runMonteCarlo(scenario, rules, mcConfig) → MonteCarloResult` (Web Worker)

### Profiles

Multiple scenarios can be saved as named profiles in `localStorage` (key `rta:profiles:v1`) with Save / Save-as / Delete / Export-JSON / Import-JSON. Sensitivity slider overrides are *transient* and not stored with profiles — they let you stress-test a saved scenario without committing changes. A `*` next to the profile name means the loaded scenario diverges from what's saved.

Seeded out-of-the-box: *Default*, *Aggressive 24% fill*, *No conversion*.
