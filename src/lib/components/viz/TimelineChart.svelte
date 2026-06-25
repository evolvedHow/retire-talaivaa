<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';
  import { pathStore, displayModeStore } from '../../stores/path';

  let svg: SVGSVGElement;
  let containerW = 800;

  const margin = { top: 20, right: 60, bottom: 36, left: 60 };
  const height = 320;

  type Row = {
    age: number;
    wages: number;
    pension: number;
    ssTaxable: number;
    rmd: number;
    conversion: number;
    wdTaxDef: number;
    wdTaxable: number;
    wdTaxFree: number;
    marginalRate: number;
    total: number;
  };

  $: data = ($pathStore?.years.map(y => {
    const f = $displayModeStore === 'real' ? y.inflationFactor : 1;
    return {
      age: y.age,
      wages: y.wages / f,
      pension: y.pension / f,
      ssTaxable: y.ssTaxable / f,
      rmd: y.rmd / f,
      conversion: y.conversion / f,
      wdTaxDef: y.withdrawal.taxDeferred / f,
      wdTaxable: y.withdrawal.taxable / f,
      wdTaxFree: y.withdrawal.taxFree / f,
      marginalRate: y.marginalRate,
      total: (y.wages + y.pension + y.ssTaxable + y.rmd + y.conversion + y.withdrawal.taxDeferred + y.withdrawal.taxable + y.withdrawal.taxFree) / f,
    };
  }) ?? []) as Row[];

  const keys: (keyof Row)[] = ['wages', 'pension', 'ssTaxable', 'rmd', 'conversion', 'wdTaxDef', 'wdTaxable', 'wdTaxFree'];
  const colors: Record<string, string> = {
    wages: '#3b82f6',
    pension: '#8b5cf6',
    ssTaxable: '#06b6d4',
    rmd: '#f97316',
    conversion: '#16a34a',
    wdTaxDef: '#d97706',
    wdTaxable: '#0ea5e9',
    wdTaxFree: '#14b8a6',
  };
  const labels: Record<string, string> = {
    wages: 'Wages',
    pension: 'Pension',
    ssTaxable: 'SS (taxable)',
    rmd: 'RMD',
    conversion: 'Conversion',
    wdTaxDef: 'WD tax-def',
    wdTaxable: 'WD taxable',
    wdTaxFree: 'WD tax-free',
  };

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
      .padding(0.15);

    const maxY = d3.max(data, d => d.total) ?? 1;
    const y = d3.scaleLinear().domain([0, maxY]).nice().range([innerH, 0]);

    // Axes
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 5 === 0)))
      .selectAll('text').attr('font-size', 11);
    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => '$' + d3.format('.2s')(d as number).replace('G','B')))
      .selectAll('text').attr('font-size', 11);

    // Stacked bars
    const stack = d3.stack<Row>().keys(keys as string[]);
    const series = stack(data);
    g.append('g').selectAll('g')
      .data(series)
      .join('g')
      .attr('fill', d => colors[d.key])
      .selectAll('rect')
      .data(d => d.map(seg => ({ seg, key: d.key })))
      .join('rect')
      .attr('x', d => x(d.seg.data.age)!)
      .attr('y', d => y(d.seg[1]))
      .attr('height', d => Math.max(0, y(d.seg[0]) - y(d.seg[1])))
      .attr('width', x.bandwidth())
      .append('title')
      .text(d => `${labels[d.key]}: $${Math.round(d.seg[1] - d.seg[0]).toLocaleString()}`);

    // Marginal rate overlay (right axis)
    const yMR = d3.scaleLinear().domain([0, 0.5]).range([innerH, 0]);
    const line = d3.line<Row>()
      .x(d => (x(d.age) ?? 0) + x.bandwidth() / 2)
      .y(d => yMR(d.marginalRate))
      .curve(d3.curveStepAfter);
    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', '#dc2626').attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 2').attr('d', line);

    // Right axis for MR
    g.append('g').attr('transform', `translate(${innerW},0)`)
      .call(d3.axisRight(yMR).ticks(5).tickFormat(d => (Number(d) * 100).toFixed(0) + '%'))
      .selectAll('text').attr('font-size', 10).attr('fill', '#dc2626');
    g.append('text')
      .attr('transform', `translate(${innerW + 40},${innerH / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#dc2626')
      .text('Marginal rate');

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 30)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#666')
      .text('Age');
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
  <h3>Income sources by year (with marginal rate overlay)</h3>
  <svg bind:this={svg}></svg>
  <div class="legend">
    {#each keys as k}
      <span class="lg"><span class="sw" style:background={colors[k]}></span>{labels[k]}</span>
    {/each}
    <span class="lg"><span class="line"></span>Marginal rate</span>
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
  h3 { font-size: 13px; font-weight: 700; color: #2a4d8f; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  svg { width: 100%; display: block; }
  .legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; font-size: 11px; color: #555; }
  .lg { display: inline-flex; align-items: center; gap: 4px; }
  .sw { display: inline-block; width: 12px; height: 12px; border-radius: 2px; }
  .line { display: inline-block; width: 16px; height: 2px; background: #dc2626; border-top: 2px dashed #dc2626; background: transparent; }
</style>
