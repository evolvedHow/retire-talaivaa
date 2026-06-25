<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';
  import { comparisonStore } from '../../stores/comparison';
  import { displayModeStore } from '../../stores/path';

  let svg: SVGSVGElement;
  let containerW = 800;

  const margin = { top: 24, right: 70, bottom: 36, left: 64 };
  const height = 360;

  type Row = {
    age: number;
    conversion: number;
    rmdWith: number;
    rmdWithout: number;
    marginalRateWith: number;
    irmaaTierWith: number;
    irmaaTotalWith: number;
    magiWith: number;
  };

  $: c = $comparisonStore;
  $: data = (c
    ? c.withStrategy.years.map((y, i): Row => {
        const f = $displayModeStore === 'real' ? y.inflationFactor : 1;
        const py = c!.perYear[i];
        return {
          age: y.age,
          conversion: y.conversion / f,
          rmdWith: y.rmd / f,
          rmdWithout: c!.withoutStrategy.years[i].rmd / f,
          marginalRateWith: y.marginalRate,
          irmaaTierWith: py.irmaaTierWith,
          irmaaTotalWith: py.irmaaTotalWith / f,
          magiWith: py.magiWith / f,
        };
      })
    : []
  ) as Row[];

  // IRMAA tier colors: tier 0 = no shading. Tiers 1..5 progressively redder.
  const tierBg = ['transparent', '#fef3c7', '#fed7aa', '#fdba74', '#f87171', '#dc2626'];
  const tierLabels = ['No IRMAA', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5 (max)'];

  function fmtMoney(v: number): string {
    const a = Math.abs(v);
    if (a >= 1_000_000) return `$${(v/1_000_000).toFixed(2)}M`;
    if (a >= 1_000) return `$${(v/1_000).toFixed(0)}k`;
    return `$${v.toFixed(0)}`;
  }

  function draw() {
    if (!svg || data.length === 0) return;
    const innerW = containerW - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const root = d3.select(svg);
    root.selectAll('*').remove();
    root.attr('width', containerW).attr('height', height);
    const g = root.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand<number>()
      .domain(data.map(d => d.age))
      .range([0, innerW])
      .padding(0.18);

    const maxY = d3.max(data, d => Math.max(d.conversion, d.rmdWith, d.rmdWithout)) ?? 1;
    const y = d3.scaleLinear().domain([0, Math.max(maxY, 1)]).nice().range([innerH, 0]);
    const yMR = d3.scaleLinear().domain([0, 0.5]).range([innerH, 0]);

    // ── IRMAA tier shading: one rect per year, full-height ──
    g.append('g').selectAll('rect.tier')
      .data(data)
      .join('rect')
      .attr('class', 'tier')
      .attr('x', d => x(d.age) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', 0)
      .attr('height', innerH)
      .attr('fill', d => tierBg[Math.min(d.irmaaTierWith, 5)])
      .attr('opacity', 0.45);

    // Axes
    const xAxis = d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 5 === 0));
    g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis)
      .selectAll('text').attr('font-size', 11);
    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => '$' + d3.format('.2s')(d as number).replace('G','B')))
      .selectAll('text').attr('font-size', 11);
    g.append('g').attr('transform', `translate(${innerW},0)`)
      .call(d3.axisRight(yMR).ticks(5).tickFormat(d => (Number(d) * 100).toFixed(0) + '%'))
      .selectAll('text').attr('font-size', 10).attr('fill', '#dc2626');

    // Side-by-side bars: Conversion (green), RMD with-strategy (orange)
    const bandSubW = x.bandwidth() / 2;
    g.append('g').selectAll('rect.conv')
      .data(data)
      .join('rect')
      .attr('class', 'conv')
      .attr('x', d => (x(d.age) ?? 0))
      .attr('y', d => y(d.conversion))
      .attr('width', bandSubW)
      .attr('height', d => Math.max(0, innerH - y(d.conversion)))
      .attr('fill', '#16a34a');

    g.append('g').selectAll('rect.rmd')
      .data(data)
      .join('rect')
      .attr('class', 'rmd')
      .attr('x', d => (x(d.age) ?? 0) + bandSubW)
      .attr('y', d => y(d.rmdWith))
      .attr('width', bandSubW)
      .attr('height', d => Math.max(0, innerH - y(d.rmdWith)))
      .attr('fill', '#f97316');

    // Marginal rate line (right axis)
    const line = d3.line<Row>()
      .x(d => (x(d.age) ?? 0) + x.bandwidth() / 2)
      .y(d => yMR(d.marginalRateWith))
      .curve(d3.curveStepAfter);
    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', '#dc2626').attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 2').attr('d', line);

    // Hover targets per year — invisible rects with title
    g.append('g').selectAll('rect.hover')
      .data(data)
      .join('rect')
      .attr('class', 'hover')
      .attr('x', d => x(d.age) ?? 0)
      .attr('y', 0)
      .attr('width', x.bandwidth())
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .append('title')
      .text(d => [
        `Age ${d.age}`,
        `Conversion: ${fmtMoney(d.conversion)}`,
        `RMD: ${fmtMoney(d.rmdWith)}  (no-strategy: ${fmtMoney(d.rmdWithout)})`,
        `Marginal rate: ${(d.marginalRateWith*100).toFixed(1)}%`,
        `IRMAA tier: ${tierLabels[Math.min(d.irmaaTierWith,5)]}  ($${Math.round(d.irmaaTotalWith).toLocaleString()})`,
        `MAGI: ${fmtMoney(d.magiWith)}`,
      ].join('\n'));

    // Axis labels
    g.append('text').attr('x', innerW / 2).attr('y', innerH + 30)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#666')
      .text('Age');
    g.append('text')
      .attr('transform', `translate(${innerW + 50},${innerH / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#dc2626')
      .text('Marginal rate');
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

<div class="chart">
  <header>
    <h3>Conversion window — Roth conversions, RMDs, marginal rate, IRMAA shading</h3>
    <div class="toggle">
      <button class:active={$displayModeStore === 'real'} on:click={() => displayModeStore.set('real')}>Real $</button>
      <button class:active={$displayModeStore === 'nominal'} on:click={() => displayModeStore.set('nominal')}>Nominal $</button>
    </div>
  </header>
  <svg bind:this={svg}></svg>
  <div class="legend">
    <span class="lg"><span class="sw" style:background="#16a34a"></span>Roth conversion</span>
    <span class="lg"><span class="sw" style:background="#f97316"></span>RMD (with strategy)</span>
    <span class="lg"><span class="line"></span>Marginal tax rate</span>
    <span class="sep">|</span>
    <span class="lg lbl">IRMAA tier:</span>
    {#each tierBg as bg, i}
      <span class="lg"><span class="sw" style:background={bg} style:border="1px solid #ccc"></span>{tierLabels[i]}</span>
    {/each}
  </div>
</div>

<style>
  .chart {
    background: white;
    padding: 12px;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    margin-bottom: 12px;
  }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  h3 { font-size: 13px; font-weight: 700; color: #2a4d8f; text-transform: uppercase; letter-spacing: 0.5px; }
  svg { width: 100%; display: block; }
  .toggle { display: flex; gap: 2px; }
  .toggle button {
    padding: 3px 8px; background: #f0f0f0; border: 1px solid #ccc; border-radius: 3px;
    font-size: 11px; cursor: pointer;
  }
  .toggle button.active { background: #2a4d8f; color: white; border-color: #1e3a8a; }
  .legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; font-size: 11px; color: #555; align-items: center; }
  .lg { display: inline-flex; align-items: center; gap: 4px; }
  .lg.lbl { color: #1e3a8a; font-weight: 600; }
  .sw { display: inline-block; width: 12px; height: 12px; border-radius: 2px; }
  .line { display: inline-block; width: 16px; border-top: 2px dashed #dc2626; }
  .sep { color: #ccc; }
</style>
