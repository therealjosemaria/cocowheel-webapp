"""Local browser smoke check; API responses mocked and external traffic blocked."""
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3091"
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    for width in [390, 1440]:
        page = browser.new_page(viewport={"width": width, "height": 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.route("**/*", lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
        page.route("**/api/**", lambda r: r.fulfill(json={"current": None, "currents": [], "unikey": None}))
        # The SDK must mount, but blocked analytics must not break ordinary pages.
        page.route("**/_vercel/insights/**", lambda r: r.abort())
        for path, heading in [("/", "Going your way."), ("/privacy", "Privacy policy")]:
            page.goto(BASE + path)
            expect(page.get_by_role("heading", name=heading, exact=True)).to_be_visible()
            page.wait_for_function("typeof window.va === 'function'")
            assert page.locator('meta[name="referrer"]').get_attribute("content") == "origin"
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            if path == "/privacy":
                page.get_by_role("heading", name="Website analytics").scroll_into_view_if_needed()
            page.screenshot(path=f"/tmp/analytics-{width}-{'privacy' if path == '/privacy' else 'home'}.png")
        assert not errors, errors
        print(f"PASS {width}px: Home, Privacy, SDK mount, blocked-script resilience, no overflow/errors")
        page.close()
    browser.close()
