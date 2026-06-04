# StreamMA Project Website

A single-page static project page for **StreamMA: Streaming Communication in Multi-Agent Reasoning**, styled after the [Nerfies](https://nerfies.github.io/) / [DeepConf](https://jiaweizzhao.github.io/deepconf/) academic project page.

## Local preview

No build step. Just serve the directory:

```bash
cd project_website
python -m http.server 8000
# then open http://localhost:8000
```

Or simply double-click `index.html` (most browsers will load it directly; the http server is only needed if your browser blocks `file://` for fetch).

## Deploy on GitHub Pages

1. Push `project_website/` to a branch (or use `main`).
2. In repo Settings → Pages, set the source to that branch and folder `/project_website`.
3. The page will be available at `https://<user>.github.io/<repo>/`.

## Files

```
project_website/
├── index.html                # Single-page entry
├── static/
│   ├── css/style.css         # Custom styles on top of Bulma (CDN)
│   ├── js/
│   │   ├── hero_timeline.js  # Stream vs Serial timeline animation
│   │   ├── perturbation.js   # Step-level perturbation panel
│   │   ├── scaling_heatmap.js# Step-level scaling-law heatmap + speedup curves
│   │   └── pareto.js         # Cost-accuracy Pareto frontier
│   └── images/favicon.svg
└── README.md                 # This file
```

All charts are inline SVG drawn at runtime; no PNG / PDF assets required. Bulma and MathJax are loaded from a CDN.

## Credit

Page template adapted from [Nerfies](https://nerfies.github.io/) (CC BY-SA 4.0).
