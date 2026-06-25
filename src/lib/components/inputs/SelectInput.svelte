<script lang="ts">
  export let label: string;
  export let value: string;
  export let options: { value: string; label: string }[];

  let nextId = 0;
  const id = `si-${(nextId++)}-${Math.random().toString(36).slice(2, 7)}`;
</script>

<div class="row">
  <label for={id}>{label}</label>
  <select {id} bind:value>
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>

<style>
  .row { margin-bottom: 10px; }
  label { display: block; font-size: 13px; color: #444; font-weight: 500; margin-bottom: 2px; }
  select {
    width: 100%; padding: 5px 6px; border: 1px solid #ccc; border-radius: 4px;
    font-size: 13px; background: white;
  }
</style>
