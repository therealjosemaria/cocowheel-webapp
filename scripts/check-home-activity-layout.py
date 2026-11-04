"""Built Next :3201; synthetic activity/feed, optional read-only OSM tiles."""
import os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
BASE='http://127.0.0.1:3201'
pin={'latitude':-33.925,'longitude':151.175,'label':'Example origin with a longer address, Sydney'}
ride={'rideId':'layout-driver','status':'PUBLISHED','driverAlias':'fixture','priceAud':0,
      'scheduledDepartureAt':'2099-01-01T00:00:00Z','expiresAt':'2099-01-01T06:00:00Z',
      'plannedRoute':{'origin':pin,'destination':{**pin,'label':'Example destination, Sydney'}}}
rider={**ride,'rideId':'layout-rider','status':'REQUESTED',
       'request':{'requestId':'layout-request','status':'PENDING','pickup':pin,'destination':pin}}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width,height in [(320,740),(390,844),(844,390),(1440,900)]:
  c=b.new_context(viewport={'width':width,'height':height});page=c.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  state={'items':[],'feed':True}
  def network(r):
   host=urlparse(r.request.url).hostname or ''
   if r.request.url.startswith(BASE) or (os.environ.get('GUMWHEEL_TEST_TILES')=='1' and host.endswith('.tile.openstreetmap.org') and r.request.method=='GET'):r.continue_()
   else:r.abort()
  c.route('**/*',network)
  def api(r):
   assert r.request.method=='GET',r.request.url
   path=r.request.url.split('/api/')[-1].split('?')[0]
   if path=='home-presence':data={'cells':[{'role':'driver','latitude':-33.925,'longitude':151.175,'count':1}]} if state['feed'] else {'cells':[]}
   elif path=='university/session':data={'unikey':'fixture'}
   elif path=='current':data={'current':state['items'][0] if state['items'] else None,'currents':state['items']}
   else:data={'keys':[]}
   r.fulfill(json=data)
  c.route('**/api/**',api)
  page.goto(BASE)
  expect(page.locator('.home-presence-map')).to_be_visible()
  expect(page.locator('.home-presence-map')).to_have_css('height','200px')
  selectors=['.home-hero','.role-choice > button:first-of-type','.role-choice > button:last-of-type','.home-presence']
  baseline=[page.locator(s).bounding_box()['y'] for s in selectors]
  header=page.locator('.topbar').bounding_box()
  assert baseline[0]>=header['y']+header['height']+40
  # Two entries exercise defensive rendering, not permission for two confirmed trips.
  for name,items in [('driver',[{'role':'DRIVER','ride':ride}]),('rider',[{'role':'RIDER','ride':rider}]),('multiple',[{'role':'DRIVER','ride':ride},{'role':'RIDER','ride':rider}]),('none',[])]:
   state['items']=items
   page.evaluate("items=>window.dispatchEvent(new CustomEvent('cocowheels:current-updated',{detail:items}))",items)
   expect(page.locator('.home-current-ride')).to_have_count(len(items))
   current=[page.locator(s).bounding_box()['y'] for s in selectors]
   assert all(abs(a-b)<1 for a,b in zip(current,baseline)),(name,baseline,current)
   map_box=page.locator('.home-presence').bounding_box()
   for card in page.locator('.home-current-ride').all():
    box=card.bounding_box();assert box['y']>=map_box['y']+map_box['height']
   assert page.locator('.role-choice .home-current-ride').count()==0
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if name in ['driver','multiple','none']:
    page.screenshot(path=f'/tmp/home-activity-{name}-{width}.png',full_page=True)
  state['feed']=False;state['items']=[{'role':'DRIVER','ride':ride}]
  page.reload();expect(page.locator('.home-current-ride')).to_have_count(1)
  expect(page.locator('.home-presence')).to_have_count(0)
  assert not errors,errors
  print('PASS',width,height,'200px map; stable hero/actions/map across driver/rider/multiple/none; empty map hidden; no writes/errors/overflow',flush=True)
  c.close()
 b.close()
