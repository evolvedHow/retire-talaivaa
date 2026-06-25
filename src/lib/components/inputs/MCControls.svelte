<script lang="ts">
  import { mcConfigStore, mcRunningStore, mcResultStore, runMC, cancelMC } from '../../stores/mc';
  import NumberInput from './NumberInput.svelte';
</script>

<div class="mc-controls">
  <header>
    <h3>Monte Carlo</h3>
    {#if !$mcRunningStore.running}
      <button class="run" on:click={runMC} disabled={$mcRunningStore.running}>
        {$mcResultStore ? 'Re-run' : 'Run'} {$mcConfigStore.runs.toLocaleString()} paths
      </button>
    {:else}
      <button class="cancel" on:click={cancelMC}>Cancel ({Math.round($mcRunningStore.pct * 100)}%)</button>
    {/if}
  </header>

  {#if $mcRunningStore.running}
    <div class="progress"><div class="bar" style:width="{Math.round($mcRunningStore.pct * 100)}%"></div></div>
  {/if}
  {#if $mcRunningStore.error}
    <div class="error">{$mcRunningStore.error}</div>
  {/if}

  <section>
    <h4>Run count</h4>
    <NumberInput label="Paths" bind:value={$mcConfigStore.runs} min={50} max={10000} step={100} />
    <NumberInput label="Random seed" bind:value={$mcConfigStore.seed} min={1} max={1000000} step={1} />
  </section>

  <section>
    <h4>Stocks (annual return)</h4>
    <NumberInput label="Mean" bind:value={$mcConfigStore.returnModel.stocks.mean} min={-0.1} max={0.2} step={0.005} />
    <NumberInput label="Stdev" bind:value={$mcConfigStore.returnModel.stocks.stdev} min={0} max={0.5} step={0.005} />
  </section>

  <section>
    <h4>Bonds (annual return)</h4>
    <NumberInput label="Mean" bind:value={$mcConfigStore.returnModel.bonds.mean} min={-0.05} max={0.1} step={0.0025} />
    <NumberInput label="Stdev" bind:value={$mcConfigStore.returnModel.bonds.stdev} min={0} max={0.2} step={0.0025} />
  </section>

  <section>
    <h4>Correlation</h4>
    <NumberInput label="Stocks ↔ Bonds (-1..1)" bind:value={$mcConfigStore.returnModel.stocksBondsCorr} min={-1} max={1} step={0.05} />
  </section>

  <section>
    <h4>Asset allocation (stock %)</h4>
    <NumberInput label="Tax-deferred" bind:value={$mcConfigStore.allocation.taxDeferred} min={0} max={1} step={0.05} />
    <NumberInput label="Tax-free" bind:value={$mcConfigStore.allocation.taxFree} min={0} max={1} step={0.05} />
    <NumberInput label="Taxable" bind:value={$mcConfigStore.allocation.taxable} min={0} max={1} step={0.05} />
  </section>
</div>

<style>
  .mc-controls {
    background: white;
    padding: 14px;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  h3 { font-size: 16px; font-weight: 700; }
  h4 { font-size: 12px; font-weight: 700; color: #2a4d8f; margin: 10px 0 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  section { padding-bottom: 6px; border-bottom: 1px solid #eee; }
  section:last-child { border-bottom: none; }
  .run, .cancel {
    padding: 6px 14px; border: none; border-radius: 4px;
    font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .run { background: #2a4d8f; color: white; }
  .run:hover:not(:disabled) { background: #1e3a7a; }
  .run:disabled { opacity: 0.5; cursor: not-allowed; }
  .cancel { background: #d97706; color: white; }
  .cancel:hover { background: #b96506; }
  .progress { height: 4px; background: #eee; border-radius: 2px; overflow: hidden; margin: 8px 0; }
  .bar { height: 100%; background: #2a4d8f; transition: width 0.15s; }
  .error { padding: 6px; background: #fee; color: #b00; border-radius: 4px; font-size: 12px; margin-top: 4px; }
</style>
