/* pareto.js — interactive
 * Cost-accuracy Pareto frontier with hover tooltips and clickable legend.
 * Data adapted from docs/05_results.tex L435-L520.
 */
(function () {
  const svg = document.getElementById('pareto-svg');
  if (!svg) return;

  const NS = 'http://www.w3.org/2000/svg';
  const W = 760, H = 380;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ===== shared tooltip =====
  const tip = document.getElementById('chart-tooltip');
  function showTip(html, evt) {
    if (!tip) return;
    tip.innerHTML = html;
    tip.style.left = evt.clientX + 'px';
    tip.style.top  = evt.clientY + 'px';
    tip.classList.add('visible');
  }
  function moveTip(evt) {
    if (!tip) return;
    tip.style.left = evt.clientX + 'px';
    tip.style.top  = evt.clientY + 'px';
  }
  function hideTip() { if (tip) tip.classList.remove('visible'); }

  // Layout: upper main panel + small lower panel for "Single" (with break)
  const m = { left: 64, right: 24, topU: 30, hU: 250, gap: 14, hL: 36, bottom: 48 };
  const iw = W - m.left - m.right;
  const upperTop = m.topU, upperBot = m.topU + m.hU;
  const lowerTop = upperBot + m.gap, lowerBot = lowerTop + m.hL;

  const xMin = 0.2, xMax = 8;
  const lx = v => m.left + (Math.log10(v) - Math.log10(xMin)) /
                            (Math.log10(xMax) - Math.log10(xMin)) * iw;
  const yMinU = 68, yMaxU = 94;
  const lyU = v => upperBot - (v - yMinU) / (yMaxU - yMinU) * m.hU;
  const yMinL = 44, yMaxL = 52;
  const lyL = v => lowerBot - (v - yMinL) / (yMaxL - yMinL) * m.hL;

  // === upper frame ===
  el('rect', { x: m.left, y: upperTop, width: iw, height: m.hU,
               fill: '#fff', stroke: '#e5e7eb' }, svg);
  const xticks = [0.3, 0.5, 1, 2, 3, 6];
  xticks.forEach(t => {
    const x = lx(t);
    el('line', { x1: x, x2: x, y1: upperTop, y2: upperBot,
                 stroke: '#f1f5f9', 'stroke-dasharray': '3 3',
                 'stroke-width': 1 }, svg);
    el('line', { x1: x, x2: x, y1: lowerTop, y2: lowerBot,
                 stroke: '#f1f5f9', 'stroke-dasharray': '3 3',
                 'stroke-width': 1 }, svg);
    el('text', { x, y: lowerBot + 14, 'font-size': 10,
                 'text-anchor': 'middle', fill: '#6b7280' },
       svg).textContent = t;
  });
  [70, 80, 90].forEach(t => {
    const y = lyU(t);
    el('line', { x1: m.left, x2: m.left + iw, y1: y, y2: y,
                 stroke: '#f1f5f9', 'stroke-dasharray': '3 3',
                 'stroke-width': 1 }, svg);
    el('text', { x: m.left - 8, y: y + 3, 'font-size': 10,
                 'text-anchor': 'end', fill: '#6b7280' },
       svg).textContent = t;
  });
  el('text', { x: 14, y: upperTop + m.hU / 2,
               'font-size': 11, 'text-anchor': 'middle',
               fill: '#1f2937', 'font-weight': 600,
               transform: `rotate(-90 14 ${upperTop + m.hU / 2})` },
     svg).textContent = 'Accuracy (%)';
  el('text', { x: m.left + iw / 2, y: H - 8,
               'font-size': 11, 'text-anchor': 'middle',
               fill: '#1f2937', 'font-weight': 600 },
     svg).textContent = 'Per-question cost (USD, log scale)';

  el('rect', { x: m.left, y: lowerTop, width: iw, height: m.hL,
               fill: '#fff', stroke: '#e5e7eb' }, svg);
  el('text', { x: m.left - 8, y: lyL(48) + 3, 'font-size': 10,
               'text-anchor': 'end', fill: '#6b7280' },
     svg).textContent = '48';
  el('line', { x1: m.left - 4, y1: upperBot - 3, x2: m.left + 4, y2: upperBot + 8,
               stroke: '#1f2937', 'stroke-width': 1 }, svg);
  el('line', { x1: m.left - 4, y1: upperBot + 5, x2: m.left + 4, y2: upperBot + 16,
               stroke: '#1f2937', 'stroke-width': 1 }, svg);

  const C = {
    serial: '#6b7280',
    stream: '#c0392b',
    single: '#1f6fb2',
    band:   '#c0392b',
  };

  // ===== Build series groups (each can be toggled) =====
  const groups = {
    band:    el('g', { 'data-key': 'band' }, svg),
    serial:  el('g', { 'data-key': 'serial' }, svg),
    streamH0:el('g', { 'data-key': 'streamH0' }, svg),
    streamH1:el('g', { 'data-key': 'streamH1' }, svg),
    single:  el('g', { 'data-key': 'single' }, svg),
  };

  // KV-cache band
  const bandPath =
    `M${lx(0.3442)} ${lyU(78.79)} ` +
    `L${lx(1.6111)} ${lyU(90.91)} ` +
    `L${lx(2.7502)} ${lyU(90.91)} ` +
    `L${lx(0.4661)} ${lyU(78.79)} Z`;
  el('path', { d: bandPath, fill: C.band, opacity: 0.13 }, groups.band);

  // ===== series data =====
  const serialPts = [
    { N: 1,  cost: 0.3969, acc: 70.45 },
    { N: 4,  cost: 1.0311, acc: 81.82 },
    { N: 16, cost: 5.4586, acc: 89.39 },
  ];
  const streamH0Pts = [
    { N: 1, cost: 0.4661, acc: 78.79 },
    { N: 4, cost: 2.7502, acc: 90.91 },
  ];
  const streamH1Pts = [
    { N: 1, cost: 0.3442, acc: 78.79 },
    { N: 4, cost: 1.6111, acc: 90.91 },
  ];
  const singlePt = { cost: 0.2649, acc: 48.11 };

  function addPoint({ parent, x, y, marker, color, fillOpacity = 1, hover }) {
    let m;
    if (marker === 'circ') {
      m = el('circle', { cx: x, cy: y, r: 5, fill: color,
                         class: 'chart-clickable',
                         opacity: fillOpacity }, parent);
    } else if (marker === 'tri') {
      m = el('polygon', {
        points: `${x},${y - 5} ${x - 5},${y + 5} ${x + 5},${y + 5}`,
        fill: color, opacity: fillOpacity,
        class: 'chart-clickable',
      }, parent);
    } else if (marker === 'star') {
      const sp = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 7 : 3;
        const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
        sp.push(`${x + r * Math.cos(a)},${y + r * Math.sin(a)}`);
      }
      m = el('polygon', { points: sp.join(' '), fill: color,
                          stroke: color, 'stroke-width': 0.8,
                          class: 'chart-clickable' }, parent);
    }
    if (m && hover) {
      m.addEventListener('mouseenter', e => showTip(hover, e));
      m.addEventListener('mousemove', moveTip);
      m.addEventListener('mouseleave', hideTip);
    }
    return m;
  }

  // Serial × N
  const serialPath = serialPts.map((p, i) =>
    `${i ? 'L' : 'M'}${lx(p.cost)} ${lyU(p.acc)}`).join(' ');
  el('path', { d: serialPath, stroke: C.serial,
               'stroke-width': 2, fill: 'none' }, groups.serial);
  serialPts.forEach(p => {
    addPoint({
      parent: groups.serial, x: lx(p.cost), y: lyU(p.acc),
      marker: 'circ', color: C.serial,
      hover: `<div class="tt-title" style="color:#9ca3af">Serial × ${p.N}</div>`
        + `<div class="tt-row"><span class="k">Cost</span><span class="v">$${p.cost.toFixed(2)}</span></div>`
        + `<div class="tt-row"><span class="k">Accuracy</span><span class="v">${p.acc.toFixed(1)}%</span></div>`
        + `<div class="tt-foot">Majority vote over ${p.N} chain replicas.</div>`,
    });
    el('text', {
      x: lx(p.cost), y: lyU(p.acc) + 16,
      'font-size': 9, 'text-anchor': 'middle', fill: C.serial,
      'pointer-events': 'none',
    }, groups.serial).textContent = `N=${p.N}`;
  });

  // Stream × N (h=0)
  const streamH0Path = streamH0Pts.map((p, i) =>
    `${i ? 'L' : 'M'}${lx(p.cost)} ${lyU(p.acc)}`).join(' ');
  el('path', { d: streamH0Path, stroke: C.stream,
               'stroke-width': 2.2, fill: 'none' }, groups.streamH0);
  streamH0Pts.forEach(p => {
    addPoint({
      parent: groups.streamH0, x: lx(p.cost), y: lyU(p.acc),
      marker: 'tri', color: C.stream,
      hover: `<div class="tt-title" style="color:#f4a89e">Stream × ${p.N} (h = 0, no KV-cache)</div>`
        + `<div class="tt-row"><span class="k">Cost</span><span class="v">$${p.cost.toFixed(2)}</span></div>`
        + `<div class="tt-row"><span class="k">Accuracy</span><span class="v">${p.acc.toFixed(1)}%</span></div>`,
    });
    el('text', {
      x: lx(p.cost), y: lyU(p.acc) - 10,
      'font-size': 9, 'text-anchor': 'middle', fill: C.stream,
      'pointer-events': 'none',
    }, groups.streamH0).textContent = `N=${p.N}`;
  });

  // Stream × N (h=1) - dashed
  const streamH1Path = streamH1Pts.map((p, i) =>
    `${i ? 'L' : 'M'}${lx(p.cost)} ${lyU(p.acc)}`).join(' ');
  el('path', { d: streamH1Path, stroke: C.stream,
               'stroke-width': 2.2, fill: 'none',
               'stroke-dasharray': '5 4' }, groups.streamH1);
  streamH1Pts.forEach(p => {
    addPoint({
      parent: groups.streamH1, x: lx(p.cost), y: lyU(p.acc),
      marker: 'tri', color: C.stream, fillOpacity: 0.7,
      hover: `<div class="tt-title" style="color:#f4a89e">Stream × ${p.N} (h = 1, full KV-cache)</div>`
        + `<div class="tt-row"><span class="k">Cost</span><span class="v">$${p.cost.toFixed(2)}</span></div>`
        + `<div class="tt-row"><span class="k">Accuracy</span><span class="v">${p.acc.toFixed(1)}%</span></div>`
        + `<div class="tt-foot">Same accuracy, lower cost via cache reuse.</div>`,
    });
  });

  // Single (lower panel star)
  addPoint({
    parent: groups.single,
    x: lx(singlePt.cost), y: lyL(singlePt.acc),
    marker: 'star', color: C.single,
    hover: `<div class="tt-title" style="color:#9ed1e3">Single agent</div>`
      + `<div class="tt-row"><span class="k">Cost</span><span class="v">$${singlePt.cost.toFixed(2)}</span></div>`
      + `<div class="tt-row"><span class="k">Accuracy</span><span class="v">${singlePt.acc.toFixed(1)}%</span></div>`
      + `<div class="tt-foot">Baseline — no multi-agent voting.</div>`,
  });

  // ===== Clickable legend =====
  const legendEntries = [
    { key: 'serial',   color: C.serial, dash: null,   marker: 'circ', label: 'Serial × N',
      members: ['serial'] },
    { key: 'streamH0', color: C.stream, dash: null,   marker: 'tri',  label: 'Stream × N (h=0)',
      members: ['streamH0', 'band'] },
    { key: 'streamH1', color: C.stream, dash: '5 4',  marker: 'tri',  label: 'Stream × N (h=1)',
      members: ['streamH1', 'band'] },
    { key: 'single',   color: C.single, dash: null,   marker: 'star', label: 'Single',
      members: ['single'] },
  ];
  const lgX = m.left + 10, lgY = upperTop + 8;
  el('rect', { x: lgX, y: lgY, width: 188, height: 80,
               fill: '#fff', stroke: '#e5e7eb', rx: 6 }, svg);

  // track which series are visible
  const visible = { serial: true, streamH0: true, streamH1: true, single: true };
  function refreshBand() {
    // band shown only if at least one stream curve is visible
    groups.band.style.display = (visible.streamH0 || visible.streamH1) ? '' : 'none';
  }

  legendEntries.forEach((entry, i) => {
    const y = lgY + 18 + i * 18;
    const itemG = el('g', {
      class: 'chart-legend-item', 'data-key': entry.key,
    }, svg);
    // line
    el('line', { x1: lgX + 6, x2: lgX + 30, y1: y, y2: y,
                 stroke: entry.color, 'stroke-width': 2,
                 'stroke-dasharray': entry.dash || '' }, itemG);
    // marker
    if (entry.marker === 'tri') {
      el('polygon', {
        points: `${lgX + 18},${y - 4} ${lgX + 14},${y + 4} ${lgX + 22},${y + 4}`,
        fill: entry.color,
      }, itemG);
    } else if (entry.marker === 'circ') {
      el('circle', { cx: lgX + 18, cy: y, r: 3, fill: entry.color }, itemG);
    } else if (entry.marker === 'star') {
      const sp = [];
      for (let k = 0; k < 10; k++) {
        const r = k % 2 === 0 ? 5 : 2.2;
        const a = (Math.PI * 2 * k) / 10 - Math.PI / 2;
        sp.push(`${lgX + 18 + r * Math.cos(a)},${y + r * Math.sin(a)}`);
      }
      el('polygon', { points: sp.join(' '), fill: entry.color }, itemG);
    }
    el('text', { x: lgX + 36, y: y + 3,
                 'font-size': 10, fill: '#1f2937' },
       itemG).textContent = entry.label;
    // expand hit area
    el('rect', { x: lgX + 2, y: y - 9, width: 184, height: 18,
                 fill: 'transparent' }, itemG);

    itemG.addEventListener('click', () => {
      visible[entry.key] = !visible[entry.key];
      itemG.classList.toggle('disabled', !visible[entry.key]);
      groups[entry.key].style.display = visible[entry.key] ? '' : 'none';
      refreshBand();
    });
  });
})();
