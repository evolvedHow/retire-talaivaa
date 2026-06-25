<script lang="ts">
  import { pathStore, displayModeStore } from '../../stores/path';

  function fmtMoney(n: number): string {
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
    return '$' + Math.round(n).toLocaleString();
  }

  // Convert nominal -> real (today's dollars) by dividing by ending inflation factor
  // For aggregate metrics, this is an approximation; for "ending balance" use the last year's factor.
  $: lastFactor = $pathStore && $pathStore.years.length > 0
    ? $pathStore.years[$pathStore.years.length - 1].inflationFactor
    : 1;
  $: convert = (n: number) => $displayModeStore === 'real' ? n / lastFactor : n;
</script>

{#if $pathStore}
  <div class="cards">
    <div class="card">
      <div class="label">Lifetime tax</div>
      <div class="value">{fmtMoney($pathStore.lifetimeTax)}</div>
      <div class="sub">nominal · {$pathStore.years.length} yrs</div>
    </div>
    <div class="card">
      <div class="label">Ending balance</div>
      <div class="value">{fmtMoney(convert($pathStore.endingTotalBalance))}</div>
      <div class="sub">{$displayModeStore === 'real' ? "today's $" : 'nominal $'}</div>
    </div>
    <div class="card">
      <div class="label">Total converted</div>
      <div class="value">{fmtMoney($pathStore.totalConverted)}</div>
      <div class="sub">nominal</div>
    </div>
    <div class="card">
      <div class="label">Ending Roth</div>
      <div class="value">{fmtMoney(convert($pathStore.endingTaxFree))}</div>
      <div class="sub">{$displayModeStore === 'real' ? "today's $" : 'nominal $'}</div>
    </div>
    <div class="card">
      <div class="label">Largest single year tax</div>
      <div class="value">{fmtMoney($pathStore.largestSingleYearTax)}</div>
      <div class="sub">at age {$pathStore.largestSingleYearTaxAge}</div>
    </div>
    <div class="card" class:warn={$pathStore.yearsUntilDepletion != null}>
      <div class="label">Depletion</div>
      <div class="value">{$pathStore.yearsUntilDepletion != null ? 'in ' + $pathStore.yearsUntilDepletion + ' yrs' : 'none'}</div>
      <div class="sub">{$pathStore.yearsUntilDepletion != null ? '⚠ assets exhausted' : 'assets last'}</div>
    </div>
  </div>
  <div class="toggle">
    Display:
    <label><input type="radio" name="dm" value="real" bind:group={$displayModeStore} /> Today's dollars</label>
    <label><input type="radio" name="dm" value="nominal" bind:group={$displayModeStore} /> Nominal</label>
  </div>
{/if}

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
  .label { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
  .value { font-size: 22px; font-weight: 700; color: #2a4d8f; margin: 2px 0; font-variant-numeric: tabular-nums; }
  .sub { font-size: 11px; color: #888; }
  .toggle { font-size: 12px; color: #666; margin-bottom: 12px; display: flex; gap: 12px; align-items: center; }
  .toggle label { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
</style>
