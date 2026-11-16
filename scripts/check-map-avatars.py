"""Local browser → synthetic API → in-memory SQLite; only road geometry is mocked.

Run serve-map-avatar-fixture.mts and Next on 127.0.0.1:3492 / :3491 first.
No production writes, account credentials, real GPS, emails or paid generations.
Set GUMWHEEL_TEST_TILES=1 to permit public OSM tiles for these public-place routes.
"""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3491"
OUT = Path("/tmp/gumwheel-map-avatar-review")
OUT.mkdir(exist_ok=True)
fixture = json.loads(Path("/tmp/gumwheel-avatar-fixture.log").read_text().splitlines()[0])
origin = {"latitude": -33.8923, "longitude": 151.1981, "label": "Redfern Station"}
destination = {"latitude": -33.8886, "longitude": 151.1872, "label": "University of Sydney"}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    for width in [320, 390, 1440]:
        context = browser.new_context(viewport={"width": width, "height": 900})
        context.add_cookies([{"name": "cocowheels_guest", "value": "synthetic-avatar-owner", "url": BASE}])
        errors = []
        context.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
        def network(route):
            request = route.request
            host = urlparse(request.url).hostname or ""
            if request.url == BASE+"/api/route-preview":
                body = request.post_data_json
                route.fulfill(json={"points": [body["origin"], body["destination"]], "durationSeconds": 600})
            elif request.url.startswith(BASE) or (os.environ.get("GUMWHEEL_TEST_TILES") == "1" and host.endswith(".tile.openstreetmap.org") and request.method == "GET"):
                route.continue_()
            else:
                route.abort()
        context.route("**/*", network)
        profile = context.new_page(); profile.goto(BASE+"/usual-route")
        avatar = profile.locator(".avatar-details")
        expect(avatar).to_be_visible(); avatar.locator(":scope > summary").click()
        preview = avatar.get_by_alt_text("Your map avatar", exact=True)
        expect(preview).to_be_visible()
        assert preview.evaluate("e => e.complete && e.naturalHeight > 256")
        checkbox = avatar.get_by_role("checkbox", name="Personal avatar", exact=True)
        expect(checkbox).to_have_count(0)
        profile.screenshot(path=str(OUT/f"profile-{width}.png"), full_page=True)
        avatar.get_by_role("button", name="Edit", exact=True).click()
        expect(checkbox).to_have_attribute("aria-readonly", "false")
        expect(checkbox).to_be_checked()
        profile.screenshot(path=str(OUT/f"profile-edit-{width}.png"), full_page=True)
        checkbox.uncheck()
        expect(avatar.get_by_role("img", name="Default map avatar", exact=True)).to_be_visible()
        avatar.get_by_role("button", name="Cancel", exact=True).click()
        expect(preview).to_be_visible()
        expect(checkbox).to_have_count(0)
        home = context.new_page(); home.goto(BASE)
        expect(home.locator(".home-presence .map-avatar-artwork")).to_have_count(1)
        assert home.locator(".home-presence .map-avatar-artwork").evaluate("e => e.complete && e.naturalHeight === 256")
        for marker in home.locator(".home-presence .leaflet-marker-icon").all():
            assert marker.get_attribute("tabindex") is None
        assert home.locator(".home-presence button,.home-presence .leaflet-popup").count() == 0
        home.screenshot(path=str(OUT/f"home-{width}.png"), full_page=True)
        requested = context.new_page(); requested.goto(BASE+"/activity/requests/"+fixture["requestId"])
        expect(requested.locator(".map-avatar-artwork")).to_have_count(1)
        assert requested.locator(".map-avatar-artwork").evaluate("e => e.complete && e.naturalHeight === 512")
        requested.screenshot(path=str(OUT/f"request-{width}.png"), full_page=True)
        find = context.new_page()
        find.add_init_script("sessionStorage.setItem('cocowheels:find-ride-draft:v1',JSON.stringify({..."+json.dumps({"pickup": origin, "destination": destination, "departureAt": None})+",savedAt:Date.now()}))")
        find.goto(BASE+"/?start=rider")
        expect(find.locator(".ride-selection-map .map-avatar-artwork")).to_have_count(1)
        find.locator(".ride-option").first.click()
        expect(find.locator(".ride-option").first).to_have_attribute("aria-pressed","true")
        find.screenshot(path=str(OUT/f"find-{width}.png"), full_page=True)
        # Shared map mode: manual views stay stable, selected-route pins survive broad zoom,
        # and the person's map image tier adapts without changing search/selection.
        for map_page, scope in [(requested,".demand-map"),(find,".ride-selection-map")]:
            map_searches=[]
            map_page.on("request",lambda request: map_searches.append(request.url) if request.url.split("?")[0].endswith(("/api/search","/api/rider-demands/search")) else None)
            surface=map_page.locator(scope+" .leaflet-container")
            markers=surface.locator('.leaflet-marker-icon').count()
            paths=surface.locator('path.leaflet-interactive').count()
            box=surface.bounding_box(); x=box['x']+box['width']*.4;y=box['y']+box['height']*.45
            pane=surface.locator('.leaflet-map-pane'); before=pane.evaluate('el=>el.style.transform')
            map_page.mouse.move(x,y);map_page.mouse.down();map_page.mouse.move(x+18,y+12,steps=6);map_page.mouse.up();map_page.wait_for_timeout(300)
            assert pane.evaluate('el=>el.style.transform')!=before
            for _ in range(9):surface.get_by_role('button',name='Zoom out',exact=True).click()
            expect(surface.locator('.leaflet-marker-icon')).to_have_count(markers)
            assert surface.locator('path.leaflet-interactive').count()==paths
            assert not map_searches, "Panning/zooming must preserve current search criteria and selection"
            if scope==".ride-selection-map": expect(map_page.locator(".ride-option").first).to_have_attribute("aria-pressed","true")
            assert '.detail.webp' not in surface.locator('.map-avatar-artwork').get_attribute('src')
            map_page.screenshot(path=str(OUT/f'broad-journey-{width}-{scope[1:]}.png'),full_page=True)
            for _ in range(9):surface.get_by_role('button',name='Zoom in',exact=True).click()

        avatar.get_by_role("button", name="Edit", exact=True).click(); checkbox.uncheck()
        avatar.get_by_role("button", name="Save", exact=True).click()
        expect(avatar.get_by_role("button", name="Edit", exact=True)).to_be_visible()
        for page in [home, requested, find]:
            expect(page.locator(".map-avatar-artwork")).to_have_count(0)
        assert profile.request.get(BASE+"/api/avatar").json()["enabled"] is False
        avatar.get_by_role("button", name="Edit", exact=True).click(); checkbox.check()
        avatar.get_by_role("button", name="Save", exact=True).click()
        expect(avatar.get_by_role("button", name="Edit", exact=True)).to_be_visible()
        for page in [home, requested, find]:
            expect(page.locator(".map-avatar-artwork")).to_have_count(1)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        # A failed map image must show the existing waiting-person artwork.
        marker = requested.locator(".map-avatar-artwork")
        marker.evaluate("e => e.dispatchEvent(new Event('error'))")
        expect(requested.locator(".map-avatar-artwork")).to_have_count(0)
        expect(requested.locator(".journey-marker-model .journey-role-art-rider")).to_have_count(1)
        requested.get_by_role("button", name="Zoom in", exact=True).click()
        expect(requested.locator(".map-avatar-artwork")).to_have_count(1)
        assert profile.evaluate("document.documentElement.scrollWidth <= innerWidth")
        # The other account never receives the owner's private preview/settings.
        other = browser.new_context(viewport={"width": width, "height": 900})
        other.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
        other.add_cookies([{"name": "cocowheels_guest", "value": "synthetic-avatar-driver", "url": BASE}])
        other.route("**/*", network)
        driver = other.new_page(); driver.goto(BASE+"/usual-route")
        driver_avatar = driver.locator(".avatar-details"); driver_avatar.locator(":scope > summary").click()
        expect(driver_avatar.get_by_role("img", name="Default map avatar", exact=True)).to_be_visible()
        default_checkbox = driver_avatar.get_by_role("checkbox", name="Personal avatar", exact=True)
        expect(default_checkbox).to_have_count(0)
        expect(driver_avatar.get_by_role("button", name="Edit", exact=True)).to_have_count(0)
        driver.goto(BASE+"/activity/"+fixture["rideId"])
        driver.locator(".driver-request-card > summary").click()
        show = driver.get_by_role("button", name="Show route", exact=True)
        expect(show).to_be_visible(); show.click()
        expect(driver.locator(".map-avatar-artwork")).to_have_count(1)
        driver.screenshot(path=str(OUT/f"driver-{width}.png"), full_page=True)
        driver.goto(BASE+"/?start=driver")
        driver.get_by_role("button",name="See journey requests",exact=True).click()
        driver.get_by_role("button",name="SEARCH",exact=True).click()
        driver.get_by_role("button",name="Select journey from tester01",exact=True).click()
        selected=driver.locator('.journey-request-option.selected')
        expect(selected).to_have_count(1)
        surface=driver.locator('.journey-request-results .leaflet-container')
        expect(surface.locator('.map-avatar-artwork')).to_have_count(1)
        count=surface.locator('.leaflet-marker-icon').count()
        for _ in range(8): surface.get_by_role('button',name='Zoom out',exact=True).click()
        expect(selected).to_have_count(1);expect(surface.locator('.leaflet-marker-icon')).to_have_count(count)
        driver.screenshot(path=str(OUT/f'driver-discovery-broad-{width}.png'),full_page=True)

        privacy = context.new_page(); privacy.goto(BASE+"/privacy")
        expect(privacy.get_by_role("heading", name="Privacy policy", exact=True)).to_be_visible()
        assert privacy.evaluate("document.documentElement.scrollWidth <= innerWidth")
        privacy.screenshot(path=str(OUT/f"privacy-{width}.png"), full_page=True)
        assert not errors, errors
        print(f"PASS {width}: Profile preview/cancel/save, public Home, Find, requested detail, driver pending request, cross-tab refresh and failed-image fallback")
        other.close(); context.close()
    browser.close()
