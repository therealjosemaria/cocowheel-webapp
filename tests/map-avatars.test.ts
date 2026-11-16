import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import Database from "better-sqlite3";
import sharp from "sharp";
import { createGuestSession, initializeCoreSchema, findSession, publishRide, requestRide, getRide } from "../server/core";
import { postDemand, searchDemands } from "../server/rider-demands";
import { createApiServer } from "../server/index";
import { acceptWithVehicle } from "../server/vehicle-acceptance";
import { homePresence } from "../server/home-presence";
import { assignMapAvatar, avatarArtwork, avatarSprite, prepareAvatarSprite, readMapAvatar, saveMapAvatar } from "../server/map-avatars";
import { isMapAvatarPath } from "../lib/map-avatar";
import { readPresenceCells } from "../lib/home-presence";

process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const origin = { latitude: -33.89, longitude: 151.18, label: "Private origin" };
const destination = { latitude: -33.88, longitude: 151.21, label: "Private destination" };
function fixture() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON"); initializeCoreSchema(db);
  function account(name: string) {
    const guest = createGuestSession(db), token = `test-${name}`;
    db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(name, guest.session.id, new Date().toISOString());
    db.prepare("INSERT INTO university_sessions VALUES (?,?,?,?)").run(createHash("sha256").update(token).digest("hex"), name, guest.session.id, "2099-01-01T00:00:00Z");
    return { token, session: findSession(db, token)! };
  }
  return { db, owner: account("owner01"), other: account("other01"), driver: account("driver01") };
}
async function sprite() {
  return prepareAvatarSprite(await sharp({ create: { width: 64, height: 128, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 0.8 } } }).png().toBuffer());
}

