/* hero_timeline.js — interactive topology comparison
 * Data extracted by tools/extract_topo_animation_data.py from
 * final_results/main_results_v2/perf_comparison/gpt/{chain,tree,graph}/hmmt2026.
 * For each topology we picked the run with the highest streaming_speedup.
 *
 * Visual model:
 *   Upper track  : Serial — 4 agents run sequentially; each agent bar length
 *                  equals its api_time. Total = sum(api_time).
 *   Lower track  : Stream — same agents, true wall-clock timeline (multi-segment
 *                  busy intervals as parsed from the run's ASCII timeline).
 *   Speedup      = serial_total / stream_total.
 * Both tracks share one horizontal pixel scale so the eye reads the gap directly.
 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('hero-timeline-svg');
  if (!svg) return;

  // ===== Data =====
  const TOPOS = {
    chain: {
      label: 'Chain  (A \u2192 B \u2192 C \u2192 D)',
      speedup: 1.84,
      api_time: 261.99,
      wall_time: 142.57,
      agents: ['Agent_A', 'Agent_B', 'Agent_C', 'Agent_D'],
      serial: [
        { agent: 'Agent_A', start:   0.00, end:  31.48 },
        { agent: 'Agent_B', start:  31.48, end: 100.87 },
        { agent: 'Agent_C', start: 100.87, end: 186.28 },
        { agent: 'Agent_D', start: 186.28, end: 261.99 },
      ],
      stream: {
        Agent_A: [[  2.85,  37.07]],
        Agent_B: [[ 17.11,  88.39]],
        Agent_C: [[ 31.37, 119.76]],
        Agent_D: [[ 62.73, 142.57]],
      },
    },
    tree: {
      label: 'Tree  (A \u2192 {B, C} \u2192 D)',
      speedup: 1.82,
      api_time: 640.98,
      wall_time: 317.41,
      agents: ['Agent_A', 'Agent_B', 'Agent_C', 'Agent_D'],
      // Tree Serial: B and C both start after A finishes (parallel branches).
      // D waits until both B and C complete. Serial latency = A + max(B,C) + D.
      serial: [
        { agent: 'Agent_A', start:   0.00, end:  32.40 },
        { agent: 'Agent_B', start:  32.40, end: 276.99 },
        { agent: 'Agent_C', start:  32.40, end:  94.80 },
        { agent: 'Agent_D', start: 276.99, end: 578.57 },
      ],
      stream: {
        Agent_A: [[  0.00,  38.09]],
        Agent_B: [[  6.35, 253.93]],
        Agent_C: [[  6.35,  69.83]],
        Agent_D: [[ 12.70, 317.41]],
      },
    },
    graph: {
      label: 'Graph  (A \u2192 B \u2192 C \u2192 D, A \u2192 C)',
      speedup: 1.92,
      api_time: 452.23,
      wall_time: 235.45,
      agents: ['Agent_A', 'Agent_B', 'Agent_C', 'Agent_D'],
      serial: [
        { agent: 'Agent_A', start:   0.00, end:  59.30 },
        { agent: 'Agent_B', start:  59.30, end: 116.99 },
        { agent: 'Agent_C', start: 116.99, end: 298.27 },
        { agent: 'Agent_D', start: 298.27, end: 452.23 },
      ],
      stream: {
        Agent_A: [[  0.00,  65.93]],
        Agent_B: [[ 23.54,  94.18]],
        Agent_C: [[ 23.54,  37.67], [ 42.38, 221.32]],
        Agent_D: [[ 32.96, 174.23], [216.61, 235.45]],
      },
    },
  };

  const W = 980, H = 500;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // Layout
  // Top region [0, 130) hosts the DAG topology diagram.
  // Below that is the Serial / Stream timeline as before.
  const DAG_H = 130;
  const margin = { top: DAG_H + 18, left: 132, right: 90, bottom: 36 };
  const innerW = W - margin.left - margin.right;
  const trackH = 18;
  const trackGap = 16;

  // Topology DAG layout: each node is positioned in [W/2 - 160, W/2 + 160] x [DAG_H/2 - 32, DAG_H/2 + 32]
  const cx0 = W / 2;
  const cy0 = DAG_H / 2 + 14;          // shifted down so Tree's B node doesn't cover the title
  const DAG_DEFS = {
    chain: {
      title: 'Chain',
      nodes: { Agent_A: [cx0 - 165, cy0],
               Agent_B: [cx0 -  55, cy0],
               Agent_C: [cx0 +  55, cy0],
               Agent_D: [cx0 + 165, cy0] },
      edges: [['Agent_A','Agent_B'], ['Agent_B','Agent_C'], ['Agent_C','Agent_D']],
    },
    tree: {
      title: 'Tree',
      nodes: { Agent_A: [cx0 - 200, cy0],
               Agent_B: [cx0,        cy0 - 28],
               Agent_C: [cx0,        cy0 + 28],
               Agent_D: [cx0 + 200, cy0] },
      edges: [['Agent_A','Agent_B'], ['Agent_A','Agent_C'],
              ['Agent_B','Agent_D'], ['Agent_C','Agent_D']],
    },
    graph: {
      title: 'Graph',
      // Triangle layout: B raised above, A/C/D on bottom row; shortcut A→C is a straight dashed line.
      nodes: { Agent_A: [cx0 - 160, cy0 + 10],
               Agent_B: [cx0 -  20, cy0 - 28],
               Agent_C: [cx0 +  80, cy0 + 10],
               Agent_D: [cx0 + 200, cy0 + 10] },
      edges: [['Agent_A','Agent_B'], ['Agent_B','Agent_C'],
              ['Agent_C','Agent_D'],
              ['Agent_A','Agent_C']],
    },
  };

  // Color palette: light = future / mid = finished trail / dark = active.
  // The mid-tone keeps the bar visible after the head moves on, so the user
  // can read the cumulative progress at the end of the animation, while the
  // dark slice marks the agent's current focus.
  const C = {
    serial: '#4f6f9a',
    serialMid: '#85a5c2',
    serialLight: '#bdd3e8',
    stream: '#2f9e6e',
    streamMid: '#6cb792',
    streamLight: '#cfe7d8',
    rule: '#cbd5e1',
    label: '#1f2937',
    sub: '#6b7280',
    red: '#c0392b',
    green: '#176c4d',
  };

  // Per-agent palette for the stream protocol view. Each agent gets a distinct
  // hue so that the four roles are visually separable, and forward arrows are
  // tinted to follow the *upstream* agent (the sender), making the data flow
  // direction immediately readable.
  const AGENT_PAL = {
    Agent_A: { mid: '#669bbc', dark: '#003049', text: '#001620', light: '#dce8f0' },  // navy blue
    Agent_B: { mid: '#e86a6a', dark: '#c1121f', text: '#3d0508', light: '#fce4e4' },  // crimson
    Agent_C: { mid: '#d4a843', dark: '#8b6914', text: '#3d2e06', light: '#f7ebd0' },  // gold
    Agent_D: { mid: '#5bab82', dark: '#1a6b42', text: '#0a2e1c', light: '#d4f0e0' },  // emerald
  };

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ===== State =====
  let currentTopo = 'chain';
  let mode = 'normal';                    // 'normal' | 'slow'
  const TOTAL_NORMAL = 7000;              // ms for one full loop
  const TOTAL_SLOW   = 12000;
  let raf = null, t0 = null;
  let paused = false;
  let lastT = 0;                          // last rendered progress in [0, 1]
  let loopTimer = null;                   // setTimeout handle for the inter-loop pause
  let suppressSliderSync = false;         // true while the user drags the slider

  // ===== Render skeleton (rebuilt on topo switch) =====
  function render() {
    svg.innerHTML = '';
    const data = TOPOS[currentTopo];
    // xMax: the total width represents serial latency (max end in serial data)
    const xMax = Math.max(...data.serial.map(s => s.end));
    const xScale = innerW / xMax;
    const A = data.agents.length;

    // ===== Draw DAG topology diagram at top =====
    (function drawTopology() {
      const dagDef = DAG_DEFS[currentTopo];
      if (!dagDef) return;
      const dagG = el('g', {}, svg);
      const nodeR = 18;

      // Light background panel for DAG region (ensures visibility on green page bg)
      el('rect', {
        x: margin.left - 20, y: 4,
        width: innerW + 40, height: DAG_H - 8,
        rx: 12, ry: 12,
        fill: '#ffffff', opacity: 0.65,
      }, dagG);

      // Arrow-head marker
      const defs = el('defs', {}, dagG);
      const marker = el('marker', {
        id: 'dag-arrow',
        viewBox: '0 0 10 10', refX: 9, refY: 5,
        markerWidth: 5, markerHeight: 5, orient: 'auto',
      }, defs);
      el('path', { d: 'M0 0 L10 5 L0 10 Z', fill: '#374151' }, marker);

      // Smaller arrow-head for step-forward arrows on the timeline.
      // One marker per agent so each forward line can carry the upstream
      // agent's colour via marker-end=url(#fwd-arrow-<agent>).
      Object.entries(AGENT_PAL).forEach(([agent, pal]) => {
        const m = el('marker', {
          id: `fwd-arrow-${agent.replace('Agent_', '')}`,
          viewBox: '0 0 10 10', refX: 9, refY: 5,
          markerWidth: 4.5, markerHeight: 4.5, orient: 'auto',
        }, defs);
        el('path', { d: 'M0 0 L10 5 L0 10 Z', fill: pal.dark }, m);
      });

      // DAG title
      el('text', {
        x: cx0, y: 22,
        'font-size': 14, 'font-weight': 700,
        'text-anchor': 'middle', fill: C.label,
      }, dagG).textContent = dagDef.title + ' topology';

      // Edges first (so nodes draw on top)
      dagDef.edges.forEach(e => {
        const [srcKey, dstKey, style] = e;
        const [sx, sy] = dagDef.nodes[srcKey];
        const [dx, dy] = dagDef.nodes[dstKey];
        const angle = Math.atan2(dy - sy, dx - sx);
        const x1 = sx + nodeR * Math.cos(angle);
        const y1 = sy + nodeR * Math.sin(angle);
        const x2 = dx - (nodeR + 4) * Math.cos(angle);
        const y2 = dy - (nodeR + 4) * Math.sin(angle);

        if (style === 'curve') {
          const mx = (sx + dx) / 2;
          const my = (sy + dy) / 2 + 48;
          el('path', {
            d: `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`,
            fill: 'none', stroke: '#e67e22', 'stroke-width': 2.2,
            'stroke-dasharray': '5 3',
            'marker-end': 'url(#dag-arrow)',
          }, dagG);
          el('text', {
            x: mx, y: my - 4,
            'font-size': 10, 'text-anchor': 'middle',
            fill: '#e67e22', 'font-style': 'italic',
          }, dagG).textContent = 'shortcut';
        } else if (style === 'shortcut') {
          // Straight dashed line for shortcut edges (e.g. Graph A→C in triangle layout)
          el('line', {
            x1, y1, x2, y2,
            stroke: '#e67e22', 'stroke-width': 2.2,
            'stroke-dasharray': '5 3',
            'marker-end': 'url(#dag-arrow)',
          }, dagG);
          // label below the line
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + 16;
          el('text', {
            x: mx, y: my,
            'font-size': 10, 'text-anchor': 'middle',
            fill: '#e67e22', 'font-style': 'italic',
          }, dagG).textContent = 'shortcut';
        } else {
          el('line', {
            x1, y1, x2, y2,
            stroke: '#374151', 'stroke-width': 2,
            'marker-end': 'url(#dag-arrow)',
          }, dagG);
        }
      });

      // Nodes
      Object.entries(dagDef.nodes).forEach(([key, [nx, ny]]) => {
        el('circle', {
          cx: nx, cy: ny, r: nodeR,
          fill: '#f0fdf4', stroke: C.stream, 'stroke-width': 2.4,
        }, dagG);
        const letter = key.replace('Agent_', '');
        el('text', {
          x: nx, y: ny + 5,
          'font-size': 15, 'font-weight': 700,
          'text-anchor': 'middle', fill: C.label,
        }, dagG).textContent = letter;
      });

      // Horizontal separator below DAG
      el('line', {
        x1: margin.left, x2: W - margin.right,
        y1: DAG_H + 4, y2: DAG_H + 4,
        stroke: C.rule, 'stroke-width': 1, 'stroke-dasharray': '4 3',
      }, dagG);
    })();

    // Vertical layout: 4 serial tracks (top half), divider, 4 stream tracks (bottom half)
    const halfTopY    = margin.top + 6;
    const halfBottomY = margin.top + 6 + A * (trackH + trackGap) + 50;

    function trackY(idx, half) {
      const base = half === 0 ? halfTopY : halfBottomY;
      return base + idx * (trackH + trackGap);
    }

    // Half labels
    el('text', {
      x: 14, y: margin.top - 4,
      'font-size': 13, 'font-weight': 700, fill: C.serial,
      'font-family': 'Inter, sans-serif',
    }, svg).textContent = 'Serial';

    el('text', {
      x: 14, y: halfBottomY - 12,
      'font-size': 13, 'font-weight': 700, fill: C.stream,
      'font-family': 'Inter, sans-serif',
    }, svg).textContent = 'Stream';

    // Background tracks
    function drawTrackBg(yIdx, half) {
      const y = trackY(yIdx, half);
      el('rect', {
        x: margin.left, y,
        width: innerW, height: trackH,
        rx: 5, ry: 5,
        fill: '#f1f5f9', stroke: C.rule, 'stroke-width': 1,
      }, svg);
      el('text', {
        x: margin.left - 12, y: y + trackH / 2 + 4,
        'font-size': 11, 'text-anchor': 'end',
        fill: C.label, 'font-weight': 600,
      }, svg).textContent = data.agents[yIdx];
    }
    for (let half = 0; half < 2; half++)
      for (let i = 0; i < A; i++) drawTrackBg(i, half);

    // ===== Serial bars (one per agent, sequential) =====
    // Each agent's serial bar is tinted with its own AGENT_PAL palette so the
    // four roles are visually identifiable in the same way as in the Stream
    // section. light = backdrop, dark = active, mid = finished trail.
    const serialBars = [];
    const serialIdx = {};
    data.serial.forEach(seg => {
      const idx = data.agents.indexOf(seg.agent);
      const pal = AGENT_PAL[seg.agent] || { mid: C.serialMid, dark: C.serial, light: C.serialLight };
      const y = trackY(idx, 0);
      const x0 = margin.left + seg.start * xScale;
      const totalW = (seg.end - seg.start) * xScale;
      // Waiting/idle period: dashed outline from timeline start to this agent's start
      if (seg.start > 0) {
        el('rect', {
          x: margin.left, y,
          width: seg.start * xScale, height: trackH,
          rx: 4, ry: 4,
          fill: 'none', stroke: '#cbd5e1', 'stroke-width': 1,
          'stroke-dasharray': '4 3', opacity: 0.7,
        }, svg);
      }
      // light backdrop showing full extent
      el('rect', {
        x: x0, y, width: totalW, height: trackH,
        rx: 4, ry: 4, fill: pal.light, opacity: 0.95,
      }, svg);
      // overlay "currently running" solid bar — animated by setting width
      const solid = el('rect', {
        x: x0, y, width: 0, height: trackH,
        rx: 4, ry: 4, fill: pal.dark,
      }, svg);
      const entry = { solid, x0, totalW, segStart: seg.start, segEnd: seg.end, pal };
      serialBars.push(entry);
      serialIdx[seg.agent] = entry;
    });

    // Forward edges between consecutive agents in the Serial protocol:
    // src finishes its whole bar → dst starts. Same colour-follow-upstream
    // and centre-anchored geometry as the Stream stepLines.
    const serialLines = [];
    const serialEdges = (DAG_DEFS[currentTopo] || {}).edges || [];
    serialEdges.forEach(edgeDef => {
      const [srcKey, dstKey] = edgeDef;
      const srcIdx = data.agents.indexOf(srcKey);
      const dstIdx = data.agents.indexOf(dstKey);
      if (srcIdx < 0 || dstIdx < 0) return;
      const srcEntry = serialIdx[srcKey];
      const dstEntry = serialIdx[dstKey];
      if (!srcEntry || !dstEntry) return;
      const srcPal = AGENT_PAL[srcKey] || { dark: C.serial };
      const srcLetter = srcKey.replace('Agent_', '');
      const ySrcTop = trackY(srcIdx, 0);
      const yDstTop = trackY(dstIdx, 0);
      const dir = ySrcTop < yDstTop ? 1 : -1;
      const ySrcEdge = dir > 0 ? ySrcTop + trackH : ySrcTop;
      const yDstEdge = dir > 0 ? yDstTop - 1 : yDstTop + trackH + 1;
      // Anchor at the horizontal midpoint of each bar for visibility.
      const x1 = margin.left + (srcEntry.segStart + srcEntry.segEnd) / 2 * xScale;
      const x2 = margin.left + (dstEntry.segStart + dstEntry.segEnd) / 2 * xScale;
      // Base line: subtle permanent connector
      const baseLine = el('line', {
        x1, y1: ySrcEdge, x2, y2: yDstEdge,
        stroke: srcPal.dark, 'stroke-width': 1.8,
        'marker-end': `url(#fwd-arrow-${srcLetter})`,
        opacity: 0, 'pointer-events': 'none',
        class: 'flow-base',
      }, svg);
      // Glow line: light-pulse flowing along the path
      const glowLine = el('line', {
        x1, y1: ySrcEdge, x2, y2: yDstEdge,
        stroke: srcPal.dark, 'stroke-width': 4,
        opacity: 0, 'pointer-events': 'none',
        class: 'flow-glow',
      }, svg);
      serialLines.push({ line: baseLine, glow: glowLine, triggerSec: srcEntry.segEnd, expireSec: dstEntry.segEnd });
    });
    // Serial finish marker is anchored to the visual end of the longest serial bar
    // (xMax). For Tree topology, B and C run as parallel branches, so the visual
    // serial latency = A + max(B,C) + D ≠ sum(api_time). Using xMax keeps the
    // tick aligned with the bar end and consistent with the speedup callout.
    const serialFinishX = margin.left + xMax * xScale;

    // ===== Stream protocol: per-agent step blocks + diagonal forward edges =====
    // Each agent is decomposed into N = 3 step blocks (matching the prompt
    // template "divide your response into 3 roughly equal parts"). Per-step
    // wall-clock timestamps were not persisted in the logs, so we synthesize a
    // schedule that respects the StreamMA causal constraint:
    //
    //   v.step[k].start = max( v.step[k-1].end ,
    //                          max_{u : u→v} u.step[k].end )
    //
    // i.e. a downstream agent cannot start its k-th step before (a) finishing
    // its previous step and (b) every direct upstream having forwarded its
    // k-th step. The per-agent step duration is busy_total / N. After scheduling
    // we rescale so the latest finish equals data.wall_time, keeping the
    // overall stream length faithful to the measured run.
    //
    // For every DAG edge u→v we draw a thin diagonal line from u.step[k].end
    // to v.step[k].start, visualising the forward and any backlog wait.
    const BASE_STEP_N = 3;
    const streamSteps = [];
    const stepLines = [];
    const stepIdx = {};

    // 1. Build the dependency map (deps[v] = list of immediate upstream agents).
    const deps = {};
    data.agents.forEach(a => { deps[a] = []; });
    ((DAG_DEFS[currentTopo] || {}).edges || []).forEach(([s, d]) => {
      if (deps[d]) deps[d].push(s);
    });

    // 2. Compute per-agent step count.
    // In StreamMA, each incoming message triggers one step() call.
    // An agent's total steps = sum of all predecessors' step counts.
    // Root agents have BASE_STEP_N = 3.
    const stepNof = {};
    data.agents.forEach(name => {
      if (deps[name].length === 0) {
        stepNof[name] = BASE_STEP_N;
      } else {
        stepNof[name] = deps[name].reduce((sum, u) => sum + (stepNof[u] || BASE_STEP_N), 0);
      }
    });

    // 3. Per-agent step duration estimate.
    const stepDurOf = {};
    data.agents.forEach(name => {
      const segs = data.stream[name] || [];
      const busy = segs.reduce((a, [s, e]) => a + (e - s), 0);
      stepDurOf[name] = busy > 0 ? busy / stepNof[name] : 1;
    });

    // 4. Schedule each agent's step blocks under the causal constraint.
    // StreamMA protocol: queue-based FIFO — downstream processes messages in
    // arrival order. For multi-predecessor nodes we collect all upstream step
    // end times, sort them, and use the k-th arrival as the constraint for
    // the k-th downstream step.
    const sched = {};
    data.agents.forEach(name => {
      sched[name] = [];
      const segs = data.stream[name] || [];
      const ownEntry = segs.length ? segs[0][0] : 0;
      const stepDur = stepDurOf[name];
      const N = stepNof[name];
      if (deps[name].length > 1) {
        // Multi-predecessor: FIFO arrival ordering
        const arrivals = [];
        deps[name].forEach(u => {
          const uN = stepNof[u];
          for (let k = 0; k < uN; k++) {
            if (sched[u] && sched[u][k]) arrivals.push(sched[u][k][1]);
          }
        });
        arrivals.sort((a, b) => a - b);
        for (let k = 0; k < N; k++) {
          let start = (k === 0) ? ownEntry : sched[name][k - 1][1];
          if (k < arrivals.length) start = Math.max(start, arrivals[k]);
          sched[name].push([start, start + stepDur]);
        }
      } else {
        // Single or no predecessor: original formula
        for (let k = 0; k < N; k++) {
          let start = (k === 0) ? ownEntry : sched[name][k - 1][1];
          const depEnds = [];
          deps[name].forEach(u => {
            if (sched[u] && sched[u].length > 0) {
              const uN = stepNof[u];
              const uK = Math.min(k, uN - 1);
              if (sched[u][uK]) depEnds.push(sched[u][uK][1]);
            }
          });
          if (depEnds.length > 0) {
            start = Math.max(start, Math.min(...depEnds));
          }
          sched[name].push([start, start + stepDur]);
        }
      }
    });

    // 5. Rescale to fit data.wall_time (compress only, never stretch).
    let scheduledMax = 0;
    data.agents.forEach(name => {
      const last = sched[name][stepNof[name] - 1];
      if (last && last[1] > scheduledMax) scheduledMax = last[1];
    });
    const tScale = (scheduledMax > 0 && data.wall_time > 0)
      ? Math.min(1, data.wall_time / scheduledMax) : 1;
    if (tScale !== 1) {
      data.agents.forEach(name => {
        sched[name] = sched[name].map(([s, e]) => [s * tScale, e * tScale]);
      });
    }

    // 6. Render step blocks per agent.
    const stepGap = 2.5;
    data.agents.forEach((name, idx) => {
      const segs = data.stream[name] || [];
      if (!segs.length) return;
      const pal = AGENT_PAL[name] || { mid: C.streamMid, dark: C.stream, text: '#0e3a26', light: C.streamLight };
      const y = trackY(idx, 1);
      const N = stepNof[name];
      const sFirst = sched[name][0][0];
      const sLast = sched[name][N - 1][1];

      // Light backdrop spanning the agent's scheduled span (agent-tinted)
      el('rect', {
        x: margin.left + sFirst * xScale, y,
        width: (sLast - sFirst) * xScale, height: trackH,
        rx: 4, ry: 4, fill: pal.light, opacity: 0.85,
      }, svg);

      stepIdx[name] = [];
      for (let k = 0; k < N; k++) {
        const [ss, se] = sched[name][k];
        const leftInset = k > 0 ? stepGap / 2 : 0;
        const rightInset = k < N - 1 ? stepGap / 2 : 0;
        const x = margin.left + ss * xScale + leftInset;
        const fullW = Math.max(0, (se - ss) * xScale - leftInset - rightInset);
        const rect = el('rect', {
          x, y: y + 1, width: 0, height: trackH - 2,
          rx: 3, ry: 3, fill: pal.mid,
          stroke: pal.dark, 'stroke-width': 1.2,
        }, svg);
        const label = el('text', {
          x: x + fullW / 2, y: y + trackH / 2 + 3.5,
          'font-size': 9.5, 'text-anchor': 'middle',
          fill: pal.text, 'font-weight': 700,
          opacity: 0, 'pointer-events': 'none',
        }, svg);
        const letter = name.replace('Agent_', '');
        label.textContent = `${letter}${k + 1}`;
        const entry = { rect, label, fullW, stepStart: ss, stepEnd: se, pal };
        streamSteps.push(entry);
        stepIdx[name].push(entry);
      }
    });

    // Diagonal forward edges: src.step[k] → dst's corresponding step.
    // StreamMA queue semantics: FIFO — messages are processed in arrival order.
    // We build a mapping based on when each upstream step finishes (arrival
    // time at the downstream queue), then draw arrows accordingly.
    const fifoArrivalMap = {};
    data.agents.forEach(dstKey => {
      if (deps[dstKey].length <= 1) return;
      const arrivals = [];
      deps[dstKey].forEach(srcKey => {
        const srcN = stepNof[srcKey];
        for (let k = 0; k < srcN; k++) {
          if (sched[srcKey] && sched[srcKey][k]) {
            arrivals.push({ time: sched[srcKey][k][1], src: srcKey, k });
          }
        }
      });
      arrivals.sort((a, b) => a.time - b.time);
      fifoArrivalMap[dstKey] = {};
      deps[dstKey].forEach(s => { fifoArrivalMap[dstKey][s] = []; });
      arrivals.forEach((arr, idx) => {
        fifoArrivalMap[dstKey][arr.src].push(idx);
      });
    });

    const fwdEdges = (DAG_DEFS[currentTopo] || {}).edges || [];
    fwdEdges.forEach(edgeDef => {
      const [srcKey, dstKey] = edgeDef;
      const srcIdx = data.agents.indexOf(srcKey);
      const dstIdx = data.agents.indexOf(dstKey);
      if (srcIdx < 0 || dstIdx < 0) return;
      if (!stepIdx[srcKey] || !stepIdx[dstKey]) return;
      const srcPal = AGENT_PAL[srcKey] || { dark: '#176c4d' };
      const srcLetter = srcKey.replace('Agent_', '');
      const ySrcTop = trackY(srcIdx, 1);
      const yDstTop = trackY(dstIdx, 1);
      const dir = ySrcTop < yDstTop ? 1 : -1;
      const ySrcEdge = dir > 0 ? ySrcTop + trackH : ySrcTop;
      const yDstEdge = dir > 0 ? yDstTop - 1 : yDstTop + trackH + 1;
      const srcN = stepNof[srcKey];
      for (let k = 0; k < srcN; k++) {
        const src = stepIdx[srcKey][k];
        // Use FIFO mapping for multi-predecessor; direct 1:1 for single
        let dstK;
        if (fifoArrivalMap[dstKey] && fifoArrivalMap[dstKey][srcKey]) {
          dstK = fifoArrivalMap[dstKey][srcKey][k];
        } else {
          dstK = k;
        }
        const dst = stepIdx[dstKey][dstK];
        if (!src || !dst) continue;
        const x1 = margin.left + (src.stepStart + src.stepEnd) / 2 * xScale;
        const x2 = margin.left + dst.stepStart * xScale;
        const baseLine = el('line', {
          x1, y1: ySrcEdge, x2, y2: yDstEdge,
          stroke: srcPal.dark, 'stroke-width': 1.8,
          'marker-end': `url(#fwd-arrow-${srcLetter})`,
          opacity: 0, 'pointer-events': 'none',
          class: 'flow-base',
        }, svg);
        const glowLine = el('line', {
          x1, y1: ySrcEdge, x2, y2: yDstEdge,
          stroke: srcPal.dark, 'stroke-width': 4,
          opacity: 0, 'pointer-events': 'none',
          class: 'flow-glow',
        }, svg);
        stepLines.push({ line: baseLine, glow: glowLine, triggerSec: src.stepEnd, expireSec: dst.stepEnd });
      }
    });

    const streamFinishX = margin.left + data.wall_time * xScale;

    // ===== Time-axis ticks =====
    const axisYserial = trackY(A - 1, 0) + trackH + 14;
    const axisYstream = trackY(A - 1, 1) + trackH + 14;
    function axisTick(x, y, label, color) {
      el('line', { x1: x, x2: x, y1: y - 4, y2: y, stroke: color, 'stroke-width': 1.2 }, svg);
      el('text', { x, y: y + 12, 'font-size': 10, 'text-anchor': 'middle', fill: color },
         svg).textContent = label;
    }
    axisTick(serialFinishX, axisYserial, `${xMax.toFixed(0)} s`, C.serial);
    axisTick(streamFinishX, axisYstream, `${data.wall_time.toFixed(0)} s`, C.stream);

    // ===== Speedup callout (between Stream finish and Serial finish) =====
    const calloutG = el('g', {}, svg);
    const calloutX = streamFinishX + 8;
    const calloutY = trackY(0, 1) - 22;
    el('rect', {
      x: calloutX, y: calloutY,
      width: 138, height: 30, rx: 8, ry: 8,
      fill: C.stream, opacity: 0.95,
    }, calloutG);
    el('text', {
      x: calloutX + 69, y: calloutY + 20,
      'font-size': 13, 'font-weight': 700,
      'text-anchor': 'middle', fill: '#fff',
    }, calloutG).textContent = `${data.speedup.toFixed(2)}\u00d7 speedup`;

    return { serialBars, serialLines, streamSteps, stepLines, data, xMax };
  }

  let drawn = render();

  // ===== Animation =====
  function reset() {
    drawn.serialBars.forEach(b => {
      b.solid.setAttribute('width', 0);
      b.solid.setAttribute('fill', b.pal ? b.pal.dark : '#4f6f9a');
    });
    drawn.serialLines.forEach(l => { l.line.setAttribute('opacity', 0); if (l.glow) l.glow.setAttribute('opacity', 0); });
    drawn.streamSteps.forEach(s => {
      s.rect.setAttribute('width', 0);
      s.rect.setAttribute('fill', s.pal ? s.pal.mid : '#6cb792');
      s.rect.setAttribute('opacity', 1);
      if (s.label) s.label.setAttribute('opacity', 0);
    });
    drawn.stepLines.forEach(l => { l.line.setAttribute('opacity', 0); if (l.glow) l.glow.setAttribute('opacity', 0); });
  }

  // Apply a single animation snapshot at progress t ∈ [0, 1].
  function renderAt(t) {
    if (!drawn) return;
    const xScale = (W - margin.left - margin.right) / drawn.xMax;
    const tSec = t * drawn.xMax;

    drawn.serialBars.forEach(b => {
      const pal = b.pal;
      if (tSec >= b.segEnd) {
        b.solid.setAttribute('width', b.totalW);
        b.solid.setAttribute('fill', pal ? pal.mid : '#85a5c2');
      } else if (tSec > b.segStart) {
        const w = (tSec - b.segStart) * xScale;
        b.solid.setAttribute('width', Math.max(0, w));
        b.solid.setAttribute('fill', pal ? pal.dark : '#4f6f9a');
      } else {
        b.solid.setAttribute('width', 0);
      }
    });
    drawn.serialLines.forEach(l => {
      const visible = tSec >= l.triggerSec && tSec < l.expireSec;
      // Base line: always faintly visible once triggered for the first time,
      // brighter during active transfer.
      const baseOp = tSec >= l.triggerSec ? (visible ? 0.5 : 0.18) : 0;
      l.line.setAttribute('opacity', baseOp);
      // Glow: only during active transfer
      if (l.glow) l.glow.setAttribute('opacity', visible ? 0.75 : 0);
    });
    drawn.streamSteps.forEach(s => {
      const pal = s.pal;
      if (tSec >= s.stepEnd) {
        s.rect.setAttribute('width', s.fullW);
        s.rect.setAttribute('fill', pal ? pal.mid : '#6cb792');
        if (s.label) s.label.setAttribute('opacity', 1);
      } else if (tSec > s.stepStart) {
        const w = (tSec - s.stepStart) * xScale;
        s.rect.setAttribute('width', Math.max(0, Math.min(s.fullW, w)));
        s.rect.setAttribute('fill', pal ? pal.dark : '#2f9e6e');
        if (s.label) s.label.setAttribute('opacity', Math.min(1, w / 12));
      } else {
        s.rect.setAttribute('width', 0);
        if (s.label) s.label.setAttribute('opacity', 0);
      }
    });
    drawn.stepLines.forEach(l => {
      const visible = tSec >= l.triggerSec && tSec < l.expireSec;
      // Base line: stays faint after first trigger (shows topology);
      // brighter during active transfer.
      const baseOp = tSec >= l.triggerSec ? (visible ? 0.5 : 0.18) : 0;
      l.line.setAttribute('opacity', baseOp);
      // Glow: only during active transfer
      if (l.glow) l.glow.setAttribute('opacity', visible ? 0.75 : 0);
    });
  }

  // Sync the external progress widgets (slider + percentage label) to t.
  function syncWidgets(t) {
    const slider = document.getElementById('hero-anim-slider');
    const tlabel = document.getElementById('hero-anim-time');
    if (slider && !suppressSliderSync) slider.value = Math.round(t * 1000);
    if (tlabel) tlabel.textContent = Math.round(t * 100) + '%';
  }

  function step(now) {
    if (paused) return;
    if (t0 === null) t0 = now;
    const TOTAL = mode === 'slow' ? TOTAL_SLOW : TOTAL_NORMAL;
    let t = (now - t0) / TOTAL;
    if (t >= 1) {
      t = 1;
      lastT = 1;
      renderAt(1);
      syncWidgets(1);
      // Hold a beat, then reset and loop — unless the user paused meanwhile.
      loopTimer = setTimeout(() => {
        loopTimer = null;
        if (paused) return;
        reset();
        t0 = null;
        lastT = 0;
        raf = requestAnimationFrame(step);
      }, 900);
      return;
    }
    lastT = t;
    renderAt(t);
    syncWidgets(t);
    raf = requestAnimationFrame(step);
  }

  function start() {
    cancelAnimationFrame(raf);
    if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    reset();
    t0 = null;
    lastT = 0;
    paused = false;
    updatePauseBtn();
    syncWidgets(0);
    raf = requestAnimationFrame(step);
  }

  function rerender() {
    cancelAnimationFrame(raf);
    if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    drawn = render();
    t0 = null;
    lastT = 0;
    paused = false;
    updatePauseBtn();
    syncWidgets(0);
    raf = requestAnimationFrame(step);
  }

  // ===== Pause / resume / scrub =====
  const pauseBtn = document.getElementById('hero-anim-pause');
  const slider = document.getElementById('hero-anim-slider');

  function updatePauseBtn() {
    if (pauseBtn) pauseBtn.textContent = paused ? '▶' : '⏸';
  }

  function pauseAnim() {
    if (paused) return;
    paused = true;
    cancelAnimationFrame(raf);
    if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    updatePauseBtn();
  }

  function resumeAnim() {
    if (!paused) return;
    paused = false;
    const TOTAL = mode === 'slow' ? TOTAL_SLOW : TOTAL_NORMAL;
    // Restart the animation loop entirely if we had reached the end.
    if (lastT >= 1) {
      reset();
      t0 = null;
      lastT = 0;
      syncWidgets(0);
    } else {
      t0 = performance.now() - lastT * TOTAL;
    }
    updatePauseBtn();
    raf = requestAnimationFrame(step);
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => { paused ? resumeAnim() : pauseAnim(); });
  }
  if (slider) {
    const onScrub = () => {
      suppressSliderSync = true;
      pauseAnim();
      lastT = Math.max(0, Math.min(1, slider.value / 1000));
      renderAt(lastT);
      const tlabel = document.getElementById('hero-anim-time');
      if (tlabel) tlabel.textContent = Math.round(lastT * 100) + '%';
    };
    slider.addEventListener('input', onScrub);
    slider.addEventListener('change', () => { suppressSliderSync = false; });
    slider.addEventListener('pointerup', () => { suppressSliderSync = false; });
  }

  // ===== UI handlers =====
  document.querySelectorAll('.hero-anim-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.mode;
      const tp = btn.dataset.topo;
      if (tp) {
        // topology switch
        document.querySelectorAll('.hero-anim-toggle button[data-topo]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTopo = tp;
        rerender();
        return;
      }
      if (m === 'replay') { start(); return; }
      if (m === 'normal' || m === 'slow') {
        document.querySelectorAll('.hero-anim-toggle button[data-mode="normal"], .hero-anim-toggle button[data-mode="slow"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = m;
        start();
      }
    });
  });

  start();

  // expose for debug
  window.__streamMaTimeline = TOPOS;
})();
