"""
Record hero_timeline animation as a looping GIF (Chain -> Tree -> Graph).

Each topology occupies the full frame for one animation loop, then switches.
This gives maximum detail visibility compared to the triple-in-one-frame version.

Usage:
    python3 promo/record_gif.py

Output:
    promo/streamma_method.gif  (~960x760, ~25s loop showing all 3 topologies)
"""
import asyncio
import json
import shutil
import subprocess
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent
URL = "http://localhost:8765/index.html"
OUT_GIF = ROOT / "streamma_method.gif"
TMP_DIR = ROOT / "_tmp_gif"

LOOP_DURATION = 8.0  # seconds per topology
TOPOLOGIES = ['chain', 'tree', 'graph']

# Accuracy data (Claude Opus 4.6, 8-benchmark avg) to overlay on GIF
ACCURACY = {
    'chain': {'stream': 81.70, 'serial': 73.48, 'delta': '+8.2'},
    'tree':  {'stream': 82.81, 'serial': 79.43, 'delta': '+3.4'},
    'graph': {'stream': 83.34, 'serial': 72.92, 'delta': '+10.4'},
}

ACCURACY_OVERLAY_CSS = """
#__acc_overlay {
  position: fixed; bottom: 15px; left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 40, 28, 0.88);
  color: #fff;
  font-family: -apple-system, 'Helvetica Neue', sans-serif;
  font-size: 16px;
  font-weight: 600;
  padding: 10px 28px;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  z-index: 999999;
  text-align: center;
  line-height: 1.5;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  opacity: 0;
  transition: opacity 0.4s ease;
}
#__acc_overlay.show { opacity: 1; }
#__acc_overlay .highlight { color: #7fe3b8; font-weight: 800; }
#__acc_overlay .dim { color: #aaa; }
"""