test("approved renders become contained metadata-free alpha sprites; invalid inputs fail", async () => {
  const bytes = await sprite(), metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 128); assert.equal(metadata.height, 256);
  assert.equal(metadata.format, "webp"); assert.equal(metadata.hasAlpha, true);
  assert.equal(metadata.exif, undefined); assert.ok(bytes.length < 100_000);
  await assert.rejects(prepareAvatarSprite(Buffer.from("not an image")));
  await assert.rejects(prepareAvatarSprite(Buffer.alloc(10_000_001)), /INVALID_AVATAR_IMAGE/);
  const opaque = await sharp({ create: { width: 32, height: 32, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(prepareAvatarSprite(opaque), /INVALID_AVATAR_IMAGE/);
});

test("assignments default off, stay account-owned, replace versions and preserve preferences across schema init", async () => {
  const { db, owner, other } = fixture();
  try {
    assert.deepEqual(readMapAvatar(db, owner.session.id), { available: false, enabled: false, previewUrl: null, artworkUrl: null });
    assert.throws(() => saveMapAvatar(db, owner.session.id, true), /AVATAR_UNAVAILABLE/);
    for (const enabled of [null, "true", 1, undefined]) assert.throws(() => saveMapAvatar(db, owner.session.id, enabled), /INVALID_AVATAR_PREFERENCE/);
    const image = await sprite();
    const first = assignMapAvatar(db, owner.session.id, image);
    assert.equal(first.enabled, false); assert.ok(first.previewUrl); assert.equal(first.artworkUrl, null);
    const enabled = saveMapAvatar(db, owner.session.id, true);
    assert.ok(isMapAvatarPath(enabled.artworkUrl));
    assert.equal(avatarArtwork(db, other.session.id), undefined);
    const oldId = enabled.artworkUrl!.split("/").pop()!.slice(0, -5);
    assert.deepEqual(avatarSprite(db, oldId), image);
    initializeCoreSchema(db);
    assert.deepEqual(readMapAvatar(db, owner.session.id), enabled);
    const replacement = assignMapAvatar(db, owner.session.id, image, true);
    assert.notEqual(replacement.artworkUrl, enabled.artworkUrl);
    assert.equal(avatarSprite(db, oldId), undefined);
    saveMapAvatar(db, owner.session.id, false);
    assert.equal(avatarArtwork(db, owner.session.id), undefined);
    assert.equal(avatarSprite(db, replacement.artworkUrl!.split("/").pop()!.slice(0, -5)), undefined);
    assert.throws(() => assignMapAvatar(db, "unknown-principal", image), /AVATAR_ACCOUNT_NOT_FOUND/);
  } finally { db.close(); }
});

test("requests, participant maps and coarse Home use enabled renders without changing trips or exposing account details", async () => {
  const { db, owner, other, driver } = fixture();
  try {
    const enabled = assignMapAvatar(db, owner.session.id, await sprite(), true);
    const posted = postDemand(db, owner.token, { origin, destination, date: "any", time: "" });
    assert.equal(searchDemands(db, driver.token, { date: "any", time: "" }).find(r => r.id === posted.id)?.avatarArtwork, enabled.artworkUrl);
    const before = db.serialize();
    const cells = homePresence(db);
    assert.equal(cells[0].artworks?.[0], enabled.artworkUrl);
    assert.deepEqual(readPresenceCells({ cells }), cells);
    for (const privateValue of [owner.session.id, posted.id, "owner01", "Private origin", "Private destination"])
      assert.ok(!JSON.stringify(cells).includes(privateValue));
    assert.notEqual(cells[0].latitude, origin.latitude);
    assert.deepEqual(db.serialize(), before, "Home reads do not mutate journeys");
    const ride = publishRide(db, driver.token, { origin, destination, priceAud: 0, scheduledDepartureAt: new Date(Date.now()+3600000).toISOString() }).ride;
    requestRide(db, owner.token, ride.rideId, { pickup: origin, destination, requestedDepartureAt: ride.scheduledDepartureAt });
    assert.equal(getRide(db, ride.rideId, owner.session).request?.avatarArtwork, enabled.artworkUrl);
    assert.equal(getRide(db, ride.rideId, driver.session).requests?.[0].avatarArtwork, enabled.artworkUrl);
    assert.throws(() => getRide(db, ride.rideId, other.session), /RIDE_ACCESS_DENIED/);
    const pending = getRide(db, ride.rideId, owner.session).request!;
    acceptWithVehicle(db, driver.token, ride.rideId, pending.requestId, "ABC123");
    assert.equal(getRide(db, ride.rideId, driver.session).rider?.avatarArtwork, enabled.artworkUrl);
    const rides = db.prepare("SELECT * FROM rides").all(), requests = db.prepare("SELECT * FROM ride_requests").all();
    saveMapAvatar(db, owner.session.id, false);
    assert.equal(getRide(db, ride.rideId, driver.session).requests?.[0].avatarArtwork, undefined);
    assert.equal(homePresence(db).find(cell => cell.role === "rider")?.artworks, undefined);
    assert.deepEqual(db.prepare("SELECT * FROM rides").all(), rides);
    assert.deepEqual(db.prepare("SELECT * FROM ride_requests").all(), requests);
  } finally { db.close(); }
});

test("private settings/preview enforce sessions; public sprites require opt-in and reject path/ownership injection", async () => {
  const { db, owner, other } = fixture();
  const assigned = assignMapAvatar(db, owner.session.id, await sprite(), true);
  const api = createApiServer(db); api.listen(0, "127.0.0.1"); await once(api, "listening");
  const address = api.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { Authorization: `Bearer ${owner.token}`, "Content-Type": "application/json" };
  try {
    for (const path of ["/api/avatar", "/api/avatar/preview"]) {
      assert.equal((await fetch(base+path)).status, 401);
      assert.equal((await fetch(base+path, { headers: { Authorization: "Bearer invalid" } })).status, 401);
    }
    const image = await fetch(base+assigned.artworkUrl);
    assert.equal(image.status, 200); assert.equal(image.headers.get("content-type"), "image/webp");
    assert.equal(image.headers.get("cache-control"), "no-store"); assert.equal(image.headers.get("set-cookie"), null);
    assert.equal(image.headers.get("x-content-type-options"), "nosniff");
    const ownPreview = await fetch(base+assigned.previewUrl, { headers });
    assert.equal(ownPreview.status, 200); assert.equal(ownPreview.headers.get("cache-control"), "private, no-store");
    assert.equal((await fetch(base+assigned.previewUrl+"&principal="+owner.session.id, { headers: { Authorization: `Bearer ${other.token}` } })).status, 404);
    const spoof = await fetch(base+"/api/avatar", { method: "POST", headers: { Authorization: `Bearer ${other.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ enabled: true, principal: owner.session.id, artworkUrl: assigned.artworkUrl }) });
    assert.equal(spoof.status, 409); assert.equal(readMapAvatar(db, owner.session.id).enabled, true);
    for (const path of ["/api/map-avatar/P2-20260801.png", "/api/map-avatar/invalid.webp", "/api/avatar/anything"]) {
      assert.equal((await fetch(base+path, { headers })).status, 404);
    }
    assert.equal((await fetch(base+"/api/avatar", { method: "POST", headers, body: JSON.stringify({ enabled: "false" }) })).status, 400);
    assert.equal((await fetch(base+"/api/avatar", { method: "POST", headers, body: JSON.stringify({ enabled: false }) })).status, 200);
    assert.equal((await fetch(base+assigned.artworkUrl)).status, 404);
    assert.equal((await fetch(base+assigned.previewUrl, { headers })).status, 200);
    for (const value of ["https://evil.test/a.webp", "/api/map-avatar/<img>.webp", "/api/map-avatar/"+"a".repeat(32)+".webp?evil=1"]) {
      assert.equal(isMapAvatarPath(value), false);
      assert.throws(() => readPresenceCells({ cells: [{ role: "rider", latitude: -33.875, longitude: 151.175, count: 1, artworks: [value] }] }));
    }
    assert.equal((await fetch(base+"/api/admin/tripo/P2-20260801.glb")).status, 403);
  } finally { api.close(); api.closeAllConnections(); await once(api, "close"); db.close(); }
});
