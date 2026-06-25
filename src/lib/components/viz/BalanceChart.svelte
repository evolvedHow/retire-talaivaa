<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';
  import { pathStore, displayModeStore } from '../../stores/path';

  let svg: SVGSVGElement;
  let containerW = 800;

  const margin = { top: 20, right: 120, bottom: 36, left: 60 };
  const height = 280;

  $: data = $pathStore?.years.map(y => {
    const f = $displayModeStore === 'real' ? y.inflationFactor : 1;
    return {
      age: y.age,
      taxDeferred: y.close.taxDeferred / f,
      taxFree: y.close.taxFree / f,
      taxable: y.close.taxable / f,
    };
  }) ?? [];

  function draw() {
    if (!svg || data.length === 0) return;
    const innerW = containerW - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const root = d3.select(svg);
    root.selectAll('*').remove();
    root.attr('width', containerW).attr('height', height);

    const g = root.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.age) as [number, number])
      .range([0, innerW]);

    const maxY = d3.max(data, d => Math.max(d.taxDeferred, d.taxFree, d.taxable)) ?? 1;
    const y = d3.scaleLinear().domain([0, maxY]).nice().range([innerH, 0]);

    // Axes
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d => `${d}`))
      .selectAll('text').attr('font-size', 11);
    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => '$' + d3.format('.2s')(d as number).replace('G','B')))
      .selectAll('text').attr('font-size', 11);

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 30)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#666')
      .text('Age');

    const series: { key: keyof typeof data[0]; color: string; label: string }[] = [
      { key: 'taxDeferred', color: '#d97706', label: 'Tax-deferred' },
      { key: 'taxFree', color: '#16a34a', label: 'Tax-free (Roth)' },
      { key: 'taxable', color: '#3b82f6', label: 'Taxable' },
    ];

    for (const s of series) {
      const line = d3.line<typeof data[0]>()
        .x(d => x(d.age))
        .y(d => y(d[s.key] as number))
        .curve(d3.curveMonotoneX);
      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', s.color)
        .attr('stroke-width', 2)
        .attr('d', line);
    }

    // Legend
    const legend = root.append('g').attr('transform', `translate(${containerW - margin.right + 10},${margin.top})`);
    series.forEach((s, i) => {
      const row = legend.append('g').attr('transform', `translate(0,${i * 18})`);
      row.append('rect').attr('width', 12).attr('height', 12).attr('fill', s.color).attr('rx', 2);
      row.append('text').attr('x', 16).attr('y', 10).attr('font-size', 11).attr('fill', '#333').text(s.label);
    });
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
  <h3>Account balances over time</h3>
  <svg bind:this={svg}></svg>
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
</style>
