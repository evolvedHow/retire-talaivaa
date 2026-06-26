<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';
  import { sweepStore } from '../../stores/sweep';
  import { scenarioStore } from '../../stores/scenario';

  let svg: SVGSVGElement;
  let containerW = 800;

  const margin = { top: 24, right: 70, bottom: 38, left: 70 };
  const height = 300;

  $: result = $sweepStore;

  function fmt(v: number): string {
    const a = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
    if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(0)}k`;
    return `${sign}$${a.toFixed(0)}`;
  }

  function applyOptimum() {
    if (!result) return;
    const target = result.optimumByNW.amount;
    scenarioStore.update(s => {
      if (s.strategy.mode === 'fixed-annual') s.strategy.amount = target;
      else if (s.strategy.mode === 'fill-bracket') s.strategy.annualCap = target;
      return s;
    });
  }

  // Edge-case detection: did the optimum land at the very end of the sweep?
  // If yes, the true peak might lie further out — useful to surface.
  $: optAtMaxEdge = result != null
    && result.optimumByNW.amount === result.points[result.points.length - 1].amount;
  $: optAtMinEdge = result != null
    && result.optimumByNW.amount === result.points[0].amount;

  function draw() {
    if (!svg || !result) return;
    const pts = result.points;
    if (pts.length === 0) return;

    const innerW = containerW - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const root = d3.select(svg);
    root.selectAll('*').remove();
    root.attr('width', containerW).attr('height', height);
    const g = root.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([pts[0].amount, pts[pts.length - 1].amount])
      .range([0, innerW]);

    const yNW = d3.scaleLinear()
      .domain(d3.extent(pts, p => p.terminalNWReal) as [number, number]).nice()
      .range([innerH, 0]);
    const yTax = d3.scaleLinear()
      .domain(d3.extent(pts, p => p.lifetimeTaxNPV) as [number, number]).nice()
      .range([innerH, 0]);

    // "Good band" shaded background — within bandPct of NW optimum
    g.append('rect')
      .attr('x', x(result.goodBandNW.lo))
      .attr('width', Math.max(0, x(result.goodBandNW.hi) - x(result.goodBandNW.lo)))
      .attr('y', 0).attr('height', innerH)
      .attr('fill', '#86efac').attr('opacity', 0.25);

    // Axes
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d => '$' + d3.format('.2s')(d as number).replace('G','B')))
      .selectAll('text').attr('font-size', 11);
    g.append('g')
      .call(d3.axisLeft(yNW).ticks(6).tickFormat(d => '$' + d3.format('.2s')(d as number).replace('G','B')))
      .selectAll('text').attr('font-size', 11).attr('fill', '#2a4d8f');
    g.append('g').attr('transform', `translate(${innerW},0)`)
      .call(d3.axisRight(yTax).ticks(6).tickFormat(d => '$' + d3.format('.2s')(d as number).replace('G','B')))
      .selectAll('text').attr('font-size', 11).attr('fill', '#d97706');

    // Lines
    const lineNW = d3.line<typeof pts[0]>()
      .x(p => x(p.amount)).y(p => yNW(p.terminalNWReal))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(pts)
      .attr('fill', 'none').attr('stroke', '#2a4d8f').attr('stroke-width', 2.5)
      .attr('d', lineNW);

    const lineTax = d3.line<typeof pts[0]>()
      .x(p => x(p.amount)).y(p => yTax(p.lifetimeTaxNPV))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(pts)
      .attr('fill', 'none').attr('stroke', '#d97706').attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '5 3')
      .attr('d', lineTax);

    // Optimum markers
    g.append('circle')
      .attr('cx', x(result.optimumByNW.amount))
      .attr('cy', yNW(result.optimumByNW.terminalNWReal))
      .attr('r', 6).attr('fill', '#16a34a').attr('stroke', 'white').attr('stroke-width', 2);
    g.append('text')
      .attr('x', x(result.optimumByNW.amount))
      .attr('y', yNW(result.optimumByNW.terminalNWReal) - 12)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('font-weight', 700).attr('fill', '#16a34a')
      .text(`★ ${fmt(result.optimumByNW.amount)}`);

    g.append('circle')
      .attr('cx', x(result.optimumByTax.amount))
      .attr('cy', yTax(result.optimumByTax.lifetimeTaxNPV))
      .attr('r', 5).attr('fill', '#d97706').attr('stroke', 'white').attr('stroke-width', 2);

    // Current slider position — vertical line
    const currentX = Math.max(pts[0].amount, Math.min(pts[pts.length-1].amount, result.currentValue));
    g.append('line')
      .attr('x1', x(currentX)).attr('x2', x(currentX))
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', '#475569').attr('stroke-width', 1.5).attr('stroke-dasharray', '3 3');
    g.append('text')
      .attr('x', x(currentX)).attr('y', innerH + 32)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#475569').attr('font-weight', 600)
      .text(`you're here: ${fmt(result.currentValue)}`);

    // Hover targets
    g.append('g').selectAll('circle.hover')
      .data(pts)
      .join('circle')
      .attr('class', 'hover')
      .attr('cx', p => x(p.amount))
      .attr('cy', innerH / 2)
      .attr('r', 12)
      .attr('fill', 'transparent')
      .append('title')
      .text(p => [
        `Conversion lever: ${fmt(p.amount)}`,
        `Terminal real NW: ${fmt(p.terminalNWReal)}`,
        `Lifetime tax NPV: ${fmt(p.lifetimeTaxNPV)}`,
        `Lifetime IRMAA: ${fmt(p.lifetimeIRMAA)}`,
        `Total converted: ${fmt(p.totalConverted)}`,
      ].join('\n'));

    // Axis labels
    const xLabel = result.mode === 'fill-bracket'
      ? 'Annual conversion cap ($/yr) — left = conservative, right = aggressive'
      : 'Conversion amount ($/yr) — left = nothing, right = aggressive';
    g.append('text').attr('x', innerW / 2).attr('y', innerH + 32)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#666')
      .text(xLabel);
    g.append('text')
      .attr('transform', `translate(-55,${innerH / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#2a4d8f')
      .text('Terminal real NW (left)');
    g.append('text')
      .attr('transform', `translate(${innerW + 55},${innerH / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#d97706')
      .text('Lifetime tax NPV (right)');
  }

  onMount(() => {
    const resize = () => {
      const parent = svg?.parentElement;
      if (parent) containerW = parent.clientWidth;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  });

  afterUpdate(draw);
</script>

{#if result}
  <div class="chart">
    <header>
      <h3>Sweet spot — how the strategy lands across conversion amounts</h3>
      <button class="apply" on:click={applyOptimum} title="Set the slider to the NW-optimal amount">
        ★ Use optimum (${(result.optimumByNW.amount/1000).toFixed(0)}k/yr {result.mode === 'fill-bracket' ? 'cap' : ''})
      </button>
    </header>
    <svg bind:this={svg}></svg>
    <div class="legend">
      <span class="lg"><span class="line solid"></span>Terminal real NW (higher = better)</span>
      <span class="lg"><span class="line dashed"></span>Lifetime tax NPV (lower = better)</span>
      <span class="lg"><span class="sw" style="background:#86efac;opacity:0.5"></span>Within {(result.bandPct*100).toFixed(1)}% of NW optimum</span>
      <span class="lg"><span class="star">★</span>NW optimum: ${(result.optimumByNW.amount/1000).toFixed(0)}k → {(result.optimumByNW.terminalNWReal/1_000_000).toFixed(2)}M NW</span>
      <span class="lg"><span class="dot tax"></span>Tax-min optimum: ${(result.optimumByTax.amount/1000).toFixed(0)}k → ${(result.optimumByTax.lifetimeTaxNPV/1000).toFixed(0)}k tax</span>
    </div>

    {#if result.mode === 'fill-bracket'}
      <p class="hint">
        <strong>Reading this:</strong> The X axis is your <em>annual conversion cap</em>. Low cap = you convert little each year (conservative). High cap = you let the strategy fill to the top of your {((($scenarioStore.strategy.mode === 'fill-bracket' ? $scenarioStore.strategy.targetMarginalRate : 0.24) * 100).toFixed(0))}% bracket. The green band marks the range within {(result.bandPct*100).toFixed(1)}% of the best terminal net worth — anywhere inside is essentially as good. Click ★ to snap your cap slider to the optimum. (Setting cap=$0 in the inputs means "no cap" — the most aggressive option, intentionally excluded from this sweep so the optimum points at a meaningful dollar value.)
      </p>
      {#if optAtMaxEdge}
        <p class="hint warn">⚠ The optimum is at the maximum sweep value, which means "no cap" (most aggressive) is likely even better. Try setting cap=$0 in the inputs to compare.</p>
      {/if}
    {:else}
      <p class="hint">
        <strong>Reading this:</strong> The X axis is the dollar amount converted each year. Left = converting little or nothing. Right = converting aggressively. The green band marks the range within {(result.bandPct*100).toFixed(1)}% of the best terminal net worth — anywhere inside is essentially as good. Click ★ to snap the slider to the optimum.
      </p>
      {#if optAtMinEdge && result.optimumByNW.amount === 0}
        <p class="hint warn">⚠ The optimum is "don't convert" for this scenario. Roth conversions probably aren't worth it given your inputs — likely because you have low tax-deferred balances, low expected returns, or already-low future RMD risk.</p>
      {/if}
    {/if}
  </div>
{:else if $scenarioStore.strategy.mode === 'none'}
  <div class="chart placeholder">
    <p>Sweep is available for <strong>Fixed amount</strong> and <strong>Fill to bracket top</strong> strategies. Switch modes (sidebar → Conversion strategy) to see the sweet-spot landscape.</p>
  </div>
{:else if $scenarioStore.strategy.mode === 'custom'}
  <div class="chart placeholder">
    <p>Sweep doesn't apply to <strong>Custom per-age</strong> mode — there's no single lever to sweep.</p>
  </div>
{/if}

<style>
  .chart {
    background: white;
    padding: 12px;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    margin-bottom: 12px;
  }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px; }
  h3 { font-size: 13px; font-weight: 700; color: #2a4d8f; text-transform: uppercase; letter-spacing: 0.5px; }
  svg { width: 100%; display: block; }
  .apply {
    padding: 5px 12px; background: #16a34a; color: white;
    border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;
    white-space: nowrap;
  }
  .apply:hover { background: #15803d; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 8px; font-size: 11px; color: #555; align-items: center; }
  .lg { display: inline-flex; align-items: center; gap: 4px; }
  .line { display: inline-block; width: 18px; height: 2px; }
  .line.solid { background: #2a4d8f; }
  .line.dashed { border-top: 2px dashed #d97706; height: 0; }
  .sw { display: inline-block; width: 12px; height: 12px; border-radius: 2px; border: 1px solid #ccc; }
  .star { color: #16a34a; font-size: 13px; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
  .dot.tax { background: #d97706; }
  .hint { font-size: 11px; color: #6b7280; margin-top: 8px; line-height: 1.4; }
  .hint strong { color: #1e3a8a; }
  .hint.warn { color: #92400e; background: #fef3c7; padding: 6px 8px; border-radius: 3px; font-size: 11.5px; }
  .placeholder { text-align: center; color: #6b7280; padding: 20px; font-size: 13px; }
  .placeholder strong { color: #2a4d8f; }
</style>
