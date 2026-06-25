<script lang="ts">
  export let label: string;
  export let value: number;
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  export let step = 1;
  export let prefix = '';
  export let suffix = '';
  export let withSlider = false;
  export let help = '';

  // Unique id per instance for label `for` association.
  let nextId = 0;
  const id = `ni-${(nextId++)}-${Math.random().toString(36).slice(2, 7)}`;
</script>

<div class="row">
  <div class="row-head">
    <label for={id}>{label}</label>
    {#if help}<span class="help" title={help}>?</span>{/if}
  </div>
  <div class="row-controls">
    {#if withSlider}
      <input
        type="range"
        {min}
        {max}
        {step}
        bind:value
        class="slider"
        aria-label="{label} slider"
      />
    {/if}
    <span class="prefix">{prefix}</span>
    <input
      {id}
      type="number"
      {min}
      {max}
      {step}
      bind:value
      class="num"
    />
    <span class="suffix">{suffix}</span>
  </div>
</div>

<style>
  .row { margin-bottom: 10px; }
  .row-head { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
  label { font-size: 13px; color: #444; font-weight: 500; }
  .help {
    display: inline-flex; align-items: center; justify-content: center;
    width: 14px; height: 14px; border-radius: 50%;
    background: #ddd; color: #555; font-size: 10px; cursor: help;
  }
  .row-controls { display: flex; align-items: center; gap: 6px; }
  .slider { flex: 1; min-width: 80px; }
  .num {
    width: 90px; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px;
    font-size: 13px; font-family: monospace; text-align: right;
  }
  .prefix, .suffix { font-size: 12px; color: #777; }
</style>
