/* perturbation.js
 * Step-level perturbation visualisation, adapted from
 * docs/05_results.tex L131-L226 (Fig. step-wise perturbation).
 * 6 mask rows, Serial vs Stream accuracy bars, with delta callouts.
 */
(function () {
  const svg = document.getElementById('perturb-svg');
  if (!svg) return;

  const NS = 'http://www.w3.org/2000/svg';

  const C = {
    serial: '#4f6f9a',
    serialLight: '#bdd3e8',
    stream: '#d68a2b',
    streamLight: '#f2d2a8',
    posDelta: '#176c4d',
    negDelta: '#c0392b',
    cleanFill: '#ffffff',
    cleanStroke: '#9ca3af',
    perturbFill: '#374151',
    rule: '#e5e7eb',
    ink: '#1f2937',
    sub: '#6b7280',
  };

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

  // Data: mask is 4-bit; bit=1 means clean, bit=0 means perturbed.  Caption keys map to
  // Theorem 1's case (see docs/04_method.tex L48-L171).
  const rowData = [
    { mask: '1110', serial: 67, stream: 91, group: 'tail', delta: +24,
      caseId: 'I.a', note: 'Reliable head, tail perturbed at the very end — the Stream-advantage sweet spot.' },
    { mask: '1100', serial: 63, stream: 82, group: 'tail', delta: +19,
      caseId: 'I.a', note: 'Half the tail corrupted; Stream still wins, gap shrinks.' },
    { mask: '1000', serial: 76, stream: 81, group: 'tail', delta:  +5,
      caseId: 'I.b', note: 'Only the first step is clean — Stream advantage shrinks but persists.' },
    { mask: '0111', serial: 97, stream: 63, group: 'head', delta: -34,
      caseId: 'II.b', note: 'First step poisoned, but the chain self-corrects — Serial wins big.' },
    { mask: '0011', serial:100, stream: 64, group: 'head', delta: -36,
      caseId: 'II / III', note: 'Two-thirds of the head corrupted — worst case for Stream.' },
    { mask: '0001', serial: 98, stream: 65, group: 'head', delta: -33,
      caseId: 'III.a', note: 'Heavily poisoned prefix — Stream is trapped by the bad start.' },
  ];

  // ---- Vertical layout, top to bottom ----
  const W = 1000;
  const PAD_TOP        = 14;
  const LEGEND_H       = 26;
  const HEADER_H       = 30;
  const GROUP_LABEL_H  = 26;
  const ROW_H          = 46;
  const MID_GAP_H      = 36;
  const PAD_BOTTOM     = 18;
  const H = PAD_TOP + LEGEND_H + HEADER_H
          + GROUP_LABEL_H + 3 * ROW_H
          + MID_GAP_H
          + 3 * ROW_H + PAD_BOTTOM;

  const LEFT_MARGIN  = 80;
  const RIGHT_MARGIN = 110;
  const innerW = W - LEFT_MARGIN - RIGHT_MARGIN;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // === Strip 1: legend ===
  const legendY = PAD_TOP + LEGEND_H / 2;
  const legendG = el('g', {}, svg);
  let lx = LEFT_MARGIN;
  function legendItem(swatch, label, advance) {
    swatch(lx, legendY);
    el('text', {
      x: lx + 22, y: legendY + 4,
      'font-size': 11, fill: C.sub,
    }, legendG).textContent = label;
    lx += advance;
  }
  legendItem((x, y) => el('rect', {
    x, y: y - 7, width: 14, height: 14, rx: 2,
    fill: C.cleanFill, stroke: C.cleanStroke, 'stroke-width': 0.9,
  }, legendG), 'clean', 80);
  legendItem((x, y) => el('rect', {
    x, y: y - 7, width: 14, height: 14, rx: 2,
    fill: C.perturbFill,
  }, legendG), 'perturbed', 110);
  legendItem((x, y) => el('rect', {
    x, y: y - 5, width: 16, height: 10, rx: 2,
    fill: C.serialLight,
  }, legendG), 'Serial', 90);
  legendItem((x, y) => el('rect', {
    x, y: y - 5, width: 16, height: 10, rx: 2,
    fill: C.streamLight,
  }, legendG), 'Stream', 90);

  // === Strip 2: column headers ===
  const headerY = PAD_TOP + LEGEND_H + HEADER_H / 2 + 4;
  const maskBoxW = 18, maskGap = 5;
  const maskAreaW = 4 * maskBoxW + 3 * maskGap;
  const barAreaX = LEFT_MARGIN + maskAreaW + 36;
  const barAreaW = innerW - maskAreaW - 36 - 90;

  el('text', {
    x: LEFT_MARGIN, y: headerY,
    'font-size': 12, 'font-weight': 700, fill: C.ink,
  }, svg).textContent = 'Agent¹ steps';
  el('text', {
    x: barAreaX, y: headerY,
    'font-size': 12, 'font-weight': 700, fill: C.ink,
  }, svg).textContent = 'Agent² accuracy (%)';
  el('text', {
    x: W - RIGHT_MARGIN + 8, y: headerY,
    'font-size': 12, 'font-weight': 700, fill: C.ink,
  }, svg).textContent = 'Δ Stream − Serial';

  // ===== Group labels (clickable) =====
  // We'll wire click handlers AFTER all rows are drawn so we have references.
  const tailLabelY = PAD_TOP + LEGEND_H + HEADER_H + GROUP_LABEL_H / 2 + 4;
  const tailGroup = el('g', {
    class: 'perturb-group-label', 'data-group': 'tail',
  }, svg);
  el('circle', {
    cx: LEFT_MARGIN - 12, cy: tailLabelY - 4, r: 4,
    fill: C.posDelta,
  }, tailGroup);
  el('text', {
    x: LEFT_MARGIN, y: tailLabelY,
    'font-size': 12, 'font-style': 'italic',
    'font-weight': 700, fill: C.posDelta,
  }, tailGroup).textContent = 'Theorem 1 · Case I — tail perturbed';
  el('rect', {
    x: LEFT_MARGIN - 18, y: tailLabelY - 16, width: 320, height: 22,
    fill: 'transparent',
  }, tailGroup);

  const rowGroups = []; // collected for hover/dim

  // ===== Per-row drawing =====
  function drawRow(idx, yTop) {
    const r = rowData[idx];
    const yCenter = yTop + ROW_H / 2;

    // Wrap entire row in <g> for hover handling
    const g = el('g', {
      class: 'chart-clickable perturb-row',
      'data-group': r.group,
      'data-idx': idx,
    }, svg);

    // 4-bit mask
    r.mask.split('').forEach((bit, j) => {
      const isClean = bit === '1';
      const x = LEFT_MARGIN + j * (maskBoxW + maskGap);
      el('rect', {
        x, y: yCenter - maskBoxW / 2,
        width: maskBoxW, height: maskBoxW,
        rx: 2, ry: 2,
        fill: isClean ? C.cleanFill : C.perturbFill,
        stroke: isClean ? C.cleanStroke : C.perturbFill,
        'stroke-width': 0.9,
      }, g);
    });

    // accuracy bars: serial above, stream below
    const barH = 13;
    const gapBetweenBars = 3;
    const serialY = yCenter - barH - gapBetweenBars / 2;
    const streamY = yCenter + gapBetweenBars / 2;

    const serialW = (r.serial / 100) * barAreaW;
    const streamW = (r.stream / 100) * barAreaW;

    const serialRect = el('rect', {
      x: barAreaX, y: serialY,
      width: serialW, height: barH,
      rx: 3, ry: 3, fill: C.serialLight,
    }, g);
    const serialTextX = serialW > 32 ? barAreaX + 6 : barAreaX + serialW + 4;
    el('text', {
      x: serialTextX, y: serialY + barH - 3,
      'font-size': 10, 'font-weight': 700, fill: C.ink,
      'pointer-events': 'none',
    }, g).textContent = r.serial.toFixed(1);

    const streamRect = el('rect', {
      x: barAreaX, y: streamY,
      width: streamW, height: barH,
      rx: 3, ry: 3, fill: C.streamLight,
    }, g);
    const streamTextX = streamW > 32 ? barAreaX + 6 : barAreaX + streamW + 4;
    el('text', {
      x: streamTextX, y: streamY + barH - 3,
      'font-size': 10, 'font-weight': 700, fill: C.ink,
      'pointer-events': 'none',
    }, g).textContent = r.stream.toFixed(1);

    // Wide invisible hit area covering the whole row (mask + bars + delta tag)
    el('rect', {
      x: LEFT_MARGIN - 4, y: yTop + 2,
      width: W - LEFT_MARGIN - RIGHT_MARGIN + 100,
      height: ROW_H - 4,
      fill: 'transparent',
    }, g);

    // delta tag
    const dColor = r.delta > 0 ? C.posDelta : C.negDelta;
    const sign = r.delta > 0 ? '+' : '';
    el('text', {
      x: W - RIGHT_MARGIN + 8, y: yCenter + 4,
      'font-size': 14, 'font-weight': 700, fill: dColor,
      'pointer-events': 'none',
    }, g).textContent = `${sign}${r.delta.toFixed(1)}`;

    // ===== Hover handlers =====
    const winColor = r.delta > 0 ? C.posDelta : C.negDelta;
    const winLabel = r.delta > 0 ? 'Stream wins' : 'Serial wins';
    const winSign  = r.delta > 0 ? '+' : '';
    const maskHtml = r.mask.split('').map(b =>
      b === '1'
        ? '<span style="display:inline-block;width:10px;height:10px;background:#fff;border:1px solid #9ca3af;margin:0 1px;border-radius:1px;vertical-align:middle;"></span>'
        : '<span style="display:inline-block;width:10px;height:10px;background:#374151;margin:0 1px;border-radius:1px;vertical-align:middle;"></span>'
    ).join('');

    const html = `<div class="tt-title" style="color:${winColor}">${winLabel} · Case ${r.caseId}</div>`
      + `<div class="tt-row"><span class="k">Mask</span><span class="v">${maskHtml}</span></div>`
      + `<div class="tt-row"><span class="k" style="color:#bdd3e8">Serial</span><span class="v">${r.serial.toFixed(1)}%</span></div>`
      + `<div class="tt-row"><span class="k" style="color:#f2d2a8">Stream</span><span class="v">${r.stream.toFixed(1)}%</span></div>`
      + `<div class="tt-row"><span class="k">Δ Stream − Serial</span>`
      + `<span class="v" style="color:${winColor}">${winSign}${r.delta.toFixed(1)} pp</span></div>`
      + `<div class="tt-foot">${r.note}</div>`;

    g.addEventListener('mouseenter', e => {
      showTip(html, e);
      // Emphasise this row only; do NOT dim the others so the user can keep
      // comparing it against the rest of the chart.
      serialRect.setAttribute('stroke', winColor);
      serialRect.setAttribute('stroke-width', '1.4');
      streamRect.setAttribute('stroke', winColor);
      streamRect.setAttribute('stroke-width', '1.4');
    });
    g.addEventListener('mousemove', moveTip);
    g.addEventListener('mouseleave', () => {
      hideTip();
      serialRect.setAttribute('stroke', 'none');
      serialRect.removeAttribute('stroke-width');
      streamRect.setAttribute('stroke', 'none');
      streamRect.removeAttribute('stroke-width');
    });

    rowGroups.push(g);
  }

  const rowsTopTail = PAD_TOP + LEGEND_H + HEADER_H + GROUP_LABEL_H;
  for (let i = 0; i < 3; i++) drawRow(i, rowsTopTail + i * ROW_H);

  // === Mid gap with dashed line + head label ===
  const midGapTop = rowsTopTail + 3 * ROW_H;
  const midLineY = midGapTop + MID_GAP_H / 2 - 2;
  el('line', {
    x1: LEFT_MARGIN - 30, x2: W - RIGHT_MARGIN + 30,
    y1: midLineY, y2: midLineY,
    stroke: '#94a3b8', 'stroke-width': 1, 'stroke-dasharray': '5 4',
  }, svg);

  const headLabelY = midLineY + 18;
  const headGroup = el('g', {
    class: 'perturb-group-label', 'data-group': 'head',
  }, svg);
  el('circle', {
    cx: LEFT_MARGIN - 12, cy: headLabelY - 4, r: 4,
    fill: C.negDelta,
  }, headGroup);
  el('text', {
    x: LEFT_MARGIN, y: headLabelY,
    'font-size': 12, 'font-style': 'italic',
    'font-weight': 700, fill: C.negDelta,
  }, headGroup).textContent = 'Theorem 1 · Case II/III — head perturbed';
  el('rect', {
    x: LEFT_MARGIN - 18, y: headLabelY - 16, width: 360, height: 22,
    fill: 'transparent',
  }, headGroup);

  // === 3 head rows ===
  const rowsTopHead = midGapTop + MID_GAP_H;
  for (let i = 0; i < 3; i++) drawRow(3 + i, rowsTopHead + i * ROW_H);

  // ===== Group label click handlers =====
  let activeGroup = null; // null | 'tail' | 'head'
  function applyGroupHighlight() {
    rowGroups.forEach(g => {
      const grp = g.getAttribute('data-group');
      g.classList.toggle('chart-dim',
        activeGroup !== null && activeGroup !== grp);
    });
    tailGroup.classList.toggle('active', activeGroup === 'tail');
    headGroup.classList.toggle('active', activeGroup === 'head');
  }
  function bindGroupClick(g, key) {
    g.addEventListener('click', () => {
      activeGroup = (activeGroup === key) ? null : key;
      applyGroupHighlight();
    });
  }
  bindGroupClick(tailGroup, 'tail');
  bindGroupClick(headGroup, 'head');
})();
