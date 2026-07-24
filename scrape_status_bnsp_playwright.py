"""
Scrape ALL LSP status dari BNSP via Playwright - save inline, robust
"""
import json, sys, asyncio, os
from playwright.async_api import async_playwright

BASE = "https://bnsp.go.id/lsp"
OUTPUT = "C:\\Users\\DELL\\LSP-Dashboard\\bnsp_status_all.json"

async def scrape_all():
    all_lsp = []
    seen_names = set()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1280, "height": 900}
        )
        page = await context.new_page()
        await page.goto(BASE, wait_until="networkidle", timeout=60000)

        for page_num in range(1, 150):
            print(f"Page {page_num}...", file=sys.stderr)
            try:
                await page.wait_for_selector('h3 a[href*="/lsp/"]', timeout=10000)
            except:
                print("  No cards found", file=sys.stderr)
                break

            cards = await page.evaluate('''
                () => {
                    const items = [];
                    document.querySelectorAll('h3 a[href*="/lsp/"]').forEach(a => {
                        const card = a.closest('.bg-white.rounded-lg');
                        if (!card) return;
                        const name = a.textContent.trim();
                        let status = 'Unknown';
                        card.querySelectorAll('span').forEach(s => {
                            const t = s.textContent.trim();
                            if (t === 'Lisensi Aktif') status = 'Lisensi Aktif';
                            else if (t === 'Masa Berlaku Habis') status = 'Masa Berlaku Habis';
                        });
                        const txt = card.innerText;
                        const m1 = txt.match(/(BNSP-LSP-\\d+-I[Dl])/);
                        const m2 = txt.match(/SK:\\s*([^)\\n<]+)/);
                        const linkEl = card.querySelector('a[href*="/lsp/"]');
                        items.push({
                            nama: name, status,
                            no_lisensi: m1 ? m1[1] : '',
                            no_sk: m2 ? m2[1].trim() : '',
                            slug: linkEl ? linkEl.href : ''
                        });
                    });
                    return items;
                }
            ''')

            if not cards:
                print("  Empty page", file=sys.stderr)
                break

            new = 0
            for item in cards:
                key = item['nama'].lower().strip()
                if key and key not in seen_names:
                    seen_names.add(key)
                    all_lsp.append(item)
                    new += 1

            print(f"  {len(cards)} LSP ({new} baru, total {len(all_lsp)})", file=sys.stderr)

            if new == 0:
                break

            # Save progress every 10 pages
            if page_num % 10 == 0:
                with open(OUTPUT, 'w', encoding='utf-8') as f:
                    json.dump(all_lsp, f, indent=2, ensure_ascii=False)
                print(f"  [saved checkpoint: {len(all_lsp)} LSP]", file=sys.stderr)

            # Click next page
            try:
                nav_links = await page.query_selector_all('nav.flex.justify-center a, .flex.justify-center.gap-1 a')
                if nav_links:
                    last = nav_links[-1]
                    href = await last.get_attribute('href') or ''
                    await last.click()
                    print(f"  Clicked -> {href[:60]}", file=sys.stderr)
                else:
                    print("  No nav links", file=sys.stderr)
                    break
            except Exception as e:
                print(f"  Pagination error: {e}", file=sys.stderr)
                break

            await page.wait_for_timeout(1500)
            try:
                await page.wait_for_load_state("networkidle", timeout=5000)
            except:
                pass

        await browser.close()

    # Final save
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(all_lsp, f, indent=2, ensure_ascii=False)
    print(f"\nDone: {len(all_lsp)} LSP saved to {OUTPUT}", file=sys.stderr)

asyncio.run(scrape_all())
