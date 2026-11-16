import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import Database from 'better-sqlite3';
import { initializeCoreSchema, createGuestSession, publishRide } from '../server/core';
import { createApiServer } from '../server/index';
import { homePresence } from '../server/home-presence';
import { presenceCell, readPresenceCells } from '../lib/home-presence';
import { saveProfileVehicle } from '../server/vehicles';

process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const now = new Date();
const origin = { latitude: -33.91813, longitude: 151.20432, label: 'Private pickup' };
const destination = { latitude: -33.889, longitude: 151.187, label: 'Private destination' };
function fixture() {
  const db = new Database(':memory:');
  initializeCoreSchema(db);
  function driver(latitude = origin.latitude) {
    const guest = createGuestSession(db, now);
    const ride = publishRide(db, guest.token, { origin: { ...origin, latitude }, destination,
      scheduledDepartureAt: new Date(+now + 3600000).toISOString(), priceAud: 0 }, now).ride;
    return { ...guest, ride };
  }
  function request(id: string, status = 'OPEN', expires = new Date(+now + 3600000).toISOString(), latitude = origin.latitude) {
    const guest = createGuestSession(db, now);
    db.prepare('INSERT INTO rider_demands VALUES (?,?,?,?,?,?)').run(id, guest.session.id,
      JSON.stringify({ origin: { ...origin, latitude }, destination, date: 'any', time: '', alias: 'private-name' }), status, now.toISOString(), expires);
    return guest;
  }
  return { db, driver, request };
}

test('Home exposes selected artwork without vehicle records and updates from current Profile selections', () => {
  const { db, driver, request } = fixture();
  try {
    const owner = driver(); driver(); request('waiting');
    const vehicle = { plate:'PRIVATE1',make:'Ford',model:'Ranger',year:'2025',colour:'Blue',
      selection:{make:'Ford',model:'ford-ranger',year:'2025',colour:'Blue'} };
    saveProfileVehicle(db, owner.session.id, vehicle);
    const before = db.serialize();
    const cells = homePresence(db, now);
    const cars = cells.find(c => c.role === 'driver')!;
    assert.equal(cars.count, 2);
    assert.ok(cars.artworks?.includes('/brand/vehicles/v1/ford-ranger-blue.webp'));
    assert.ok(cars.artworks?.includes(null));
    assert.deepEqual(readPresenceCells({cells}), cells);
    for (const value of ['PRIVATE1',owner.session.id,owner.ride.rideId,'Private pickup','Private destination','selection','plate','make'])
      assert.equal(JSON.stringify(cells).includes(value), false, value);
    assert.deepEqual(db.serialize(), before);
    saveProfileVehicle(db, owner.session.id, {...vehicle, colour:'Red',selection:{...vehicle.selection,colour:'Red'}});
    assert.ok(homePresence(db, now).find(c => c.role === 'driver')!.artworks?.includes('/brand/vehicles/v1/ford-ranger-red.webp'));
    saveProfileVehicle(db, owner.session.id, {plate:'PRIVATE1'});
    assert.equal(homePresence(db, now).find(c => c.role === 'driver')!.artworks, undefined);
    for (const artworks of [['https://evil.invalid/car.webp',null], ['<img>',null], [null], [null,null,null,null]])
      assert.throws(() => readPresenceCells({cells:[{...cars,artworks}]}), /INVALID_PRESENCE/);
    assert.throws(() => readPresenceCells({cells:[{...presenceCell('rider', origin.latitude,origin.longitude), artworks:['/brand/vehicles/v1/ford-ranger-blue.webp']}]}));
  } finally { db.close(); }
});

test('Home projects only stable role/area cells with bounded multiple icons and leaves database unchanged', () => {
  const { db, driver, request } = fixture();
  try {
    driver(); driver(origin.latitude + 0.0001); request('open'); request('same-area');
    const before = db.serialize();
    const cells = homePresence(db, now);
    assert.deepEqual(cells, [{ ...presenceCell('driver', origin.latitude, origin.longitude), count: 2 }, presenceCell('rider', origin.latitude, origin.longitude)]);
    for (const cell of cells) {
      assert.deepEqual(Object.keys(cell).sort(), ['count', 'latitude', 'longitude', 'role']);
      assert.notEqual(cell.latitude, origin.latitude);
      assert.notEqual(cell.longitude, origin.longitude);
    }
    assert.deepEqual(homePresence(db, now), cells);
    assert.deepEqual(db.serialize(), before);
    assert.deepEqual(readPresenceCells({ cells }), cells);
  } finally { db.close(); }
});

