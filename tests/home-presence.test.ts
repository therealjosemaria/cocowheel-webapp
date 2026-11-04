import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import Database from 'better-sqlite3';
import { initializeCoreSchema, createGuestSession, publishRide } from '../server/core';
import { createApiServer } from '../server/index';
import { homePresence } from '../server/home-presence';
import { presenceCell, readPresenceCells } from '../lib/home-presence';

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
