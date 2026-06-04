"""
Auto-record a 30-second promo video of the StreamMA project page.

Captions are rendered as a fixed HTML overlay (web font, supports unicode),
so the recorded webm already contains the caption — ffmpeg only transcodes.

Usage:
    1. Make sure the local server is running:
         http://localhost:8765/index.html
    2. Run:
         python3 promo/record.py
    3. Output:
         promo/raw.webm   (1920x1080)
       Then run promo/process.sh to produce streamma_promo.mp4.
"""
import asyncio
import json
import shutil
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent
URL = "http://localhost:8765/index.html"
OUT = ROOT / "raw.webm"
TMP_DIR = ROOT / "_tmp_recording"


# ---------- Chapter timeline ----------
# Each tuple: (selector or None or "__bottom__", hold_seconds, caption_text, optional callback)
# Total ≈ 30 s of "logical" hold; the actual webm is ~ 41 s after smooth-scroll easing.
TIMELINE = [
    (None,                       3.0,  "Less waiting. Better reasoning.",                        None),
    (".simplebench-highlight",   3.0,  "90.0% on SimpleBench — new SOTA",                        None),
    (".contributions-box",       4.0,  "+7.3 pp accuracy · 26.9× speedup · half the cost",        None),
    ("#hero-anim",               4.5,  "Step-level forwarding in action",                        None),
    ("#theory",                  4.5,  "Three closed-form theorems",                             "click_thm1"),
    ("#results",                 4.5,  "Wins across 8 reasoning benchmarks",                     None),
    ("#pareto",                  4.0,  "Stream strictly dominates Serial on cost",               None),
    ("__bottom__",               2.5,  "github.com/EnVision-Research/StreamMA",                  None),
]


CAPTION_INIT_JS = r"""
(() => {
  if (document.getElementById('__promo_cap_wrap')) return;
  const wrap = document.createElement('div');
  wrap.id = '__promo_cap_wrap';
  wrap.innerHTML = `
    <style>
      #__promo_cap_wrap {
        position: fixed;
        left: 0; right: 0; bottom: 70px;
        display: flex; justify-content: center;
        z-index: 999999;
        pointer-events: none;
      }
      #__promo_cap {
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', sans-serif;
        font-weight: 700;
        font-size: 38px;
        line-height: 1.3;
        letter-spacing: 0.2px;
        color: #ffffff;
        background: rgba(8, 28, 18, 0.78);
        padding: 16px 36px;
        border-radius: 14px;
        box-shadow: 0 10px 32px rgba(0,0,0,0.35);
        max-width: 78%;
        text-align: center;
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 0.45s ease, transform 0.45s ease;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      #__promo_cap.show {
        opacity: 1;
        transform: translateY(0);
      }
    </style>
    <div id="__promo_cap"></div>
  `;
  document.body.appendChild(wrap);
})();
"""


async def set_caption(page, text: str):
    payload = json.dumps(text)
    await page.evaluate(
        f"""
        (() => {{
          const cap = document.getElementById('__promo_cap');
          if (!cap) return;
          cap.classList.remove('show');
          setTimeout(() => {{
            cap.textContent = {payload};
            cap.classList.add('show');
          }}, 220);
        }})()
        """
    )


async def hide_caption(page):
    await page.evaluate(
        "document.getElementById('__promo_cap')?.classList.remove('show')"
    )


async def smooth_scroll_to(page, selector: str, top_pad: int = 60):
    """Smoothly scroll until the element's top is `top_pad` px below the viewport top."""
    if selector == "__bottom__":
        await page.evaluate(
            "window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'})"
        )
        return
    box = await page.locator(selector).first.bounding_box()
    if box is None:
        return
    current_y = await page.evaluate("window.scrollY")
    target = max(0, int(box["y"] + current_y - top_pad))
    await page.evaluate(
        f"window.scrollTo({{top: {target}, behavior: 'smooth'}})"
    )


async def main() -> None:
    if TMP_DIR.exists():
        shutil.rmtree(TMP_DIR)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=str(TMP_DIR),
            record_video_size={"width": 1920, "height": 1080},
            device_scale_factor=1,
        )
        page = await context.new_page()

        # Google Fonts is blocked from this sandbox — abort to avoid hanging.
        async def block_blocked_cdns(route):
            url = route.request.url
            if "fonts.googleapis" in url or "fonts.gstatic" in url:
                await route.abort()
            else:
                await route.continue_()

        await page.route("**/*", block_blocked_cdns)

        print(f"[record] loading {URL}", flush=True)
        await page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_load_state("load", timeout=15000)
        except Exception:
            pass
        await asyncio.sleep(2.5)

        # Inject caption overlay.
        await page.evaluate(CAPTION_INIT_JS)

        for idx, (sel, hold, caption, cb) in enumerate(TIMELINE, start=1):
            if sel is not None:
                print(f"[record] chapter {idx}: scroll to {sel}", flush=True)
                await smooth_scroll_to(page, sel)
                await asyncio.sleep(0.7)  # let smooth scroll easing finish
            if cb == "click_thm1":
                try:
                    await page.evaluate(
                        "document.querySelector('.theorem-tab[data-panel=thm1]')?.click()"
                    )
                except Exception:
                    pass
                await asyncio.sleep(0.3)
            print(f"[record] chapter {idx}: caption=\"{caption}\" hold={hold}s",
                  flush=True)
            await set_caption(page, caption)
            await asyncio.sleep(hold)

        await hide_caption(page)
        await asyncio.sleep(0.3)

        await context.close()
        await browser.close()

    webms = list(TMP_DIR.glob("*.webm"))
    if not webms:
        print("[record] ERROR: no video file was produced.", file=sys.stderr)
        sys.exit(1)
    src = webms[0]
    if OUT.exists():
        OUT.unlink()
    shutil.move(str(src), str(OUT))
    shutil.rmtree(TMP_DIR, ignore_errors=True)

    size_kb = OUT.stat().st_size // 1024
    print(f"[record] done -> {OUT}  ({size_kb} KB)")


if __name__ == "__main__":
    asyncio.run(main())