async def main():
    if TMP_DIR.exists():
        shutil.rmtree(TMP_DIR)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            viewport={"width": 1100, "height": 830},
            record_video_dir=str(TMP_DIR),
            record_video_size={"width": 1100, "height": 830},
            device_scale_factor=2,
        )
        page = await context.new_page()

        # Pre-inject CSS that hides EVERYTHING until we're ready.
        # The video recording starts the moment the page is created, so without
        # this, the page loading + SimpleBench leaderboard sections get baked into
        # the first few seconds of the GIF.
        await page.add_init_script("""
            const style = document.createElement('style');
            style.id = '__pre_hide_style';
            style.textContent = 'html, body { visibility: hidden !important; background: #f8fdf9 !important; }';
            (document.head || document.documentElement).appendChild(style);
        """)

        # Block Google Fonts (hangs in this sandbox)
        async def block_fonts(route):
            url = route.request.url
            if "fonts.googleapis" in url or "fonts.gstatic" in url:
                await route.abort()
            else:
                await route.continue_()
        await page.route("**/*", block_fonts)

        print("[gif] loading page...", flush=True)
        await page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_load_state("load", timeout=15000)
        except Exception:
            pass
        await asyncio.sleep(2)

        # Isolate #hero-anim section
        print("[gif] isolating hero-anim...", flush=True)
        await page.evaluate("""
        (() => {
            document.querySelectorAll('body > *').forEach(el => el.style.display = 'none');
            const section = document.getElementById('hero-anim');
            if (!section) return;
            section.style.display = 'block';
            section.style.padding = '20px 30px';
            section.style.margin = '0';
            section.style.maxWidth = '100%';
            // Hide the topology subtitle line so the GIF is cleaner.
            const sub = section.querySelector('.section-sub');
            if (sub) sub.style.display = 'none';
            document.body.style.background = '#f8fdf9';
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            document.body.style.overflow = 'hidden';
            let p = section.parentElement;
            while (p && p !== document.body) { p.style.display = 'block'; p = p.parentElement; }
            // Remove the pre-hide style now that the section is isolated.
            const ph = document.getElementById('__pre_hide_style');
            if (ph) ph.remove();
        })()
        """)
        await asyncio.sleep(0.5)

        # Reset and start animation
        await page.evaluate("""
        (() => {
            const slider = document.getElementById('hero-anim-slider');
            const btn = document.getElementById('hero-anim-pause');
            if (!slider || !btn) return;
            if (btn.textContent.includes('\u23f8')) btn.click();
            slider.value = 0;
            slider.dispatchEvent(new Event('input', {bubbles: true}));
            slider.dispatchEvent(new Event('change', {bubbles: true}));
            slider.dispatchEvent(new Event('pointerup', {bubbles: true}));
        })()
        """)
        await asyncio.sleep(0.2)
        await page.evaluate("""
        (() => {
            const btn = document.getElementById('hero-anim-pause');
            if (btn && btn.textContent.includes('\u25b6')) btn.click();
        })()
        """)
        await asyncio.sleep(0.3)

        # Record each topology sequentially
        for i, topo in enumerate(TOPOLOGIES):
            # Build accuracy overlay HTML for this topology
            acc = ACCURACY[topo]
            acc_html = (
                f'<span class="dim" style="font-size:13px;">Claude Opus 4.6 (high) · avg over 8 benchmarks</span><br>'
                f'Stream <span class="highlight">{acc["stream"]:.1f}%</span> '
                f'<span class="dim">vs Serial {acc["serial"]:.1f}%</span> '
                f'<span class="highlight">({acc["delta"]} pp)</span>'
            )

            if i == 0:
                # First topology: inject overlay with fade-in animation
                await page.evaluate(f"""
                (() => {{
                    let el = document.getElementById('__acc_overlay');
                    if (!el) {{
                        const style = document.createElement('style');
                        style.textContent = {json.dumps(ACCURACY_OVERLAY_CSS)};
                        document.head.appendChild(style);
                        el = document.createElement('div');
                        el.id = '__acc_overlay';
                        document.body.appendChild(el);
                    }}
                    el.innerHTML = {json.dumps(acc_html)};
                    requestAnimationFrame(() => el.classList.add('show'));
                }})()
                """)
            else:
                # Subsequent topologies: switch topology AND swap overlay
                # content INSTANTLY in the same frame, so the overlay never
                # shows stale data and there is no fade-out flicker.
                print(f"[gif] switching to {topo}...", flush=True)
                await page.evaluate(f"""
                (() => {{
                    // 1. Update overlay content first (instant, no fade)
                    const el = document.getElementById('__acc_overlay');
                    if (el) {{
                        el.innerHTML = {json.dumps(acc_html)};
                        el.classList.add('show');
                    }}
                    // 2. Switch topology (triggers hero_timeline rerender)
                    const btn = document.querySelector('.hero-anim-toggle button[data-topo="{topo}"]');
                    if (btn) btn.click();
                }})()
                """)
                await asyncio.sleep(0.3)  # brief settle for rerender

            print(f"[gif] recording {topo} ({LOOP_DURATION}s)...", flush=True)
            await asyncio.sleep(LOOP_DURATION)

        await context.close()
        await browser.close()

    webms = list(TMP_DIR.glob("*.webm"))
    if not webms:
        print("[gif] ERROR: no video produced.", file=sys.stderr)
        sys.exit(1)
    raw = webms[0]
    print(f"[gif] raw video: {raw.stat().st_size // 1024} KB", flush=True)

    palette = TMP_DIR / "palette.png"
    print("[gif] generating palette...", flush=True)
    # Trim the first 3.5s (page-loading frames before isolation completes).
    TRIM_START = "3.5"
    # Speed up playback by this factor (2.0 = 100% faster).
    SPEED = 2.0
    # Quality knobs: 1440px wide, 24 fps, 256-color palette, sierra2_4a dither.
    subprocess.run([
        "ffmpeg", "-y", "-ss", TRIM_START, "-i", str(raw),
        "-vf", f"setpts=PTS/{SPEED},fps=24,scale=1100:-1:flags=lanczos,palettegen=max_colors=256:stats_mode=diff",
        str(palette),
    ], check=True, capture_output=True)

    print("[gif] encoding GIF...", flush=True)
    subprocess.run([
        "ffmpeg", "-y", "-ss", TRIM_START, "-i", str(raw), "-i", str(palette),
        "-lavfi", f"setpts=PTS/{SPEED},fps=24,scale=1100:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
        "-loop", "0",
        str(OUT_GIF),
    ], check=True, capture_output=True)

    shutil.rmtree(TMP_DIR, ignore_errors=True)
    size_kb = OUT_GIF.stat().st_size // 1024
    print(f"[gif] done -> {OUT_GIF}  ({size_kb} KB)")


if __name__ == "__main__":
    asyncio.run(main())
