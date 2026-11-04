"""Next :3201; synthetic GPS and APIs, all external traffic blocked."""
from playwright.sync_api import sync_playwright, expect
BASE='http://127.0.0.1:3201'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [390,1440]:
  for view in ['?start=rider','?start=driver','usual-route']:
   page=b.new_page(viewport={'width':width,'height':900});errors=[];lookups=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script('''window.gpsCalls=[];window.gpsMode='success';
   navigator.geolocation.getCurrentPosition=(ok,fail,options)=>{
     gpsCalls.push(options);
     const success=()=>ok({coords:{latitude:-33.883,longitude:151.207},timestamp:Date.now()});
     if(gpsMode==='denied')fail({code:1});
     else if(gpsMode==='timeout')fail({code:3});
     else if(gpsMode==='unavailable')fail({code:2});
     else if(gpsMode==='fallback'&&options.enableHighAccuracy)fail({code:3});
     else if(gpsMode==='delayed')window.finishGps=success;
     else success();
   };''')
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE) else r.abort())
   def api(r):
    path=r.request.url.split('/api/')[-1].split('?')[0]
    if r.request.method!='GET':assert path in ['place-label','place-search','route-preview'],path
    if path=='university/session':data={'unikey':'fixture'}
    elif path=='home-presence':data={'cells':[]}
    elif path=='profile':data={'username':'fixture','email':'fixture@example.com','photoUrl':None}
    elif path=='vehicle':data={'vehicle':None}
    elif path=='usual-route':data={'route':None,'alertsAvailable':True}
    elif path=='place-label':lookups.append(r.request.post_data_json);data={'label':'Central station, Sydney NSW, Australia','countryCode':'au'}
    elif path=='place-search':data={'places':[]}
    else:data={'current':None,'currents':[],'keys':[]}
    r.fulfill(json=data)
   page.route('**/api/**',api)
   def open_origin():
    page.goto(BASE+'/'+view)
    if view=='usual-route':page.locator('.usual-route-disclosure > summary').click()
    else:page.get_by_role('button',name='Where from?',exact=True).click()
    expect(page.get_by_role('button',name='Use my location',exact=True)).to_be_visible()
   open_origin();assert page.evaluate('gpsCalls.length')==0
   for mode,message in [('denied','Location access is blocked.'),('timeout','Finding your location took too long.'),('unavailable','Your device couldn’t determine your location.')]:
    page.evaluate('(mode)=>{gpsMode=mode;gpsCalls=[]}',mode)
    before=len(lookups)
    page.get_by_role('button',name='Use my location',exact=True).click()
    expect(page.locator('.place-search [role="alert"]')).to_contain_text(message)
    assert len(lookups)==before
    assert page.evaluate('gpsCalls.length')==(1 if mode=='denied' else 2)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=f'/tmp/location-recovery-{mode}-{view.replace("?start=", "")}-{width}.png',full_page=True)
   page.evaluate("gpsMode='fallback';gpsCalls=[]")
   page.get_by_role('button',name='Use my location',exact=True).click()
   if view=='usual-route':expect(page.get_by_placeholder('Where from?',exact=True)).to_have_value('Central station, Sydney NSW, Australia')
   else:expect(page.get_by_role('dialog',name='Where from?',exact=True)).to_have_count(0)
   calls=page.evaluate('gpsCalls');assert len(calls)==2 and calls[0]['enableHighAccuracy'] and not calls[1]['enableHighAccuracy']
   assert calls[1]['maximumAge']==60000
   assert len(lookups)==before+1
   # Late fixes must not overwrite a typed address or start a fallback after leaving.
   open_origin();page.evaluate("gpsMode='delayed'")
   page.get_by_role('button',name='Use my location',exact=True).click()
   page.get_by_placeholder('Where from?',exact=True).fill('My typed address')
   before=len(lookups);page.evaluate('finishGps()');page.wait_for_timeout(100)
   assert len(lookups)==before
   expect(page.get_by_placeholder('Where from?',exact=True)).to_have_value('My typed address')
   assert not errors,errors
   print('PASS',width,view,'denied/unavailable/timeout, bounded fallback, stale fix, no automatic GPS or trip writes',flush=True)
   page.close()
 b.close()
