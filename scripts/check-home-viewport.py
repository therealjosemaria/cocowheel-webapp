"""10,004 synthetic posts in the actual isolated API. Never point this at production."""
import asyncio, json, math
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright, expect
BASE='http://127.0.0.1:3491'
OUT=Path('/tmp/gumwheel-home-viewport-browser'); OUT.mkdir(exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        control=await p.request.new_context(base_url='http://127.0.0.1:3494',extra_http_headers={'X-Gumwheel-Fixture':'1'})
        assert (await control.post('/seed-viewport')).ok
        legacy=await control.get(BASE+'/api/home-presence')
        assert not any(c['latitude']==-33.925 for c in (await legacy.json())['cells'])
        results=[]
        for width in [320,390,1440]:
            context=await browser.new_context(viewport={'width':width,'height':900},has_touch=width<700,is_mobile=width<700,reduced_motion='reduce')
            page=await context.new_page(); errors=[]; queries=[]; replies=[]; area_tasks=[]; state={'delay':False,'old':None,'failed':False}
            page.on('pageerror',lambda error:errors.append(str(error)))
            async def network(route):
                url=route.request.url
                if (url.startswith(BASE) or '.tile.openstreetmap.org/' in url) and route.request.method in ['GET','HEAD']: await route.continue_()
                else: await route.abort()
            await context.route('**/*',network)
            async def area(route):
                assert route.request.method=='GET'
                assert not route.request.headers.get('cookie') and not route.request.headers.get('authorization')
                q={k:float(v[0]) for k,v in parse_qs(urlparse(route.request.url).query).items() if k!='overview'}
                queries.append(q)
                if state['failed'] and q:
                    await route.fulfill(status=503,json={'error':'UNAVAILABLE'}); return
                response=await route.fetch(); data=await response.json()
                if state['delay'] and q:
                    state['delay']=False; state['old']=data
                    data={'cells':[], 'hasPresence':True} # delayed obsolete empty response must not erase the newer view
                    await asyncio.sleep(1.4)
                try: await route.fulfill(response=response,json=data)
                except Exception: pass # Aborted obsolete request is expected.
                replies.append((q,data))
            await context.route('**/api/home-presence*',area)
            await page.goto(BASE)
            surface=page.locator('.home-presence-map'); await expect(surface).to_be_visible(); await surface.scroll_into_view_if_needed()
            async def latest():
                for _ in range(50):
                    if queries and queries[-1]: return queries[-1]
                    await page.wait_for_timeout(100)
                raise AssertionError('No viewport request')
            async def zoom(target):
                for _ in range(23):
                    q=await latest(); z=q['zoom']
                    if z==target: return
                    await surface.get_by_role('button',name='Zoom in' if z<target else 'Zoom out',exact=True).click()
                    await page.wait_for_timeout(380)
                raise AssertionError('Zoom failed')
            def projected(lat,lon,z):
                scale=256*2**z; rad=math.radians(max(-85,min(85,lat)))
                return ((lon+180)/360*scale,(1-math.log(math.tan(rad)+1/math.cos(rad))/math.pi)/2*scale)
            async def pan_to(lat,lon):
                for _ in range(35):
                    q=await latest(); z=q['zoom']; box=await surface.bounding_box()
                    # Public snapped bounds are sufficient at regional zoom; no private GPS.
                    a=projected(q['south'],q['west'],z); b=projected(q['north'],q['east'],z); target=projected(lat,lon,z)
                    dx=(a[0]+b[0])/2-target[0]; dy=(a[1]+b[1])/2-target[1]
                    if abs(dx)<10 and abs(dy)<10:return
                    dx=max(-box['width']*.32,min(box['width']*.32,dx));dy=max(-60,min(60,dy))
                    x=box['x']+box['width']/2;y=box['y']+90
                    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x+dx,y+dy,steps=6); await page.wait_for_timeout(120); await page.mouse.up()
                    await page.wait_for_timeout(420)
                # High zoom bounds quantise more than one screen pixel; requests still prove the area.
            async def close_to(lat,lon):
                await zoom(7); await pan_to(lat,lon)
                for level in [8,9,10,11,12]:
                    await zoom(level); await page.wait_for_timeout(200)
                    car=surface.locator('.vehicle-artwork-marker')
                    if await car.count():
                        marker=await car.first.locator('xpath=ancestor::div[contains(@class,"leaflet-marker-icon")]').bounding_box()
                        box=await surface.bounding_box()
                        # In the two-figure public cell the driver slot is 22px left of its area centre.
                        dx=box['x']+box['width']/2-(marker['x']+46);dy=box['y']+100-(marker['y']+40)
                        x=box['x']+box['width']/2;y=box['y']+90
                        await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,steps=6);await page.wait_for_timeout(120);await page.mouse.up();await page.wait_for_timeout(450)
            await zoom(7); await expect(surface.locator('.leaflet-marker-icon')).to_have_count(0)
            await close_to(-33.925,151.225)
            await page.wait_for_timeout(650)
            q,data=replies[-1]; assert q['zoom']==12 and data['hasPresence']
            assert {'driver','rider'}<=set(c['role'] for c in data['cells']), {'query':q,'cells':data['cells']}
            assert any(c['latitude']==-33.925 for c in data['cells'])
            assert 0<await surface.locator('.leaflet-marker-icon').count()<=50
            await page.screenshot(path=str(OUT/f'sydney-{width}.png'),full_page=True)
            # Delay one old-area response, then move again. Its eventual completion must not reframe the map.
            state['delay']=True
            box=await surface.bounding_box(); x=box['x']+box['width']/2;y=box['y']+90
            for dx in [-160,160]:
                await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+12,steps=5);await page.wait_for_timeout(120);await page.mouse.up();await page.wait_for_timeout(380)
            await page.wait_for_timeout(1600)
            assert not errors,errors
            assert state['old'] is not None
            assert await surface.locator('.leaflet-marker-icon').count()>0, 'Obsolete response erased the current area'
            await close_to(-37.825,144.975); await page.wait_for_timeout(650)
            q,data=replies[-1]; assert any(c['latitude']==-37.825 for c in data['cells'])
            assert {'driver','rider'}<=set(c['role'] for c in data['cells'])
            await page.screenshot(path=str(OUT/f'melbourne-{width}.png'),full_page=True)
            # An empty/failing area keeps the surface available for the next pan.
            await zoom(7); await pan_to(-30.025,151.025); await zoom(12); await page.wait_for_timeout(500)
            await expect(surface).to_be_visible(); await expect(surface.locator('.leaflet-marker-icon')).to_have_count(0)
            state['failed']=True; await surface.get_by_role('button',name='Zoom in',exact=True).click(); await page.wait_for_timeout(500)
            await expect(surface).to_be_visible(); await expect(surface.locator('.leaflet-marker-icon')).to_have_count(0)
            state['failed']=False
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert not errors,errors
            results.append({'width':width,'population':10004,'sydneyAndMelbourneBothRoles':True,'emptyAndFailureKeepPan':True,'obsoleteRequestHandled':state['old'] is not None,'requests':len(queries),'errors':errors})
            await context.close()
        await control.dispose();await browser.close()
    (OUT/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
asyncio.run(main())