test('Home excludes expired, closed, sample and accepted driver posts and closed rider requests', () => {
  const { db, driver, request } = fixture();
  try {
    const past = new Date(+now - 1).toISOString();
    for (const status of ['ACCEPTED', 'RIDE_ACTIVE', 'CO_RIDE_ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED']) {
      const item = driver();
      db.prepare('UPDATE rides SET status=? WHERE public_id=?').run(status, item.ride.rideId);
    }
    const expired = driver(); db.prepare('UPDATE rides SET offer_expires_at=? WHERE public_id=?').run(past, expired.ride.rideId);
    const sample = driver(); db.prepare('UPDATE rides SET is_sample=1 WHERE public_id=?').run(sample.ride.rideId);
    request('expired', 'OPEN', past);
    for (const status of ['CANCELLED', 'FULFILLED', 'EXPIRED']) request(status, status);
    assert.deepEqual(homePresence(db, now), []);
    const pending = driver(); db.prepare("UPDATE rides SET status='REQUESTED' WHERE public_id=?").run(pending.ride.rideId);
    assert.equal(homePresence(db, now).length, 1);
  } finally { db.close(); }
});

test('Home does not disclose demand from an owner already acting as a driver', () => {
  const { db, driver } = fixture();
  try {
    const owner = driver();
    db.prepare("INSERT INTO rider_demands VALUES ('busy',?,?,'OPEN',?,?)").run(owner.session.id,
      JSON.stringify({ origin, destination }), now.toISOString(), new Date(+now + 3600000).toISOString());
    assert.deepEqual(homePresence(db, now).map(c => c.role), ['driver']);
  } finally { db.close(); }
});

test('Home bounds payload per role and rejects malformed/non-area browser responses', () => {
  const { db, driver, request } = fixture();
  try {
    for (let i = 0; i < 102; i++) driver(-40 + i * 0.1);
    assert.equal(homePresence(db, now).length, 100);
    for (let i = 0; i < 102; i++) request('rider-'+i, 'OPEN', new Date(+now + 3600000).toISOString(), -20 + i * 0.1);
    assert.equal(homePresence(db, now).reduce((total, cell) => total + cell.count, 0), 120);
    assert.equal(presenceCell('rider', NaN, 151), null);
    assert.equal(presenceCell('driver', 0, 181), null);
    assert.throws(() => readPresenceCells({ cells: [origin] }));
    assert.throws(() => readPresenceCells({ cells: [{ ...origin, role: 'driver' }] }));
    assert.throws(() => readPresenceCells({ cells: Array(201).fill(presenceCell('rider', 0, 0)) }));
  } finally { db.close(); }
});

test('anonymous Home is allowed but both discovery roles and driver preview require verified sign-in', async () => {
  const { db, driver, request } = fixture();
  const item = driver(); request('open');
  const verified = createGuestSession(db);
  const token = 'synthetic-verified-token';
  db.prepare('INSERT INTO university_accounts VALUES (?,?,?)').run('testuser', verified.session.id, now.toISOString());
  db.prepare('INSERT INTO university_sessions VALUES (?,?,?,?)').run(createHash('sha256').update(token).digest('hex'), 'testuser', verified.session.id, '2099-01-01T00:00:00Z');
  const api = createApiServer(db);
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  const address = api.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetch(base + '/api/home-presence');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
    const payload = await response.json();
    assert.equal(payload.cells.length, 2);
    assert.doesNotMatch(JSON.stringify(payload), /private|alias|rideId|destination|schedule|label|photo|payId/i);
    const snapshot=db.serialize();
    const overview=await fetch(base+'/api/home-presence?overview=1');
    assert.equal(overview.status,200); assert.ok((await overview.json()).bounds);
    const area=await fetch(base+'/api/home-presence?south=-34&north=-33.8&west=151.1&east=151.3&zoom=12');
    assert.equal(area.status,200); assert.equal((await area.json()).cells.length,2);
    assert.equal((await fetch(base+'/api/home-presence?south=broken')).status,400);
    assert.deepEqual(db.serialize(),snapshot);
    const endpoints = [
      ['/api/availability', 'GET', undefined],
      [`/api/rides/${item.ride.rideId}/preview`, 'GET', undefined],
      ['/api/search', 'POST', { pickup: origin, destination, requestedDepartureAt: now.toISOString() }],
      ['/api/rider-demands/search', 'POST', { date: 'any', time: '' }],
    ] as const;
    for (const [path, method, body] of endpoints) {
      for (const credential of [null, item.token, 'invalid']) {
        const denied = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
          body: body ? JSON.stringify(body) : undefined });
        assert.equal(denied.status, 401, path);
        assert.deepEqual(await denied.json(), { error: 'UNIVERSITY_VERIFICATION_REQUIRED' });
      }
      const allowed = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
      assert.equal(allowed.status, 200, path);
      assert.equal(allowed.headers.get('cache-control'), 'no-store');
    }
  } finally { api.close(); api.closeAllConnections(); await once(api, 'close'); db.close(); }
});

