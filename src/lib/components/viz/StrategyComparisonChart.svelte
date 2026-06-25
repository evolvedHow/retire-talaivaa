<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';
  import { comparisonStore } from '../../stores/comparison';

  let svg: SVGSVGElement;
  let containerW = 800;

  const margin = { top: 24, right: 80, bottom: 36, left: 70 };
  const height = 360;

  type Row = {
    age: number;
    taxSavedReal: number;      // (without - with) totalTax, deflated to today's $
    cumSavedReal: number;      // running sum of taxSavedReal
    nwGapReal: number;         // (with - without) end-of-year total balance, in today's $
    nwWithReal: number;
    nwWithoutReal: number;
    conversion: number;
  };

  // Build rows from the comparison result. All money in today's $.
  $: rows = (() => {
    const c = $comparisonStore;
    if (!c) return [] as Row[];
    let cum = 0;
    return c.withStrategy.years.map((yw, i): Row => {
      const yo = c.withoutStrategy.years[i];
      const f = yw.inflationFactor;
      const savedReal = (yo.totalTax - yw.totalTax) / f;
      cum += savedReal;
      const nwWith = (yw.close.taxDeferred + yw.close.taxFree + yw.close.taxable) / f;
      const nwWithout = (yo.close.taxDeferred + yo.close.taxFree + yo.close.taxable) / f;
      return {
        age: yw.age,
        taxSavedReal: savedReal,
        cumSavedReal: cum,
        nwGapReal: nwWith - nwWithout,
        nwWithReal: nwWith,
        nwWithoutReal: nwWithout,
        conversion: yw.conversion / f,
      };
    });
  })();

  function fmt(v: number): string {
    const a = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
    if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(0)}k`;
    return `${sign}$${a.toFixed(0)}`;
  }

  function draw() {
    if (!svg || rows.length === 0) return;
    const innerW = containerW - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const root = d3.select(svg);
    root.selectAll('*').remove();
    root.attr('width', containerW).attr('height', height);
    const g = root.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand<number>()
      .domain(rows.map(d => d.age))
      .range([0, innerW])
      .padding(0.15);

    // Left axis: per-year tax savings (bars).
    const yLeftMin = Math.min(0, d3.min(rows, d => d.taxSavedReal) ?? 0);
    const yLeftMax = Math.max(0, d3.max(rows, d => d.taxSavedReal) ?? 0);
    const yLeft = d3.scaleLinear()
      .domain([yLeftMin, yLeftMax]).nice()
      .range([innerH, 0]);

    // Right axis: cumulative savings + net worth gap (lines).
    const cumValues = rows.flatMap(d => [d.cumSavedReal, d.nwGapReal]);
    const yRightMin = Math.min(0, d3.min(cumValues) ?? 0);
    const yRightMax = Math.max(0, d3.max(cumValues) ?? 0);
    const yRight = d3.scaleLinear()
      .domain([yRightMin, yRightMax]).nice()
      .range([innerH, 0]);

    // Zero line for left axis
    const zeroY = yLeft(0);

    // Bars: per-year tax savings (green if save, red if cost)
    g.append('g').selectAll('rect.bar')
      .data(rows)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.age) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', d => d.taxSavedReal >= 0 ? yLeft(d.taxSavedReal) : zeroY)
      .attr('height', d => Math.max(0, Math.abs(yLeft(d.taxSavedReal) - zeroY)))
      .attr('fill', d => d.taxSavedReal >= 0 ? '#16a34a' : '#dc2626')
      .attr('opacity', 0.7);

    // Zero baseline
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', zeroY).attr('y2', zeroY)
      .attr('stroke', '#9ca3af').attr('stroke-width', 1);

    // Axes
    g.append('g').attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % 5 === 0)))
      .selectAll('text').attr('font-size', 11);
    g.append('g')
      .call(d3.axisLeft(yLeft).ticks(6).tickFormat(d => '$' + d3.format('.2s')(d as number).replace('G','B')))
      .selectAll('text').attr('font-size', 11);
    g.append('g').attr('transform', `translate(${innerW},0)`)
      .call(d3.axisRight(yRight).ticks(6).tickFormat(d => '$' + d3.format('.2s')(d as number).replace('G','B')))
      .selectAll('text').attr('font-size', 11).attr('fill', '#1e3a8a');

    // Lines: cumulative tax savings + net worth gap
    const lineCum = d3.line<Row>()
      .x(d => (x(d.age) ?? 0) + x.bandwidth() / 2)
      .y(d => yRight(d.cumSavedReal))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(rows)
      .attr('fill', 'none').attr('stroke', '#2a4d8f').attr('stroke-width', 2.5)
      .attr('d', lineCum);

    const lineGap = d3.line<Row>()
      .x(d => (x(d.age) ?? 0) + x.bandwidth() / 2)
      .y(d => yRight(d.nwGapReal))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(rows)
      .attr('fill', 'none').attr('stroke', '#f59e0b').attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '5 3')
      .attr('d', lineGap);

    // Breakeven marker — first age where cumSavedReal crosses zero from negative to positive
    let breakeven: number | null = null;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i-1].cumSavedReal < 0 && rows[i].cumSavedReal >= 0) {
        breakeven = rows[i].age;
        break;
      }
    }
    if (breakeven != null) {
      const bx = (x(breakeven) ?? 0) + x.bandwidth() / 2;
      g.append('line')
        .attr('x1', bx).attr('x2', bx).attr('y1', 0).attr('y2', innerH)
        .attr('stroke', '#16a34a').attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3 3');
      g.append('text').attr('x', bx + 4).attr('y', 12)
        .attr('font-size', 10).attr('fill', '#16a34a').attr('font-weight', 700)
        .text(`Breakeven @ ${breakeven}`);
    }

    // Hover tooltip per year
    g.append('g').selectAll('rect.hover')
      .data(rows)
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
        `Conversion: ${fmt(d.conversion)}`,
        `Tax saved this year: ${fmt(d.taxSavedReal)}`,
        `Cumulative saved: ${fmt(d.cumSavedReal)}`,
        `Net worth — with: ${fmt(d.nwWithReal)}`,
        `Net worth — without: ${fmt(d.nwWithoutReal)}`,
        `NW gap (strategy − baseline): ${fmt(d.nwGapReal)}`,
      ].join('\n'));

    // Axis labels
    g.append('text').attr('x', innerW / 2).attr('y', innerH + 30)
      .attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#666')
      .text('Age');
    g.append('text')
      .attr('transform', `translate(-50,${innerH / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#666')
      .text('Per-year tax saved (real $)');
    g.append('text')
      .attr('transform', `translate(${innerW + 60},${innerH / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#1e3a8a')
      .text('Cumulative / NW gap (real $)');
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
    <h3>Strategy vs do-nothing — differences over time (today's $)</h3>
  </header>
  <svg bind:this={svg}></svg>
  <div class="legend">
    <span class="lg"><span class="sw" style:background="#16a34a"></span>Tax saved this year (bar)</span>
    <span class="lg"><span class="sw" style:background="#dc2626"></span>Tax cost this year (bar)</span>
    <span class="lg"><span class="line solid"></span>Cumulative tax saved</span>
    <span class="lg"><span class="line dashed"></span>Net-worth gap (with − without)</span>
    <span class="lg"><span class="line break"></span>Breakeven age</span>
  </div>
  <p class="hint">
    Strategy pays tax up-front to grow the Roth bucket tax-free. Bars below zero are years you pay more
    (conversion years); after the bracket-fill window ends, savings should accumulate as RMDs &amp; IRMAA
    shrink. The orange dashed line is the net-worth advantage — climbing = strategy compounding ahead.
  </p>
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
  .legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 11px; color: #555; align-items: center; }
  .lg { display: inline-flex; align-items: center; gap: 4px; }
  .sw { display: inline-block; width: 12px; height: 12px; border-radius: 2px; opacity: 0.7; }
  .line { display: inline-block; width: 18px; height: 2px; }
  .line.solid { background: #2a4d8f; }
  .line.dashed { border-top: 2px dashed #f59e0b; height: 0; }
  .line.break { border-left: 1.5px dashed #16a34a; width: 0; height: 12px; }
  .hint { font-size: 11px; color: #6b7280; margin-top: 8px; font-style: italic; line-height: 1.4; }
</style>
