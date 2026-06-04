"""
Capture each section of project_website/index.html as a high-resolution PNG.

Output: project_website/promo/screenshots/*.png
"""
import asyncio
import shutil
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent
URL = "http://localhost:8765/index.html"
OUT_DIR = ROOT / "screenshots"


# (selector, output filename, optional pre-action callback name)
TARGETS = [
    ("#insight",  "insight.png",       None),
    ("#perturb",  "perturb.png",       None),
    ("#results",  "results_table.png", None),
    ("#scaling",  "scaling.png",       None),
    ("#pareto",   "pareto.png",        None),
    # Theorem section: capture three states (one per theorem tab)
    ("#theory",   "theory_1.png",      "click_thm1"),
    ("#theory",   "theory_2.png",      "click_thm2"),
    ("#theory",   "theory_3.png",      "click_thm3"),
]


async def main():
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            viewport={"width": 1400, "height": 900},
            device_scale_factor=2,
        )
        page = await context.new_page()

        # Block Google Fonts (hangs in this sandbox)
        async def block_fonts(route):
            url = route.request.url
            if "fonts.googleapis" in url or "fonts.gstatic" in url:
                await route.abort()
            else:
                await route.continue_()
        await page.route("**/*", block_fonts)

        print(f"[capture] loading {URL}", flush=True)
        await page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        try:
            await page.wait_for_load_state("load", timeout=15000)
        except Exception:
            pass
        # Wait for MathJax + SVG charts to render
        await asyncio.sleep(6)
        # Force MathJax to typeset (it loads async; sometimes finishes after `load`)
        try:
            await page.evaluate("""
                (async () => {
                    if (window.MathJax && window.MathJax.startup) {
                        await window.MathJax.startup.promise;
                    }
                    if (window.MathJax && window.MathJax.typesetPromise) {
                        await window.MathJax.typesetPromise();
                    }
                })()
            """)
        except Exception as e:
            print(f"  (mathjax warn: {e})", flush=True)
        await asyncio.sleep(2)

        for selector, fname, cb in TARGETS:
            print(f"[capture] {fname} <- {selector} (cb={cb})", flush=True)

            if cb == "click_thm1":
                await page.evaluate(
                    "document.querySelector('.theorem-tab[data-panel=\"thm1\"]')?.click()"
                )
                await asyncio.sleep(0.6)
            elif cb == "click_thm2":
                await page.evaluate(
                    "document.querySelector('.theorem-tab[data-panel=\"thm2\"]')?.click()"
                )
                await asyncio.sleep(0.6)
            elif cb == "click_thm3":
                await page.evaluate(
                    "document.querySelector('.theorem-tab[data-panel=\"thm3\"]')?.click()"
                )
                await asyncio.sleep(0.6)

            # Scroll target into view
            await page.evaluate(
                f"document.querySelector('{selector}')?.scrollIntoView({{block: 'start'}})"
            )
            await asyncio.sleep(0.5)

            element = page.locator(selector).first
            await element.screenshot(path=str(OUT_DIR / fname))
            kb = (OUT_DIR / fname).stat().st_size // 1024
            print(f"  -> {OUT_DIR / fname}  ({kb} KB)", flush=True)

        await browser.close()

    print(f"[capture] done. {len(TARGETS)} screenshots in {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
