import json
from playwright.sync_api import sync_playwright

MESSAGE='We can’t reach the server. Please try again shortly.'
origin={'latitude':-33.87,'longitude':151.21,'label':'Town Hall'}
destination={'latitude':-33.92,'longitude':151.25,'label':'Coogee'}
ride={'rideId':'test-ride','status':'ACCEPTED','driverAlias':'driver1234','priceAud':5,'scheduledDepartureAt':'2026-10-16T00:00:00Z','expiresAt':'2026-10-17T00:00:00Z','plannedRoute':{'origin':origin,'destination':destination},'requests':[], 'paymentMethod':'PAYID','coRideCode':'1234'}
request={'requestId':'req','riderAlias':'rider1234','status':'ACCEPTED','pickup':origin,'destination':destination,'createdAt':'2026-10-16T00:00:00Z','requestedDepartureAt':'2026-10-16T00:00:00Z','directionFit':'GOOD'}
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width in [390,1440]:
  context=browser.new_context(viewport={'width':width,'height':900})
  page=context.new_page()
  state={'mode':'down','role':'RIDER','auth':False}
  errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  def respond(route):
   path=route.request.url.split('/api/')[-1]
   if state['mode']=='down':
    route.fulfill(status=502,content_type='text/html',body='<h1>Bad Gateway</h1>'); return
   if path=='university/code' and state['mode']=='email':
    route.fulfill(status=503,content_type='application/json',body=json.dumps({'error':'EMAIL_SEND_FAILED'})); return
   current=dict(ride)
   if state['role']=='RIDER': current['request']=request
   if path=='university/session': data={'unikey':'rider1234' if state['auth'] else None,'canAdmin':False}
   elif path=='current': data={'current':None,'currents':[]}
   elif path=='history': data={'driver':[],'rider':[]}
   elif path=='route-preview': data={'points':[origin,destination],'durationSeconds':600}
   elif path.startswith('rides/test-ride'): data={'ride':current,'serverNow':'2026-10-16T01:00:00Z'}
   elif path=='place-search': data={'places':[destination]}
   else: data={}
   route.fulfill(status=200,content_type='application/json',body=json.dumps(data))
  page.route('**/api/**',respond)
  page.route('**/*.tile.openstreetmap.org/**',lambda r:r.abort())
  for url in ['/', '/?start=driver','/?start=rider','/activity','/activity/test-ride','/rides/test-ride']:
   page.goto('http://127.0.0.1:3090'+url)
   page.locator('.connection-notice').wait_for()
   assert page.locator('.connection-notice').inner_text()==MESSAGE
   assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
  page.screenshot(path=f'/tmp/gumwheel-outage-first-{width}.png',full_page=True)
  # Recovery without a page reload; the shared read-only probe should clear notice.
  state['mode']='ok'
  page.evaluate('window.dispatchEvent(new Event("online"))')
  page.locator('.connection-notice').wait_for(state='detached')
  # Sign-in keeps provider errors distinct from network errors.
  page.goto('http://127.0.0.1:3090/help')
  page.evaluate('window.dispatchEvent(new Event("cocowheels:verify-university"))')
  page.get_by_role('textbox',name='UniKey',exact=True).fill('abcd1234')
  state['mode']='email'
  page.get_by_role('button',name='Send code',exact=True).click()
  page.get_by_text('We couldn’t send your code. Please try again shortly.',exact=True).wait_for()
  assert page.locator('.connection-notice').count()==0
  state['mode']='down'
  page.get_by_role('button',name='Send code',exact=True).click()
  assert page.locator('.university-dialog [role=alert]').inner_text()==MESSAGE
  page.screenshot(path=f'/tmp/gumwheel-outage-verify-{width}.png',full_page=True)
  page.get_by_role('button',name='Cancel',exact=True).click()
  # Explicit destination search failures retain a clear message.
  state['mode']='ok'
  page.goto('http://127.0.0.1:3090/?start=rider')
  page.get_by_role('textbox',name='Search destination',exact=True).fill('Coogee')
  state['mode']='down'
  page.get_by_role('button',name='Search',exact=True).click()
  page.locator('.place-search [role=alert]').wait_for()
  assert page.locator('.place-search [role=alert]').inner_text()==MESSAGE
  # Both participant roles retain the map/details during later polling failure.
  for role in ['RIDER','DRIVER']:
   state.update(mode='ok',role=role,auth=True)
   page.goto('http://127.0.0.1:3090/activity/test-ride')
   page.locator('.ride-selection-map').wait_for()
   state['mode']='down'
   page.evaluate('window.dispatchEvent(new Event("cocowheels:ride-updated"))')
   page.get_by_text('Showing previously loaded ride details.',exact=False).wait_for()
   assert page.locator('.ride-selection-map').is_visible()
   if role=='RIDER': page.get_by_role('button',name='NEW CODE',exact=True).click()
   else:
    page.get_by_role('textbox',name='Four-digit pickup code').fill('1234')
    page.get_by_role('button',name='CONFIRM PICKUP',exact=True).click()
   page.locator('.cancel-prompt p').wait_for()
   assert page.locator('.cancel-prompt p').inner_text()==MESSAGE
   page.get_by_role('button',name='OKAY',exact=True).click()
   page.screenshot(path=f'/tmp/gumwheel-outage-{role.lower()}-{width}.png',full_page=True)
   state['mode']='ok'
   page.evaluate('window.dispatchEvent(new Event("cocowheels:ride-updated"))')
   page.get_by_text('Showing previously loaded ride details.',exact=False).wait_for(state='detached')
  # Completion and cancellation do not report success or navigate after a lost response.
  ride.update(status='CO_RIDE_ACTIVE',pickupEstablished=True)
  state.update(mode='ok',role='RIDER')
  page.goto('http://127.0.0.1:3090/activity/test-ride')
  page.get_by_role('button',name='COMPLETE RIDE',exact=True).wait_for()
  state['mode']='down'
  page.get_by_role('button',name='COMPLETE RIDE',exact=True).click()
  page.locator('.cancel-prompt p').wait_for()
  assert page.locator('.cancel-prompt p').inner_text()==MESSAGE
  page.get_by_role('button',name='OKAY',exact=True).click()
  page.get_by_role('button',name='CANCEL RIDE',exact=True).click()
  page.locator('.cancel-prompt .danger').click()
  page.locator('.cancel-prompt p').wait_for()
  assert page.locator('.cancel-prompt p').inner_text()==MESSAGE
  assert page.url.endswith('/activity/test-ride')
  ride.update(status='ACCEPTED',pickupEstablished=False)
  # A failed driver acceptance keeps the pending request visible.
  ride['requests']=[dict(request,status='PENDING')]
  state.update(mode='ok',role='DRIVER')
  page.goto('http://127.0.0.1:3090/activity/test-ride')
  page.get_by_role('button',name='ACCEPT RIDER',exact=True).wait_for()
  state['mode']='down'
  page.get_by_role('button',name='ACCEPT RIDER',exact=True).click()
  page.locator('#request-decision-error-title').wait_for()
  assert page.locator('#request-decision-error-title').inner_text()==MESSAGE
  ride['requests']=[]
  assert not errors,errors
  print(f'PASS {width}: first-load outage six routes, recovery, verification provider/network distinction, destination search, driver/rider retained map + recovery, pickup/renew/complete/cancel/accept action errors, no runtime errors')
  context.close()
 browser.close()
