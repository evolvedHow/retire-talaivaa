<script lang="ts">
  import { onMount } from 'svelte';
  import { loadRules, rulesStore, rulesError } from './lib/stores/rules';
  // Side-effect import: profiles store boots, loads localStorage, hydrates scenarioStore.
  import './lib/stores/profiles';
  import { mcResultStore } from './lib/stores/mc';
  import InputsPanel from './lib/components/inputs/InputsPanel.svelte';
  import ProfileBar from './lib/components/inputs/ProfileBar.svelte';
  import MCControls from './lib/components/inputs/MCControls.svelte';
  import ComparisonHeader from './lib/components/viz/ComparisonHeader.svelte';
  import StrategyComparisonChart from './lib/components/viz/StrategyComparisonChart.svelte';
  import ConversionWindowChart from './lib/components/viz/ConversionWindowChart.svelte';
  import YearTable from './lib/components/viz/YearTable.svelte';
  import MCSummaryCards from './lib/components/viz/MCSummaryCards.svelte';
  import FanChart from './lib/components/viz/FanChart.svelte';

  type View = 'advisor' | 'stress';
  let view: View = 'advisor';

  onMount(() => { loadRules(); });
</script>

<div class="app">
  <header>
    <div class="title">
      <h1>Roth Conversion Advisor</h1>
      <p>Visualize multi-year Roth conversions · avoid RMD spikes &amp; IRMAA tiers · minimize lifetime tax</p>
    </div>
    <ProfileBar />
    <div class="tabs">
      <button class:active={view === 'advisor'} on:click={() => view = 'advisor'}>Advisor</button>
      <button class:active={view === 'stress'} on:click={() => view = 'stress'}>Stress test</button>
    </div>
    <div class="meta">
      {#if $rulesStore}<span>tax rules: {$rulesStore.meta.label}</span>{/if}
    </div>
  </header>

  {#if $rulesError}
    <div class="error">Failed to load tax rules: {$rulesError}</div>
  {:else if !$rulesStore}
    <div class="loading">Loading tax rules…</div>
  {:else}
    <div class="body">
      <div class="left">
        <InputsPanel />
        {#if view === 'stress'}
          <MCControls />
        {/if}
      </div>
      <div class="right">
        {#if view === 'advisor'}
          <ComparisonHeader />
          <StrategyComparisonChart />
          <ConversionWindowChart />
          <YearTable />
        {:else}
          {#if $mcResultStore}
            <MCSummaryCards />
            <FanChart title="Total balance — percentile bands" series="totalBalanceByAge" />
            <FanChart title="Tax-free (Roth) — percentile bands" series="taxFreeByAge" />
            <FanChart title="Tax-deferred — percentile bands" series="taxDeferredByAge" />
          {:else}
            <div class="placeholder">
              <p>No stress test run yet.</p>
              <p>Set Monte Carlo parameters in the sidebar and click <strong>Run</strong> to sample {1000} return paths and see how the strategy holds up.</p>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .app { display: flex; flex-direction: column; height: 100vh; }
  header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 18px; background: #1e3a8a; color: white; flex-shrink: 0;
    gap: 14px;
  }
  h1 { font-size: 18px; font-weight: 700; }
  header p { font-size: 11px; color: #cbd5e1; margin-top: 2px; }
  .meta { font-size: 11px; color: #cbd5e1; white-space: nowrap; }
  .tabs { display: flex; gap: 2px; }
  .tabs button {
    padding: 6px 12px; background: #2a4d8f; color: white;
    border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .tabs button.active { background: #f59e0b; color: #1f2937; }
  .tabs button:hover:not(.active) { background: #3b5fa6; }
  .body {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 12px;
    padding: 12px;
    flex: 1; min-height: 0;
  }
  .left { min-height: 0; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
  .right { overflow-y: auto; min-height: 0; }
  .placeholder {
    background: white; padding: 30px; border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    text-align: center; color: #555; line-height: 1.8;
  }
  .placeholder strong { color: #2a4d8f; }
  .error { padding: 20px; color: #b00; background: #fee; margin: 12px; border-radius: 4px; }
  .loading { padding: 20px; color: #666; }

  @media (max-width: 1100px) {
    header { flex-wrap: wrap; }
  }
  @media (max-width: 800px) {
    .body { grid-template-columns: 1fr; }
  }
</style>
