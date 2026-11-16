"""Private comparison layout against the synthetic local API; no generation.
Requires the existing private comparison artifacts and fixture on 3492/Next 3491.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE='http://127.0.0.1:3491'
OUT=Path('/tmp/gumwheel-tripo-image-review');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in [320,390,1440]:
        context=browser.new_context(viewport={'width':width,'height':1000})
        context.add_cookies([{'name':'cocowheels_guest','value':'synthetic-avatar-admin','url':BASE}])
        # Preserve the existing 3D posters without downloading the historical large GLBs.
        context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) and r.request.method in ['GET','HEAD'] and '.glb' not in r.request.url else r.abort())
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/admin/avatars')
        expect(page.get_by_role('heading',name='Avatar images',exact=True)).to_be_visible()
        images=page.locator('.tripo-image-grid img')
        expect(images).to_have_count(3)
        for i in range(3):
            expect(images.nth(i)).to_be_visible()
            images.nth(i).scroll_into_view_if_needed()
            page.wait_for_function('(image)=>image.complete && image.naturalWidth>0',arg=images.nth(i).element_handle())
        expect(page.get_by_role('heading',name='P2 · current avatar',exact=True)).to_be_visible()
        expect(page.locator('.tripo-image-grid').get_by_text('Transparency present',exact=True)).to_be_visible()
        expect(page.locator('.tripo-image-grid').get_by_text('Opaque background',exact=True)).to_be_visible()
        for name,charge in [('Sunburst','$0.10'),('Seedream v5','$0.05')]:
            row=page.locator('.tripo-table tbody tr').filter(has=page.get_by_role('rowheader',name=name,exact=True))
            expect(row.locator('td').nth(3)).to_have_text(charge)
        expect(page.locator('.tripo-table tbody tr')).to_have_count(7)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=str(OUT/f'comparison-{width}.png'),full_page=True)
        if width>=1000:
            boxes=[images.nth(i).bounding_box() for i in range(3)]
            assert max(b['y'] for b in boxes)-min(b['y'] for b in boxes)<2
        assert not errors,errors
        context.close()
        denied=browser.new_context(viewport={'width':width,'height':1000})
        dp=denied.new_page();dp.goto(BASE+'/admin/avatars')
        expect(dp.get_by_role('textbox',name='Email',exact=True)).to_be_visible()
        for asset in ['reference.png','P2-20260801.png','chat_image_2.5_sunburst.png','seedream_v5.png']:
            assert denied.request.get(BASE+'/api/admin/tripo/'+asset).status==403
        denied.close()
        print(f'PASS {width}: three contained image previews, verified costs, preserved seven rows/3D posters, desktop alignment, no overflow/errors, anonymous assets denied; no paid request',flush=True)
    browser.close()
