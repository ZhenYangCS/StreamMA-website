/* scaling_heatmap.js — interactive
 *  (left)  speedup curves: hover points / click legend to toggle A series.
 *  (right) accuracy heatmap: hover cell, click axis tick to highlight row/col.
 * Data hard-coded from docs/05_results.tex L261-L413.
 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
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

  /* ============================================================
   * LEFT: speedup curves
   * ============================================================ */
  (function speedup() {
    const svg = document.getElementById('scaling-speedup-svg');
    if (!svg) return;
    const W = 460, H = 320;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    const m = { top: 30, right: 18, bottom: 46, left: 50 };
    const iw = W - m.left - m.right, ih = H - m.top - m.bottom;

    const xMin = 1, xMax = 80;
    const yMin = 1, yMax = 40;
    const lx = v => m.left + (Math.log2(v) - Math.log2(xMin)) /
                            (Math.log2(xMax) - Math.log2(xMin)) * iw;
    const ly = v => m.top + ih - (Math.log2(v) - Math.log2(yMin)) /
                                  (Math.log2(yMax) - Math.log2(yMin)) * ih;

    el('rect', { x: m.left, y: m.top, width: iw, height: ih,
                 fill: '#fff', stroke: '#e5e7eb' }, svg);
    el('line', { x1: lx(1.45), x2: lx(1.45), y1: m.top, y2: m.top + ih,
                 stroke: '#1f2937', 'stroke-width': 1.2 }, svg);

    const xticks = [1, 2, 4, 8, 16, 32, 64];
    xticks.forEach(t => {
      const x = lx(t);
      el('line', { x1: x, x2: x, y1: m.top, y2: m.top + ih,
                   stroke: '#f1f5f9', 'stroke-width': 1 }, svg);
      const lbl = (t === 1) ? 'auto' : `2^${Math.log2(t)}`;
      el('text', { x, y: m.top + ih + 14, 'font-size': 10,
                   'text-anchor': 'middle', fill: '#6b7280' },
         svg).textContent = lbl;
    });
    const yticks = [1, 2, 4, 8, 16, 32];
    yticks.forEach(t => {
      const y = ly(t);
      el('line', { x1: m.left, x2: m.left + iw, y1: y, y2: y,
                   stroke: '#f1f5f9', 'stroke-width': 1 }, svg);
      el('text', { x: m.left - 6, y: y + 3, 'font-size': 10,
                   'text-anchor': 'end', fill: '#6b7280' },
         svg).textContent = t;
    });

    el('text', { x: m.left + iw / 2, y: H - 6,
                 'font-size': 11, 'text-anchor': 'middle',
                 fill: '#1f2937', 'font-weight': 600 },
       svg).textContent = 'Per-agent steps S';
    el('text', { x: 14, y: m.top + ih / 2,
                 'font-size': 11, 'text-anchor': 'middle',
                 fill: '#1f2937', 'font-weight': 600,
                 transform: `rotate(-90 14 ${m.top + ih / 2})` },
       svg).textContent = 'Speedup';

    const series = [
      { A: 4,  color: '#0072B2', auto: 1.96,
        meas:  [[2,1.30],[4,1.80],[8,2.02],[16,2.20],[32,2.19],[64,2.22]],
        bound: [[2,1.60],[4,2.29],[8,2.91],[16,3.37],[32,3.66],[64,3.82]] },
      { A: 16, color: '#E69F00', auto: 3.38,
        meas:  [[2,1.75],[4,2.72],[8,4.32],[16,5.92],[32,7.45],[64,7.86]],
        bound: [[2,1.88],[4,3.37],[8,5.57],[16,8.26],[32,10.89],[64,12.96]] },
      { A: 64, color: '#D55E00', auto: 4.21,
        meas:  [[2,1.92],[4,3.23],[8,5.83],[16,8.68],[32,17.09],[64,26.91]],
        bound: [[2,1.97],[4,3.82],[8,7.21],[16,12.96],[32,21.56],[64,32.25]] },
    ];

    function pathOf(arr) {
      return arr.map((p, i) => `${i ? 'L' : 'M'}${lx(p[0])} ${ly(p[1])}`).join(' ');
    }

    // group per series for easy show/hide
    const seriesGroups = series.map(s => {
      const g = el('g', { 'data-A': s.A }, svg);
      el('path', { d: pathOf(s.bound), stroke: s.color, 'stroke-width': 1.6,
                   'stroke-dasharray': '5 4', fill: 'none', opacity: 0.7 }, g);
      el('path', { d: pathOf(s.meas), stroke: s.color, 'stroke-width': 2.2,
                   fill: 'none' }, g);
      // auto marker (S=auto)
      const autoBound = (s.A * 1) / (1 + s.A - 1); // S=1 case = 1; not really meaningful
      const autoCirc = el('circle', {
        cx: lx(1), cy: ly(s.auto), r: 4.2,
        fill: s.color, class: 'chart-clickable',
      }, g);
      autoCirc.addEventListener('mouseenter', e => {
        showTip(`<div class="tt-title" style="color:${s.color}">A = ${s.A}, S = auto</div>`
          + `<div class="tt-row"><span class="k">Measured speedup</span><span class="v">${s.auto.toFixed(2)}\u00d7</span></div>`
          + `<div class="tt-foot">LLM-decided step count (coarse).</div>`, e);
      });
      autoCirc.addEventListener('mousemove', moveTip);
      autoCirc.addEventListener('mouseleave', hideTip);

      // measured points
      s.meas.forEach((p, i) => {
        const c = el('circle', {
          cx: lx(p[0]), cy: ly(p[1]), r: 3.6,
          fill: s.color, class: 'chart-clickable',
        }, g);
        const bound = s.bound[i][1];
        const util = (p[1] / bound * 100).toFixed(0);
        c.addEventListener('mouseenter', e => {
          showTip(`<div class="tt-title" style="color:${s.color}">A = ${s.A}, S = ${p[0]}</div>`
            + `<div class="tt-row"><span class="k">Measured</span><span class="v">${p[1].toFixed(2)}\u00d7</span></div>`
            + `<div class="tt-row"><span class="k">Theoretical bound</span><span class="v">${bound.toFixed(2)}\u00d7</span></div>`
            + `<div class="tt-row"><span class="k">Utilisation</span><span class="v">${util}%</span></div>`, e);
        });
        c.addEventListener('mousemove', moveTip);
        c.addEventListener('mouseleave', hideTip);
      });
      return { s, g };
    });

    // legend (clickable)
    const legendX = m.left + 12, legendY = m.top + 10;
    seriesGroups.forEach((sg, i) => {
      const s = sg.s;
      const y = legendY + i * 14;
      const lg = el('g', { class: 'chart-legend-item', 'data-A': s.A }, svg);
      el('line', { x1: legendX, x2: legendX + 18, y1: y, y2: y,
                   stroke: s.color, 'stroke-width': 2 }, lg);
      el('circle', { cx: legendX + 9, cy: y, r: 2.6, fill: s.color }, lg);
      el('text', { x: legendX + 24, y: y + 3,
                   'font-size': 10, fill: '#1f2937' },
         lg).textContent = `A=${s.A}`;
      // expand hit area
      el('rect', { x: legendX - 2, y: y - 8, width: 60, height: 14,
                   fill: 'transparent' }, lg);
      lg.addEventListener('click', () => {
        const off = lg.classList.toggle('disabled');
        sg.g.style.display = off ? 'none' : '';
      });
    });

    el('text', { x: m.left + iw / 2, y: m.top - 10,
                 'font-size': 11, 'font-style': 'italic',
                 'text-anchor': 'middle', fill: '#6b7280' },
       svg).textContent = 'Solid: measured.  Dashed: theoretical bound  AS / (S + A − 1).';
  })();

  /* ============================================================
   * RIGHT: 6x6 accuracy heatmap (with avg row + col + auto col)
   * ============================================================ */
  (function heatmap() {
    const svg = document.getElementById('scaling-heatmap-svg');
    if (!svg) return;
    const W = 460, H = 320;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';

    // Safety net: when the cursor leaves the SVG, force-hide the tooltip.
    // CSS scale(1.35) on .heatmap-cell:hover combined with svg.appendChild(cellG)
    // can occasionally swallow the cell-level mouseleave event, leaving the
    // tooltip stuck. This guarantees it disappears as soon as the pointer
    // leaves the chart area.
    svg.addEventListener('mouseleave', hideTip);

    const colLabels = ['auto', '2¹', '2²', '2³', '2⁴', '2⁵', '2⁶', 'avg'];
    const colS      = ['auto', 2, 4, 8, 16, 32, 64, 'avg'];
    // Rows top-to-bottom match the paper: avg row at top, then A=2⁶ → 2¹ descending.
    const rowLabels = ['avg', '2⁶', '2⁵', '2⁴', '2³', '2²', '2¹'];
    const rowA      = ['avg', 64, 32, 16, 8, 4, 2];

    const data = [
      // avg row (top, matches paper)
      [null,  62.0,  62.1,  64.9,  67.8,  67.4,  68.8,  null],
      // A=64
      [68.19, 68.94, 66.67, 67.43, 68.19, 71.97, 73.49, 69.4],
      // A=32
      [67.43, 65.91, 67.43, 68.19, 71.97, 73.49, 69.70, 69.4],
      // A=16
      [66.67, 62.88, 64.40, 66.67, 74.25, 69.70, 75.00, 68.8],
      // A=8
      [62.88, 62.88, 62.88, 68.19, 68.94, 65.16, 68.94, 66.2],
      // A=4
      [62.88, 59.85, 62.13, 61.37, 64.40, 62.88, 62.13, 62.1],
      // A=2 (bottom)
      [58.34, 51.52, 49.24, 57.58, 59.10, 61.37, 63.64, 57.1],
    ];

    const m = { top: 30, right: 70, bottom: 46, left: 50 };
    const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    const cols = 8, rows = 7;
    const cw = iw / cols, ch = ih / rows;
    const min = 49, max = 76;

    function cmap(v) {
      const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
      const stops = [
        [1.00, 0.99, 0.85],
        [0.55, 0.78, 0.22],
        [0.15, 0.45, 0.00],
      ];
      let a, b, k;
      if (t < 0.5) { a = stops[0]; b = stops[1]; k = t / 0.5; }
      else { a = stops[1]; b = stops[2]; k = (t - 0.5) / 0.5; }
      const r = a[0] + (b[0] - a[0]) * k;
      const g = a[1] + (b[1] - a[1]) * k;
      const bl = a[2] + (b[2] - a[2]) * k;
      return `rgb(${(r*255)|0},${(g*255)|0},${(bl*255)|0})`;
    }

    // baseline (S=auto, A=64) for delta hint -- now at data[1][0] (row 1 = A=64)
    const baselineAuto64 = data[1][0]; // 68.19

    const cellMap = []; // [row][col] = rect
    for (let r = 0; r < rows; r++) {
      cellMap[r] = [];
      for (let c = 0; c < cols; c++) {
        const v = data[r][c];
        const x = m.left + c * cw, y = m.top + r * ch;
        if (v === null) {
          el('rect', { x, y, width: cw, height: ch, fill: '#ffffff' }, svg);
          continue;
        }
        const cellG = el('g', {
          class: 'chart-clickable heatmap-cell',
        }, svg);
        cellMap[r][c] = cellG;
        const rect = el('rect', {
          x, y, width: cw, height: ch,
          fill: cmap(v),
          stroke: '#fff', 'stroke-width': 0.8,
        }, cellG);

        const txt = el('text', {
          x: x + cw / 2, y: y + ch / 2 + 3,
          'font-size': 9.5, 'text-anchor': 'middle',
          fill: '#1f2937',
          'pointer-events': 'none',
        }, cellG);
        txt.textContent = v.toFixed(1);

        // hover handler
        cellG.addEventListener('mouseenter', e => {
          // Raise this cell to the end of the SVG so the scale-up effect
          // is not occluded by neighbouring cells / the outline rect.
          svg.appendChild(cellG);
          const aLabel = rowA[r];
          const sLabel = colS[c];
          const isAvg = (aLabel === 'avg' || sLabel === 'avg');
          const rowAutoVal = data[r][0]; // same-row auto baseline
          const delta = (v - rowAutoVal);
          const dStr = (delta >= 0 ? '+' : '') + delta.toFixed(1) + ' pp';
          const dColor = delta >= 0 ? '#176c4d' : '#c0392b';
          let extra = '';
          if (!isAvg && sLabel !== 'auto') {
            extra = `<div class="tt-row"><span class="k">vs auto</span>`
                  + `<span class="v" style="color:${dColor}">${dStr}</span></div>`;
          }
          showTip(
            `<div class="tt-title">A = ${aLabel}, S = ${sLabel}</div>`
            + `<div class="tt-row"><span class="k">Accuracy</span>`
            + `<span class="v">${v.toFixed(1)}%</span></div>`
            + extra, e);
        });
        cellG.addEventListener('mousemove', moveTip);
        cellG.addEventListener('mouseleave', hideTip);
      }
    }

    // outline of main 6x6 block (rows 1..6, cols 1..6, excluding avg row + avg col + auto col)
    el('rect', {
      x: m.left + cw, y: m.top + ch,
      width: cw * 6, height: ch * 6,
      fill: 'none', stroke: '#1f2937', 'stroke-width': 1.6,
      'pointer-events': 'none',
    }, svg);

    // axis labels (clickable: highlight row/col)
    function clearHighlight() {
      svg.querySelectorAll('.chart-axis-tick').forEach(t => t.classList.remove('active'));
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (cellMap[r][c]) cellMap[r][c].classList.remove('chart-dim');
    }
    function highlightCol(c) {
      for (let r = 0; r < rows; r++)
        for (let cc = 0; cc < cols; cc++)
          if (cellMap[r][cc])
            cellMap[r][cc].classList.toggle('chart-dim', cc !== c);
    }
    function highlightRow(r) {
      for (let rr = 0; rr < rows; rr++)
        for (let c = 0; c < cols; c++)
          if (cellMap[rr][c])
            cellMap[rr][c].classList.toggle('chart-dim', rr !== r);
    }

    colLabels.forEach((lbl, i) => {
      const t = el('text', {
        x: m.left + (i + 0.5) * cw, y: m.top + ih + 14,
        'font-size': 10, 'text-anchor': 'middle', fill: '#1f2937',
        class: 'chart-axis-tick',
      }, svg);
      t.textContent = lbl;
      t.addEventListener('click', () => {
        const wasActive = t.classList.contains('active');
        clearHighlight();
        if (!wasActive) { t.classList.add('active'); highlightCol(i); }
      });
    });
    rowLabels.forEach((lbl, i) => {
      const t = el('text', {
        x: m.left - 6, y: m.top + (i + 0.5) * ch + 3,
        'font-size': 10, 'text-anchor': 'end', fill: '#1f2937',
        class: 'chart-axis-tick',
      }, svg);
      t.textContent = lbl;
      t.addEventListener('click', () => {
        const wasActive = t.classList.contains('active');
        clearHighlight();
        if (!wasActive) { t.classList.add('active'); highlightRow(i); }
      });
    });

    el('text', {
      x: m.left + iw / 2, y: H - 6,
      'font-size': 11, 'text-anchor': 'middle',
      fill: '#1f2937', 'font-weight': 600,
    }, svg).textContent = 'Per-agent steps S';
    el('text', {
      x: 14, y: m.top + ih / 2,
      'font-size': 11, 'text-anchor': 'middle',
      fill: '#1f2937', 'font-weight': 600,
      transform: `rotate(-90 14 ${m.top + ih / 2})`,
    }, svg).textContent = 'Agents A';

    // colorbar
    const cbX = m.left + iw + 14, cbY = m.top, cbW = 14, cbH = ih;
    const grad = el('defs', {}, svg);
    const lg = el('linearGradient', {
      id: 'cmap-grad', x1: 0, x2: 0, y1: 1, y2: 0,
    }, grad);
    el('stop', { offset: '0%',  'stop-color': cmap(min) }, lg);
    el('stop', { offset: '50%', 'stop-color': cmap((min+max)/2) }, lg);
    el('stop', { offset: '100%', 'stop-color': cmap(max) }, lg);
    el('rect', { x: cbX, y: cbY, width: cbW, height: cbH,
                 fill: 'url(#cmap-grad)', stroke: '#e5e7eb' }, svg);
    [min, (min+max)/2, max].forEach((v, i) => {
      const y = cbY + cbH - (i / 2) * cbH;
      el('text', {
        x: cbX + cbW + 4, y: y + 3,
        'font-size': 9, fill: '#6b7280',
      }, svg).textContent = v.toFixed(0);
    });

    el('text', {
      x: m.left + iw / 2, y: m.top - 10,
      'font-size': 11, 'font-style': 'italic',
      'text-anchor': 'middle', fill: '#6b7280',
    }, svg).textContent = 'HMMT 2026 accuracy (%) — GPT-5.4-medium';
  })();
})();
