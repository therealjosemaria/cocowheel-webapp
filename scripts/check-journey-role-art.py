"""3D role artwork: synthetic account/journeys; only public OSM tiles allowed."""
from playwright.sync_api import sync_playwright, expect
from urllib.parse import urlparse
BASE='http://127.0.0.1:3201'
origin={'latitude':-33.918,'longitude':151.204,'label':'Example origin, Sydney'}
end={'latitude':-33.889,'longitude':151.187,'label':'Example destination, Sydney'}
ride={'rideId':'COCO-ART','status':'CANCELLED','driverAlias':'driver01','priceAud':0,
      'scheduledDepartureAt':'2026-11-04T05:00:00Z','expiresAt':'2026-11-04T06:00:00Z',
      'plannedRoute':{'origin':origin,'destination':end}}
post={'id':'post-art','origin':origin,'destination':end,'date':'any','time':'','status':'CANCELLED','offers':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [390,1440]:
  c=b.new_context(viewport={'width':width,'height':900});page=c.new_page();errors=[];writes=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def network(r):
   host=urlparse(r.request.url).hostname or ''
   if r.request.url.startswith(BASE) or (host.endswith('.tile.openstreetmap.org') and r.request.method=='GET'):r.continue_()
   else:r.abort()
  c.route('**/*',network)
  def api(r):
   path=r.request.url.split('/api/')[-1].split('?')[0]
   if path=='university/session':data={'unikey':'tester01'}
   elif path=='current':data={'current':None,'currents':[]}
   elif path=='history':data={'driver':[ride],'rider':[]}
   elif path=='rider-demands':data={'requests':[post],'sent':[]}
   elif path=='profile':data={'username':'tester01','email':'synthetic@example.com','photoUrl':None}
   elif path=='vehicle':data={'vehicle':None}
   elif path=='usual-route':data={'route':None,'alertsAvailable':True}
   elif path=='notifications/reviewed':data={'keys':[]}
   elif path=='rides/COCO-ART':data={'ride':ride}
   elif path=='route-preview':data={'points':[origin,end],'durationSeconds':600}
   elif path.startswith('profile-photo/'):
    r.fulfill(content_type='image/svg+xml',body='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3" fill="#64748b"/><path d="M5 22v-3a7 7 0 0 1 14 0v3" fill="#64748b"/></svg>');return
   else:data={}
   if r.request.method!='GET' and path!='route-preview':writes.append(path)
   r.fulfill(json=data)
  c.route('**/api/**',api)
  for path,name in [('/','home'),('/help','help'),('/usual-route','profile'),('/activity','activity'),('/activity/COCO-ART','driver-detail')]:
   page.goto(BASE+path)
   if name=='profile':page.locator('.vehicle-details > summary').click() if page.locator('.vehicle-details > summary').count() else None
   if name=='driver-detail':
    expect(page.locator('.journey-marker-model .journey-role-art-driver')).to_be_visible()
    model=page.locator('.journey-marker-model').first
    expect(model).to_have_css('width','48px');expect(model).to_have_css('height','48px')
    expect(model).to_have_css('background-color','rgba(0, 0, 0, 0)')
    expect(model).to_have_css('border-radius','0px')
    credits=page.locator('.map-attribution')
    expect(credits).to_have_count(1)
    expect(credits).to_have_css('left','7px');expect(credits).to_have_css('bottom','10px')
    expect(credits).to_have_css('background-color','rgba(255, 255, 255, 0.7)')
    expect(credits).to_have_css('box-shadow','none')
    expect(credits).to_have_css('border-radius','5px')
    expect(credits.get_by_role('link',name='Geoapify')).to_be_visible()
    page.wait_for_timeout(700)
   else:expect(page.locator('.journey-role-art').first).to_be_visible()
   if name=='home':
    expect(page.locator('.role-card-primary .journey-role-art')).to_have_count(1)
    dark=page.locator('.role-card-primary .journey-role-art').evaluate('(el)=>getComputedStyle(el, "::before").backgroundImage')
    light=page.locator('.role-card:not(.role-card-primary) .journey-role-art').evaluate('(el)=>getComputedStyle(el, "::before").backgroundImage')
    assert 'journey-person-standing-v2-on-dark.webp' in dark and 'journey-roles-3d-v1.webp' in light,(dark,light)
   decoded=page.evaluate('''async () => Promise.all(['journey-roles-3d-v1','journey-roles-3d-v1-on-dark','journey-person-standing-v2','journey-person-standing-v2-on-dark'].map(async variant => {const i=new Image();i.src='/brand/'+variant+'.webp';await i.decode();return [i.naturalWidth,i.naturalHeight];}))''')
   assert decoded==[[532,266],[532,266],[128,256],[128,256]],decoded
   for icon in page.locator('.journey-role-art').all():
    expected=icon.evaluate('''el => {const rider=el.classList.contains('journey-role-art-rider');const dark=!!el.closest('.role-card-primary, .primary, .journey-role-art-on-dark');return (rider?'journey-person-standing-v2':'journey-roles-3d-v1')+(dark?'-on-dark':'')+'.webp'}''')
    assert expected in icon.evaluate('(el)=>getComputedStyle(el, "::before").backgroundImage')
    expect(icon).to_have_attribute('aria-hidden','true')
    assert icon.evaluate('(el)=>el.tabIndex')==-1
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),name
   page.screenshot(path=f'/tmp/role-art-{name}-{width}.png',full_page=True)
  assert not errors and not writes,(errors,writes)
  print(f'PASS {width}: asset decoding, Home/Help/Profile/Activity/detail, decorative labels, transparent 48px map model, no writes/errors/overflow',flush=True)
  c.close()
 b.close()
