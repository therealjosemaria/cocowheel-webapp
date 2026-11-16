"""Optimized local browser/isolated API. Synthetic avatars and shipped vehicle images only, no provider calls.
Requires fixture :3492 and built Next :3491; see docs/MAP_RENDERING.md.
"""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE = 'http://127.0.0.1:3491'
OUT = Path('/tmp/gumwheel-avatar-quality-browser'); OUT.mkdir(exist_ok=True)
art = Path('public/brand/avatar-photo-guide-front-v1.webp').read_bytes()
cells = [{'role':'rider', 'latitude':round(-34.225 + (i//12)*.05,3), 'longitude':round(150.925 + (i%12)*.05,3), 'count':1, 'artworks':[f'/api/map-avatar/{i+1:032x}.webp']} for i in range(120)]
cars=re.findall(r'id: "([^"]+)"',Path('lib/vehicle-catalogue.ts').read_text())
cells=[{**cell,'role':'driver','artworks':[f'/brand/vehicles/v1/{cars[i//2]}-white.webp']} if i%3==0 else cell for i,cell in enumerate(cells)]
report = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width, dpr in [(320,3),(390,3),(1440,2)]:
        context = browser.new_context(viewport={'width':width,'height':900},device_scale_factor=dpr,reduced_motion='reduce',has_touch=width<700,is_mobile=width<700)
        page = context.new_page(); errors=[]; images=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        def network(route):
            url = route.request.url
            if url.startswith(BASE): route.continue_()
            elif '.tile.openstreetmap.org/' in url and os.environ.get('GUMWHEEL_TEST_TILES')=='1': route.continue_()
            else: route.abort()
        context.route('**/*',network)
        context.route('**/api/home-presence*',lambda route:route.fulfill(json={'cells':cells}))
        def image(route):
            images.append(route.request.url)
            # Identical synthetic art; unique URLs exercise independent image elements.
            route.fulfill(content_type='image/webp',body=art,headers={'Cache-Control':'no-store'})
        context.route('**/api/map-avatar/*',image)
        page.goto(BASE)
        surface=page.locator('.home-presence-map'); expect(surface).to_be_visible()
        surface.scroll_into_view_if_needed()
        zoomin=surface.get_by_role('button',name='Zoom in',exact=True); zoomout=surface.get_by_role('button',name='Zoom out',exact=True)
        # Initial broad overview hides figures; move to zoom 8 with the real controls.
        def zoom():
            return surface.locator('img.leaflet-tile').evaluate_all('es=>Math.max(...es.map(e=>Number(new URL(e.src).pathname.split("/")[1])))')
        def set_zoom(target):
            for _ in range(20):
                current=zoom()
                if current==target: break
                (zoomin if current<target else zoomout).click(); page.wait_for_timeout(100)
            assert zoom()==target
        set_zoom(7); expect(surface.locator('.leaflet-marker-icon')).to_have_count(0)
        before=len(images); page.wait_for_timeout(100); assert len(images)==before
        set_zoom(9); page.wait_for_timeout(400)
        count=surface.locator('.leaflet-marker-icon').count(); assert 0<count<=50
        assert all('.detail.webp' not in url for url in images)
        assert surface.locator('.vehicle-artwork-marker').count()>0
        assert surface.locator('.map-avatar-artwork').count()>0
        bounds=surface.bounding_box()
        for marker in surface.locator('.leaflet-marker-icon').all():
            assert marker.get_attribute('tabindex') is None
            assert 'leaflet-interactive' not in (marker.get_attribute('class') or '')
        page.screenshot(path=str(OUT/f'home-city-{width}.png'),full_page=True)
        # Centre on a plotted area before close zoom so the test has visible figures.
        marker=surface.locator('.leaflet-marker-icon').first.bounding_box()
        x=marker['x']+24; y=marker['y']+40
        page.mouse.move(x,y); page.mouse.down(); page.mouse.move(bounds['x']+bounds['width']/2,bounds['y']+bounds['height']/2,steps=8); page.mouse.up()
        page.wait_for_timeout(400); set_zoom(12); page.wait_for_timeout(400)
        detailed=surface.locator('.map-avatar-artwork')
        assert 0<surface.locator('.leaflet-marker-icon').count()<=50
        # The close viewport can contain either role; a nearby public figure remains visible.
        page.screenshot(path=str(OUT/f'home-close-{width}.png'),full_page=True)
        frames=page.evaluate('''()=>new Promise(resolve=>{const samples=[];let last=0;function step(t){if(last)samples.push(t-last);last=t;if(samples.length<45)requestAnimationFrame(step);else resolve(samples)}requestAnimationFrame(step)})''')
        page.evaluate('''()=>{window.__mapInteractionFrames=[];window.__measureMap=true;let last=0;function step(t){if(!window.__measureMap)return;if(last)window.__mapInteractionFrames.push(t-last);last=t;requestAnimationFrame(step)}requestAnimationFrame(step)}''')
        # Pan while rendering; independent of source population and no new full-size URL.
        for step in range(3):
            page.mouse.move(bounds['x']+bounds['width']*.4,bounds['y']+80); page.mouse.down(); page.mouse.move(bounds['x']+bounds['width']*.4+12,bounds['y']+90,steps=5); page.mouse.up(); page.wait_for_timeout(100)
            assert surface.locator('.leaflet-marker-icon').count()<=50
        interaction=page.evaluate("()=>{window.__measureMap=false;return window.__mapInteractionFrames}")
        assert not surface.locator('.leaflet-popup,.leaflet-tooltip').count()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        report.append({'width':width,'dpr':dpr,'candidates':120,'cityVisible':count,'maxVisible':50,'detailRequested':any('.detail.webp' in url for url in images),'mixedRoles':True,'broadViewVisible':0,'uniqueMapImagesRequested':len(set(images)),'idleFrameP95Ms':round(sorted(frames)[int(len(frames)*.95)],2),'interactionFrameP95Ms':round(sorted(interaction)[int(len(interaction)*.95)],2) if interaction else None,'errors':errors})
        context.close()
    browser.close()
(OUT/'result.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