test('viewport filtering happens before global caps and exposes both local roles without writes', async () => {
  const { presenceViewport, inPresenceBounds } = await import('../lib/home-presence');
  const { homePresenceResponse } = await import('../server/home-presence');
  const { db, driver, request } = fixture();
  try {
    for (let i=0;i<150;i++) { driver(-55+i*.1); request("outside-"+i,"OPEN",new Date(+now+3600000).toISOString(),-55+i*.1); }
    const local=driver(-20.123); request('local-rider','OPEN',new Date(+now+3600000).toISOString(),-20.124);
    assert.equal(homePresence(db,now).some(c=>c.latitude>-21),false);
    const view=presenceViewport({south:-20.15,north:-20.1,west:151.15,east:151.25,zoom:12});
    const snapshot=db.serialize();
    const cells=homePresence(db,now,view);
    assert.deepEqual(new Set(cells.map(c=>c.role)),new Set(['driver','rider']));
    assert.ok(cells.every(c=>inPresenceBounds(c,view)));
    const overview=homePresenceResponse(db,new URLSearchParams('overview=1'),now);
    assert.equal(overview.hasPresence,true); assert.equal(overview.cells.length,0);
    assert.ok('bounds' in overview && overview.bounds!.north>=-20.1);
    const area=homePresenceResponse(db,new URLSearchParams({...Object.fromEntries(Object.entries(view).map(([k,v])=>[k,String(v)]))}),now);
    assert.deepEqual(area.cells,cells); assert.equal(area.hasPresence,true);
    const broad=homePresenceResponse(db,new URLSearchParams({...Object.fromEntries(Object.entries({...view,zoom:7}).map(([k,v])=>[k,String(v)]))}),now);
    assert.deepEqual(broad.cells,[]); assert.equal(broad.hasPresence,true);
    assert.deepEqual(db.serialize(),snapshot);
    assert.doesNotMatch(JSON.stringify({overview,area}), new RegExp(local.session.id));
  } finally { db.close(); }
});

test('viewport validation, canonical cells, empty areas and dateline coverage retain privacy', async () => {
  const { presenceViewport, readPresenceReply, presenceViewportQuery } = await import('../lib/home-presence');
  const { homePresenceResponse } = await import('../server/home-presence');
  const { db, driver, request }=fixture();
  try {
    driver(); request('rider');
    const empty=homePresenceResponse(db,new URLSearchParams('south=10&north=11&west=10&east=11&zoom=12'),now);
    assert.deepEqual(empty,{cells:[],hasPresence:true});
    const a=presenceViewport({south:-33.918,north:-33.912,west:151.201,east:151.209,zoom:15});
    const b=presenceViewport({south:-33.919,north:-33.911,west:151.202,east:151.208,zoom:15});
    assert.deepEqual(a,b);
    assert.deepEqual(homePresenceResponse(db,new URLSearchParams(presenceViewportQuery(a)),now),homePresenceResponse(db,new URLSearchParams(presenceViewportQuery(b)),now));
    const atEast=driver(0.01),atWest=driver(0.02);
    db.prepare('UPDATE rides SET origin_longitude=? WHERE public_id=?').run(179.99,atEast.ride.rideId);
    db.prepare('UPDATE rides SET origin_longitude=? WHERE public_id=?').run(-179.99,atWest.ride.rideId);
    const cells=homePresence(db,now,{south:0,north:.05,west:179.9,east:-179.9,zoom:12});
    assert.equal(cells.length,2); assert.deepEqual(new Set(cells.map(c=>c.longitude)),new Set([-179.975,179.975]));
    for (const query of ['south=0','south=0&north=1&west=0&east=1&zoom=Infinity','south=2&north=1&west=0&east=1&zoom=12','south=0&north=1&west=-181&east=1&zoom=12','south=0&north=1&west=0&east=1&zoom=12&zoom=13','overview=1&extra=1'])
      assert.throws(()=>homePresenceResponse(db,new URLSearchParams(query),now),/INVALID_PRESENCE_VIEWPORT/);
    assert.throws(()=>readPresenceReply({cells:[],hasPresence:'yes'}));
    assert.throws(()=>readPresenceReply({cells:[],hasPresence:true,bounds:{south:0,north:NaN,west:0,east:1}}));
  } finally { db.close(); }
});


test('public viewport snapping is idempotent at decimal cell boundaries and keeps wrapped world coverage', async () => {
  const {presenceViewport}=await import('../lib/home-presence');
  for (const south of [-33.95,-33.9,.15,.3,-89.95]) {
    const view=presenceViewport({south,north:south+.1,west:151.2,east:151.3,zoom:12});
    assert.deepEqual(presenceViewport(view),view);
  }
  assert.deepEqual(presenceViewport({south:-60,north:60,west:179.99,east:179.98,zoom:1}),{south:-60,north:60,west:-180,east:180,zoom:1});
  const narrow=presenceViewport({south:0,north:.05,west:179.9,east:-179.9,zoom:12});
  assert.equal(narrow.west,179.9);assert.equal(narrow.east,-179.9);
});
