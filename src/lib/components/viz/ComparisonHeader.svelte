<script lang="ts">
  import { comparisonStore } from '../../stores/comparison';

  const fmt = (n: number) => {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  const deltaCls = (delta: number, betterWhen: 'lower' | 'higher') => {
    if (Math.abs(delta) < 1) return 'neutral';
    const better = betterWhen === 'lower' ? delta < 0 : delta > 0;
    return better ? 'good' : 'bad';
  };

  $: c = $comparisonStore;
</script>

{#if c}
  <div class="cards">
    <div class="card">
      <div class="title">Lifetime tax — NPV (today's $)</div>
      <div class="rows">
        <div class="r"><span class="lbl">With strategy</span><span class="val">{fmt(c.withStrategy.lifetimeTaxNPV)}</span></div>
        <div class="r"><span class="lbl">Without (baseline)</span><span class="val">{fmt(c.withoutStrategy.lifetimeTaxNPV)}</span></div>
        <div class="r delta {deltaCls(c.delta.lifetimeTaxNPV, 'lower')}">
          <span class="lbl">Δ</span>
          <span class="val">{c.delta.lifetimeTaxNPV >= 0 ? '+' : ''}{fmt(c.delta.lifetimeTaxNPV)}</span>
        </div>
      </div>
      <div class="footer">Lower is better — discounted real cost of all federal + state + IRMAA</div>
    </div>

    <div class="card">
      <div class="title">Terminal real net worth (today's $)</div>
      <div class="rows">
        <div class="r"><span class="lbl">With strategy</span><span class="val">{fmt(c.withStrategy.endingTotalBalanceReal)}</span></div>
        <div class="r"><span class="lbl">Without (baseline)</span><span class="val">{fmt(c.withoutStrategy.endingTotalBalanceReal)}</span></div>
        <div class="r delta {deltaCls(c.delta.endingTotalBalanceReal, 'higher')}">
          <span class="lbl">Δ</span>
          <span class="val">{c.delta.endingTotalBalanceReal >= 0 ? '+' : ''}{fmt(c.delta.endingTotalBalanceReal)}</span>
        </div>
      </div>
      <div class="footer">Higher is better — purchasing power left at plan horizon</div>
    </div>

    <div class="card">
      <div class="title">Lifetime IRMAA surcharge</div>
      <div class="rows">
        <div class="r"><span class="lbl">With strategy</span><span class="val">{fmt(c.withStrategy.lifetimeIRMAA)}</span></div>
        <div class="r"><span class="lbl">Without (baseline)</span><span class="val">{fmt(c.withoutStrategy.lifetimeIRMAA)}</span></div>
        <div class="r delta {deltaCls(c.delta.lifetimeIRMAA, 'lower')}">
          <span class="lbl">Δ</span>
          <span class="val">{c.delta.lifetimeIRMAA >= 0 ? '+' : ''}{fmt(c.delta.lifetimeIRMAA)}</span>
        </div>
      </div>
      <div class="footer">Medicare Part B + D surcharges — RMDs often push this up if you don't convert</div>
    </div>
  </div>
{/if}

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }
  .card {
    background: white; border-radius: 6px; padding: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .title { font-size: 12px; color: #1e3a8a; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
  .rows { display: flex; flex-direction: column; gap: 4px; }
  .r { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
  .r .lbl { color: #555; }
  .r .val { font-family: monospace; font-weight: 600; color: #1f2937; }
  .r.delta { border-top: 1px solid #e5e7eb; padding-top: 6px; margin-top: 4px; font-weight: 700; }
  .r.delta.good .val { color: #047857; }
  .r.delta.bad .val { color: #b91c1c; }
  .r.delta.neutral .val { color: #6b7280; }
  .footer { font-size: 11px; color: #6b7280; margin-top: 8px; font-style: italic; }
</style>
