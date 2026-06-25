<script lang="ts">
  import { mcResultStore } from '../../stores/mc';
  import { scenarioStore } from '../../stores/scenario';
  import { displayModeStore } from '../../stores/path';
  import type { PercentileBand } from '../../sim/monteCarlo';

  function fmt(n: number): string {
    const sign = n < 0 ? '-' : '';
    const a = Math.abs(n);
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'k';
    return sign + '$' + Math.round(a).toLocaleString();
  }

  $: lastFactor = (() => {
    if (!$mcResultStore) return 1;
    const horizon = $mcResultStore.totalBalanceByAge.length;
    return Math.pow(1 + $scenarioStore.inflationRate, Math.max(0, horizon - 1));
  })();
  $: convert = (n: number) => $displayModeStore === 'real' ? n / lastFactor : n;

  function range(band: PercentileBand, transform: (n: number) => number = n => n): string {
    return `${fmt(transform(band.p10))} – ${fmt(transform(band.p90))}`;
  }
</script>

{#if $mcResultStore}
  <div class="cards">
    <div class="card headline" class:good={$mcResultStore.probStrategyBeatsBaseline > 0.5} class:bad={$mcResultStore.probStrategyBeatsBaseline < 0.5}>
      <div class="label">Strategy beats baseline (terminal real NW)</div>
      <div class="value">{($mcResultStore.probStrategyBeatsBaseline * 100).toFixed(1)}%</div>
      <div class="sub">of {$mcResultStore.runs.toLocaleString()} sampled return paths</div>
    </div>
    <div class="card">
      <div class="label">Δ Terminal real NW (median)</div>
      <div class="value">{fmt($mcResultStore.endingBalanceDelta.p50)}</div>
      <div class="sub">p10–p90: {range($mcResultStore.endingBalanceDelta)}</div>
    </div>
    <div class="card">
      <div class="label">Δ Lifetime tax NPV (median)</div>
      <div class="value">{fmt($mcResultStore.lifetimeTaxDelta.p50)}</div>
      <div class="sub">p10–p90: {range($mcResultStore.lifetimeTaxDelta)} · negative = strategy pays less tax</div>
    </div>
    <div class="card">
      <div class="label">Ending balance (median)</div>
      <div class="value">{fmt(convert($mcResultStore.endingTotalBalance.p50))}</div>
      <div class="sub">p10–p90: {range($mcResultStore.endingTotalBalance, convert)}</div>
    </div>
    <div class="card">
      <div class="label">Ending Roth (median)</div>
      <div class="value">{fmt(convert($mcResultStore.endingTaxFree.p50))}</div>
      <div class="sub">p10–p90: {range($mcResultStore.endingTaxFree, convert)}</div>
    </div>
    <div class="card" class:warn={$mcResultStore.probDepletion > 0.1}>
      <div class="label">Probability of depletion</div>
      <div class="value">{($mcResultStore.probDepletion * 100).toFixed(1)}%</div>
      <div class="sub">
        {#if $mcResultStore.meanDepletionAge != null}
          mean age {Math.round($mcResultStore.meanDepletionAge)}
        {:else}
          no runs depleted
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }
  .card {
    background: white;
    padding: 10px 12px;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .card.warn { background: #fff3e0; }
  .card.headline { border-left: 4px solid #2a4d8f; }
  .card.headline.good { border-left-color: #047857; background: #ecfdf5; }
  .card.headline.bad { border-left-color: #b91c1c; background: #fef2f2; }
  .label { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
  .value { font-size: 22px; font-weight: 700; color: #2a4d8f; margin: 2px 0; font-variant-numeric: tabular-nums; }
  .sub { font-size: 11px; color: #888; }
</style>
