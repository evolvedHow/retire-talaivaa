<script lang="ts">
  import { pathStore, displayModeStore } from '../../stores/path';

  function fmt(n: number): string {
    if (n === 0) return '—';
    if (Math.abs(n) >= 1000) return Math.round(n / 1000).toLocaleString() + 'k';
    return Math.round(n).toLocaleString();
  }

  function pct(n: number): string {
    return (n * 100).toFixed(1) + '%';
  }

  $: rows = $pathStore?.years.map(y => {
    const f = $displayModeStore === 'real' ? y.inflationFactor : 1;
    return {
      age: y.age,
      year: y.year,
      wages: y.wages / f,
      ss: y.ssGross / f,
      rmd: y.rmd / f,
      conv: y.conversion / f,
      wdTaxDef: y.withdrawal.taxDeferred / f,
      wdTaxable: y.withdrawal.taxable / f,
      wdTaxFree: y.withdrawal.taxFree / f,
      taxable: y.taxableIncome / f,
      tax: y.totalTax / f,
      mr: y.marginalRate,
      taxDef: y.close.taxDeferred / f,
      taxFree: y.close.taxFree / f,
      taxableBal: y.close.taxable / f,
      shortfall: y.spendingShortfall / f,
    };
  }) ?? [];
</script>

<div class="wrap">
  <h3>Year-by-year ({$displayModeStore === 'real' ? "today's $" : 'nominal $'})</h3>
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th>Age</th>
          <th>Year</th>
          <th>Wages</th>
          <th>SS</th>
          <th>RMD</th>
          <th>Conv</th>
          <th>WD-Def</th>
          <th>WD-Tax</th>
          <th>WD-Free</th>
          <th>Taxable inc</th>
          <th>Tax</th>
          <th>MR</th>
          <th>Bal Def</th>
          <th>Bal Free</th>
          <th>Bal Tax</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r}
          <tr class:short={r.shortfall > 0}>
            <td class="hl">{r.age}</td>
            <td>{r.year}</td>
            <td>{fmt(r.wages)}</td>
            <td>{fmt(r.ss)}</td>
            <td>{fmt(r.rmd)}</td>
            <td class="conv">{fmt(r.conv)}</td>
            <td>{fmt(r.wdTaxDef)}</td>
            <td>{fmt(r.wdTaxable)}</td>
            <td>{fmt(r.wdTaxFree)}</td>
            <td>{fmt(r.taxable)}</td>
            <td class="tax">{fmt(r.tax)}</td>
            <td>{pct(r.mr)}</td>
            <td>{fmt(r.taxDef)}</td>
            <td>{fmt(r.taxFree)}</td>
            <td>{fmt(r.taxableBal)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .wrap {
    background: white;
    padding: 12px;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    margin-bottom: 12px;
  }
  h3 { font-size: 13px; font-weight: 700; color: #2a4d8f; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .scroll { overflow: auto; max-height: 400px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; font-family: monospace; }
  th, td { padding: 3px 6px; text-align: right; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
  th { background: #fafafa; position: sticky; top: 0; font-weight: 600; color: #555; }
  td.hl { font-weight: 700; color: #2a4d8f; text-align: left; }
  td.conv { color: #2a8f4d; font-weight: 600; }
  td.tax { color: #b85; font-weight: 600; }
  tr.short { background: #ffe6e6; }
  tbody tr:hover { background: #f5f8fc; }
</style>
