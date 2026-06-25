<script lang="ts">
  import {
    profilesStore,
    dirtyStore,
    loadProfile,
    saveActive,
    saveAs,
    deleteProfile,
    exportProfilesJSON,
    importProfilesJSON,
  } from '../../stores/profiles';

  let fileInput: HTMLInputElement;

  function onChange(e: Event) {
    const name = (e.target as HTMLSelectElement).value;
    if (name) loadProfile(name);
  }

  function onSave() {
    const state = $profilesStore;
    if (!state.activeName) {
      onSaveAs();
      return;
    }
    saveActive();
  }

  function onSaveAs() {
    const suggested = $profilesStore.activeName ? $profilesStore.activeName + ' (copy)' : 'New profile';
    const name = prompt('Save profile as:', suggested);
    if (name && name.trim()) saveAs(name.trim());
  }

  function onDelete() {
    const name = $profilesStore.activeName;
    if (!name) return;
    if (confirm(`Delete profile "${name}"? This can't be undone.`)) deleteProfile(name);
  }

  function onExport() {
    const json = exportProfilesJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roth-advisor-profiles-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport() {
    fileInput.click();
  }

  async function onFileChosen(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = importProfilesJSON(text, 'merge');
    if (result.error) alert(`Import failed: ${result.error}`);
    else alert(`Imported: ${result.added} added, ${result.replaced} replaced.`);
    (e.target as HTMLInputElement).value = '';
  }

  $: profileNames = Object.keys($profilesStore.profiles).sort();
</script>

<div class="bar">
  <label for="profile-select">Profile:</label>
  <select id="profile-select" value={$profilesStore.activeName ?? ''} on:change={onChange}>
    {#if !$profilesStore.activeName}<option value="" disabled>— select —</option>{/if}
    {#each profileNames as name}
      <option value={name}>{name}{$dirtyStore && name === $profilesStore.activeName ? ' *' : ''}</option>
    {/each}
  </select>
  <button on:click={onSave} disabled={!$dirtyStore} title="Save changes to active profile">Save</button>
  <button on:click={onSaveAs} title="Save as new profile">Save as…</button>
  <button on:click={onDelete} disabled={!$profilesStore.activeName} class="danger" title="Delete active profile">Delete</button>
  <button on:click={onExport} title="Export all profiles as JSON">Export</button>
  <button on:click={onImport} title="Import profiles from JSON">Import</button>
  <input type="file" accept="application/json,.json" bind:this={fileInput} on:change={onFileChosen} style="display:none" />
</div>

<style>
  .bar {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px;
  }
  label { color: #cbd5e1; }
  select {
    padding: 4px 6px; border: 1px solid #2a4d8f; border-radius: 4px;
    background: white; color: #1f2937; font-size: 12px; min-width: 180px;
  }
  button {
    padding: 4px 10px; background: #2a4d8f; color: white;
    border: 1px solid #1e3a8a; border-radius: 4px; font-size: 12px; cursor: pointer;
  }
  button:hover:not(:disabled) { background: #3b5fa6; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  button.danger { background: #7f1d1d; border-color: #5b1414; }
  button.danger:hover:not(:disabled) { background: #991b1b; }
</style>
