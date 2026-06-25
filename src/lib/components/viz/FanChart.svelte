<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';
  import { mcResultStore } from '../../stores/mc';
  import { scenarioStore } from '../../stores/scenario';
  import { displayModeStore } from '../../stores/path';
  import type { AgeBand } from '../../sim/monteCarlo';

  export let title: string;
  export let series: 'totalBalanceByAge' | 'taxFreeByAge' | 'taxDeferredByAge' | 'taxableByAge' = 'totalBalanceByAge';

  let svg: SVGSVGElement;
  let containerW = 800;
  const margin = { top: 20, right: 80, bottom: 36, left: 60 };
  const height = 260;

  $: data = (() => {
    if (!$mcResultStore) return [] as AgeBand[];
    const raw = $mcResultStore[series];
    if ($displayModeStore === 'nominal') return raw;
    // Real-dollar adjustment: divide by inflation factor compounded from base
    const infl = $scenarioStore.inflationRate;
    return raw.map((b, i) => {
      const factor = Math.pow(1 + infl, i);
      return {
        age: b.age,
        bands: {
          p10: b.bands.p10 / factor,
          p25: b.bands.p25 / factor,
          p50: b.bands.p50 / factor,
          p75: b.bands.p75 / factor,
          p90: b.bands.p90 / factor,
          mean: b.bands.mean / factor,
        },
      };
    });
  })();

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
    const maxY = d3.max(data, d => d.bands.p90) ?? 1;
    const y = d3.scaleLinear().domain([0, maxY]).nice().range([innerH, 0]);

    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d => `${d}`))
      .selectAll('text').attr('font-size', 11);
    g.append('g')
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => '$' + d3.format('.2s')(d as number).replace('G','B')))
      .selectAll('text').attr('font-size', 11);

    // p10-p90 wide band
    const area90 = d3.area<AgeBand>()
      .x(d => x(d.age))
      .y0(d => y(d.bands.p10))
      .y1(d => y(d.bands.p90))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(data)
      .attr('fill', '#bfdbfe').attr('opacity', 0.7).attr('d', area90);

    // p25-p75 narrow band
    const area50 = d3.area<AgeBand>()
      .x(d => x(d.age))
      .y0(d => y(d.bands.p25))
      .y1(d => y(d.bands.p75))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(data)
      .attr('fill', '#60a5fa').attr('opacity', 0.7).attr('d', area50);

    // Median line
    const line = d3.line<AgeBand>()
      .x(d => x(d.age))
      .y(d => y(d.bands.p50))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', '#1e3a8a').attr('stroke-width', 2).attr('d', line);

    // Mean line (dashed)
    const meanLine = d3.line<AgeBand>()
      .x(d => x(d.age))
      .y(d => y(d.bands.mean))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(data)
      .attr('fill', 'none').attr('stroke', '#dc2626').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3').attr('d', meanLine);

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 30)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#666')
      .text('Age');

    // Legend
    const legend = root.append('g').attr('transform', `translate(${containerW - margin.right + 8},${margin.top})`);
    const rows = [
      { color: '#bfdbfe', label: 'p10–p90' },
      { color: '#60a5fa', label: 'p25–p75' },
      { color: '#1e3a8a', label: 'median', stroke: true },
      { color: '#dc2626', label: 'mean', stroke: true, dashed: true },
    ];
    rows.forEach((r, i) => {
      const row = legend.append('g').attr('transform', `translate(0,${i * 16})`);
      if (r.stroke) {
        row.append('line').attr('x1', 0).attr('x2', 14).attr('y1', 6).attr('y2', 6)
          .attr('stroke', r.color).attr('stroke-width', 2)
          .attr('stroke-dasharray', r.dashed ? '3 2' : null);
      } else {
        row.append('rect').attr('width', 14).attr('height', 10).attr('fill', r.color).attr('rx', 2);
      }
      row.append('text').attr('x', 18).attr('y', 9).attr('font-size', 10).attr('fill', '#333').text(r.label);
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
  <h3>{title}</h3>
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
