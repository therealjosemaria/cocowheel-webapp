"""Isolated built frontend/API only. Solid raster tiles expose compositor seams.
Requires serve-map-avatar-fixture.mts :3492 and built Next :3491.
"""
import asyncio, base64, json, struct, zlib
from pathlib import Path
from playwright.async_api import async_playwright, expect
BASE='http://127.0.0.1:3491'
OUT=Path('/tmp/gumwheel-map-tile-seams');OUT.mkdir(exist_ok=True)
def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
tile=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',256,256,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+bytes([172,209,222])*256)*256))+chunk(b'IEND',b'')
async def metric(page,surface,dpr):
 png=await surface.screenshot()
 return await page.evaluate('''async ({data,dpr})=>{
  const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const c=canvas.getContext('2d');c.drawImage(image,0,0);const p=c.getImageData(0,0,canvas.width,canvas.height).data;
  let peak=0;const left=Math.ceil(8*dpr),right=Math.floor(canvas.width-70*dpr);
  for(let y=Math.ceil(12*dpr);y<canvas.height-65*dpr;y++){
   let bright=0;for(let x=left;x<right;x++){const i=(y*canvas.width+x)*4;if(p[i]>195&&p[i+1]>225&&p[i+2]>233)bright++;}
   peak=Math.max(peak,bright/(right-left));
  }return Number(peak.toFixed(4));
 }''',{'data':base64.b64encode(png).decode(),'dpr':dpr})
async def main():
 report=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width,dpr in [(390,3),(1440,2),(390,1.25),(1440,1)]:
   context=await browser.new_context(viewport={'width':width,'height':950},device_scale_factor=dpr,has_touch=width<700,is_mobile=width<700,reduced_motion='reduce')
   async def network(route):
    url=route.request.url
    if '.tile.openstreetmap.org/' in url:await route.fulfill(body=tile,content_type='image/png')
    elif url.startswith(BASE) and route.request.method in ['GET','HEAD']:await route.continue_()
    else:await route.abort()
   await context.route('**/*',network);page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto(BASE);surface=page.locator('.home-presence-map');await expect(surface).to_be_visible();await surface.scroll_into_view_if_needed();await page.wait_for_timeout(600)
   async def flat():
    assert await surface.locator('img.leaflet-tile').count()>0
    assert await surface.locator('img.leaflet-tile').evaluate_all("els=>els.every(e=>e.complete&&e.naturalWidth===256&&e.style.transform.startsWith('translate(')&&e.style.width==='256px'&&e.style.height==='256px')")
   await flat();fixed=await metric(page,surface,dpr);assert fixed<.6,{'fixed':fixed,'width':width,'dpr':dpr}
   await surface.screenshot(path=str(OUT/f'fixed-{width}-{dpr}.png'))
   # Preserve the failing baseline by restoring the former 3D tile transforms.
   await surface.locator('img.leaflet-tile').evaluate_all("els=>els.forEach(e=>{e.dataset.flat=e.style.transform;const p=e._leaflet_pos;e.style.transform=`translate3d(${p.x}px,${p.y}px,0px)`})")
   await page.wait_for_timeout(100);legacy=await metric(page,surface,dpr)
   await surface.screenshot(path=str(OUT/f'legacy-{width}-{dpr}.png'))
   await surface.locator('img.leaflet-tile').evaluate_all("els=>els.forEach(e=>e.style.transform=e.dataset.flat)")
   for name in ['Zoom in','Zoom out']:
    await surface.get_by_role('button',name=name,exact=True).click();await page.wait_for_timeout(500);await flat()
   box=await surface.bounding_box();x=box['x']+box['width']*.4;y=box['y']+75
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+90,y+28,steps=6);await page.wait_for_timeout(120);await page.mouse.up();await page.wait_for_timeout(600);await flat()
   settled=await metric(page,surface,dpr);assert settled<.6
   assert await surface.locator('svg,path,canvas').count()==0
   assert await surface.locator('.leaflet-marker-icon').evaluate_all("els=>els.every(e=>e.style.transform.startsWith('translate3d('))")
   assert not errors,errors
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   report.append({'width':width,'dpr':dpr,'fixedPeakBrightRowFraction':fixed,'legacyPeakBrightRowFraction':legacy,'afterPanZoomPeakBrightRowFraction':settled,'tileDimensionsUnchanged':True,'markersKeep3DPositioning':True,'errors':errors})
   await context.close()
  await browser.close()
 assert any(r['legacyPeakBrightRowFraction']>.8 and r['fixedPeakBrightRowFraction']<.6 for r in report),'Must reproduce the old seam and demonstrate removal'
 (OUT/'result.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
asyncio.run(main())
