// Random return generation for Monte Carlo. Single PRNG for reproducibility (mulberry32).
// Two asset classes (stocks, bonds) with normal returns. Each year samples ONE (r_s, r_b)
// pair; per-account return = stockPct*r_s + (1-stockPct)*r_b. Stocks/bonds are correlated
// across accounts because they share the same sampled draw, which is the realistic case.

export type AssetClass = 'stocks' | 'bonds';

export interface AssetParams {
  mean: number;   // expected nominal annual return (e.g. 0.07)
  stdev: number;  // annual stdev (e.g. 0.15)
}

export interface ReturnModel {
  stocks: AssetParams;
  bonds: AssetParams;
  stocksBondsCorr: number;  // [-1, 1] — typical historical ~0.1
}

export interface AccountAllocation {
  taxDeferred: number; // stockPct 0-1
  taxFree: number;
  taxable: number;
}

// mulberry32 — small, fast, deterministic. Good enough for MC.
export function makeRNG(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller: 2 uniforms -> 2 N(0,1). We only consume one to keep state simple.
export function normal(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Draw (z_stocks, z_bonds) correlated with the given rho.
export function correlatedNormals(rng: () => number, rho: number): [number, number] {
  const z1 = normal(rng);
  const z2 = normal(rng);
  return [z1, rho * z1 + Math.sqrt(Math.max(0, 1 - rho * rho)) * z2];
}

export function sampleAssetReturns(rng: () => number, model: ReturnModel): { stocks: number; bonds: number } {
  const [zs, zb] = correlatedNormals(rng, model.stocksBondsCorr);
  return {
    stocks: model.stocks.mean + model.stocks.stdev * zs,
    bonds: model.bonds.mean + model.bonds.stdev * zb,
  };
}

export function portfolioReturn(stockPct: number, sampled: { stocks: number; bonds: number }): number {
  const sp = Math.max(0, Math.min(1, stockPct));
  return sp * sampled.stocks + (1 - sp) * sampled.bonds;
}

export interface MonteCarloConfig {
  runs: number;
  returnModel: ReturnModel;
  allocation: AccountAllocation;
  seed: number;
}

export function defaultMCConfig(): MonteCarloConfig {
  return {
    runs: 1000,
    returnModel: {
      stocks: { mean: 0.07, stdev: 0.16 },
      bonds: { mean: 0.03, stdev: 0.05 },
      stocksBondsCorr: 0.1,
    },
    allocation: {
      taxDeferred: 0.6,
      taxFree: 0.8,
      taxable: 0.6,
    },
    seed: 42,
  };
}
