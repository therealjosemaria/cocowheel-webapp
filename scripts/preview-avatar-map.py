"""Read-only local map previews of an operator-supplied avatar, using the existing fixture.
Start serve-map-avatar-fixture.mts with GUMWHEEL_AVATAR_RENDER pointing to a private
cutout; save fixture metadata to /tmp/gumwheel-avatar-fixture.log. Next: port 3491.
Road geometry is synthetic. Public OSM tile requests contain only these public-place
tile coordinates, never the avatar image, account or source photo.
"""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3491"
OUT = Path(os.environ.get("GUMWHEEL_AVATAR_PREVIEW_DIR", "/tmp/gumwheel-avatar-map-preview"))
OUT.mkdir(parents=True, exist_ok=True, mode=0o700)
OUT.chmod(0o700)
fixture = json.loads(Path("/tmp/gumwheel-avatar-fixture.log").read_text().splitlines()[0])

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    for width in [390, 1440]:
        errors = []
        context = browser.new_context(viewport={"width": width, "height": 1000})
        context.add_cookies([{"name": "cocowheels_guest", "value": "synthetic-avatar-owner", "url": BASE}])

        def network(route):
            request = route.request
            host = urlparse(request.url).hostname or ""
            if request.url == BASE + "/api/route-preview":
                body = request.post_data_json
                route.fulfill(json={"points": [body["origin"], body["destination"]], "durationSeconds": 600})
            elif request.method in ["GET", "HEAD"] and (request.url.startswith(BASE) or host.endswith(".tile.openstreetmap.org")):
                route.continue_()
            else:
                route.abort()

        context.route("**/*", network)
        for view, path in [("home", "/"), ("requested", "/activity/requests/" + fixture["requestId"])]:
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(BASE + path)
            marker = page.locator(".map-avatar-artwork")
            expect(marker).to_have_count(1)
            marker.scroll_into_view_if_needed()
            page.wait_for_function("img => img.complete && img.naturalHeight === 256", arg=marker.element_handle())
            expect(page.locator(".leaflet-tile-loaded").first).to_be_visible(timeout=20000)
            page.wait_for_timeout(800)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            size = marker.bounding_box()
            assert size and size["height"] <= 48 and size["width"] <= 48
            page.screenshot(path=str(OUT / f"{view}-{width}.png"), full_page=True)
            page.locator(".leaflet-container").screenshot(path=str(OUT / f"{view}-map-{width}.png"))
            page.close()

        # Same shared marker in the driver's view of the rider's pending request.
        context.clear_cookies()
        context.add_cookies([{"name": "cocowheels_guest", "value": "synthetic-avatar-driver", "url": BASE}])
        driver = context.new_page()
        driver.on("pageerror", lambda error: errors.append(str(error)))
        driver.goto(BASE + "/activity/" + fixture["rideId"])
        driver.locator(".driver-request-card > summary").click()
        driver.get_by_role("button", name="Show route", exact=True).click()
        expect(driver.locator(".map-avatar-artwork")).to_have_count(1)
        driver.screenshot(path=str(OUT / f"driver-{width}.png"), full_page=True)
        assert not errors, errors
        print(f"PASS {width}: local Home/rider/driver map previews, loaded 256px cutout in unchanged 48px marker, real tiles, no overflow/errors, no writes or paid requests", flush=True)
        context.close()
    browser.close()
