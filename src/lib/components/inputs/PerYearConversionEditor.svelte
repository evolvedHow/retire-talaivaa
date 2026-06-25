<script lang="ts">
  import { scenarioStore } from '../../stores/scenario';

  $: strategy = $scenarioStore.strategy;

  // Build the age list for the conversion window.
  $: ages = strategy.mode === 'fixed-annual' && strategy.endAge >= strategy.startAge
    ? Array.from({ length: strategy.endAge - strategy.startAge + 1 }, (_, i) => strategy.startAge + i)
    : [];

  function amountFor(age: number): number {
    if (strategy.mode !== 'fixed-annual') return 0;
    return strategy.perAgeOverride?.[age] ?? strategy.amount;
  }

  function isOverridden(age: number): boolean {
    if (strategy.mode !== 'fixed-annual') return false;
    return strategy.perAgeOverride != null && age in strategy.perAgeOverride;
  }

  function setOverride(age: number, value: number) {
    scenarioStore.update(s => {
      if (s.strategy.mode !== 'fixed-annual') return s;
      const overrides = { ...(s.strategy.perAgeOverride ?? {}) };
      overrides[age] = value;
      s.strategy = { ...s.strategy, perAgeOverride: overrides };
      return s;
    });
  }

  function resetYear(age: number) {
    scenarioStore.update(s => {
      if (s.strategy.mode !== 'fixed-annual') return s;
      const overrides = { ...(s.strategy.perAgeOverride ?? {}) };
      delete overrides[age];
      s.strategy = { ...s.strategy, perAgeOverride: overrides };
      return s;
    });
  }

  function resetAll() {
    scenarioStore.update(s => {
      if (s.strategy.mode !== 'fixed-annual') return s;
      s.strategy = { ...s.strategy, perAgeOverride: {} };
      return s;
    });
  }

  function onSlide(age: number, e: Event) {
    setOverride(age, Number((e.target as HTMLInputElement).value));
  }

  function onBox(age: number, e: Event) {
    const v = Number((e.target as HTMLInputElement).value);
    if (!Number.isFinite(v)) return;
    setOverride(age, v);
  }

  $: anyOverridden = ages.some(isOverridden);
</script>

{#if strategy.mode === 'fixed-annual' && ages.length > 0}
  <div class="editor">
    <div class="ed-header">
      <h4>Per-year fine-tuning</h4>
      <button class="reset-all" on:click={resetAll} disabled={!anyOverridden}
        title="Clear all per-year overrides">Reset all</button>
    </div>
    <p class="hint">
      Each year defaults to the base amount above. Slide a row to override that specific year — overridden rows show a <span class="dot"></span> dot. Click ↺ to revert one year.
    </p>
    <div class="rows">
      {#each ages as age (age)}
        <div class="row" class:overridden={isOverridden(age)}>
          <span class="age">{age}</span>
          <input type="range" min="0" max="300000" step="2500"
            value={amountFor(age)}
            on:input={e => onSlide(age, e)}
            aria-label={`Conversion amount age ${age}`} />
          <input class="num" type="number" min="0" step="1000"
            value={amountFor(age)}
            on:change={e => onBox(age, e)}
            aria-label={`Conversion amount age ${age} (text)`} />
          {#if isOverridden(age)}
            <button class="undo" title="Reset to base amount" on:click={() => resetYear(age)}>↺</button>
          {:else}
            <span class="undo-spacer"></span>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .editor {
    margin-top: 8px;
    padding: 8px 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
  }
  .ed-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  h4 { font-size: 12px; color: #1e3a8a; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
  .reset-all {
    padding: 2px 8px; background: #fff; border: 1px solid #ccc; border-radius: 3px;
    font-size: 11px; cursor: pointer; color: #444;
  }
  .reset-all:disabled { opacity: 0.4; cursor: not-allowed; }
  .reset-all:hover:not(:disabled) { background: #f0f0f0; }
  .hint { font-size: 10.5px; color: #6b7280; line-height: 1.35; margin-bottom: 6px; }
  .dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: #f59e0b; vertical-align: middle;
  }
  .rows { display: flex; flex-direction: column; gap: 3px; }
  .row {
    display: grid;
    grid-template-columns: 28px 1fr 64px 18px;
    gap: 6px;
    align-items: center;
  }
  .row.overridden { position: relative; }
  .row.overridden .age::after {
    content: ''; display: inline-block; width: 5px; height: 5px;
    border-radius: 50%; background: #f59e0b; margin-left: 3px; vertical-align: middle;
  }
  .age { font-size: 11px; color: #444; font-family: monospace; text-align: right; }
  .row input[type="range"] { width: 100%; }
  .row .num {
    width: 100%;
    padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px;
    font-size: 11px; font-family: monospace; text-align: right;
  }
  .row.overridden .num { border-color: #f59e0b; background: #fffbeb; }
  .undo {
    width: 18px; height: 18px; padding: 0;
    background: transparent; border: none; cursor: pointer;
    color: #f59e0b; font-size: 14px; font-weight: 700;
  }
  .undo:hover { color: #b45309; }
  .undo-spacer { width: 18px; }
</style>
