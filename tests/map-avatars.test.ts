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
import { assignMapAvatar, avatarArtwork, avatarSprite, ownAvatarSprite, prepareAvatarRenditions, prepareAvatarSprite, readMapAvatar, saveMapAvatar } from "../server/map-avatars";
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


test("full-resolution private preview retains pixels while both public map variants remain bounded and revocable", async () => {
  const { db, owner, other } = fixture();
  const source = await sharp({ create: { width: 832, height: 1248, channels: 4, background: { r: 34, g: 56, b: 78, alpha: 0.8 } } }).png().toBuffer();
  const assets = await prepareAvatarRenditions(source);
  const assigned = assignMapAvatar(db, owner.session.id, assets.sprite, true, assets);
  const api = createApiServer(db); api.listen(0, "127.0.0.1"); await once(api, "listening");
  const address = api.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`, detailUrl = assigned.artworkUrl!.replace(".webp", ".detail.webp");
  try {
    const decoded = (bytes: Buffer) => sharp(bytes).ensureAlpha().raw().toBuffer();
    assert.deepEqual(await decoded(assets.preview), await decoded(source));
    assert.equal((await sharp(assets.preview).metadata()).height, 1248);
    assert.equal((await sharp(assets.detail).metadata()).height, 512);
    assert.equal((await sharp(assets.sprite).metadata()).height, 256);
    initializeCoreSchema(db);
    assert.deepEqual(ownAvatarSprite(db, owner.session.id), assets.preview);
    assert.equal(ownAvatarSprite(db, other.session.id), undefined);
    const publicDetail = await fetch(base + detailUrl);
    assert.equal(publicDetail.status, 200); assert.equal(publicDetail.headers.get("cache-control"), "no-store");
    assert.deepEqual(Buffer.from(await publicDetail.arrayBuffer()), assets.detail);
    const preview = await fetch(base + assigned.previewUrl, { headers: { Authorization: `Bearer ${owner.token}` } });
    assert.deepEqual(Buffer.from(await preview.arrayBuffer()), assets.preview);
    for (const suffix of [".preview.webp", ".detail.preview.webp", ".png"])
      assert.equal((await fetch(base + assigned.artworkUrl!.replace(".webp", suffix))).status, 404);
    saveMapAvatar(db, owner.session.id, false);
    assert.equal((await fetch(base + detailUrl)).status, 404);
    assert.deepEqual(ownAvatarSprite(db, owner.session.id), assets.preview);
    const old = assigned.artworkUrl!;
    assignMapAvatar(db, owner.session.id, assets.sprite, true, assets);
    assert.equal((await fetch(base + old)).status, 404);
    assert.equal((await fetch(base + detailUrl)).status, 404);
  } finally { api.close(); api.closeAllConnections(); await once(api, "close"); db.close(); }
});

test("operator recovery only upgrades the same assigned result, preserving preference/history/events and guarding races", async () => {
  const { restoreAvatarPreview } = await import("../server/avatar-preview-recovery");
  const { db, owner, other } = fixture();
  try {
    const assets = await prepareAvatarRenditions(await sharp({ create: { width: 400, height: 800, channels: 4, background: { r: 30, g: 50, b: 70, alpha: 0.8 } } }).png().toBuffer());
    assignMapAvatar(db, owner.session.id, assets.sprite, false);
    assignMapAvatar(db, other.session.id, assets.sprite, true);
    db.prepare(`INSERT INTO avatar_jobs(id,principal_id,submission_id,photo_hash,status,created_at,updated_at,next_at,render) VALUES (?,?,?,'fixture','READY',1,2,3,?)`).run("recovery-job", owner.session.id, "recovery-submit", assets.sprite);
    const before = db.prepare("SELECT * FROM avatar_jobs WHERE id='recovery-job'").get() as Record<string, unknown>;
    const accountBefore = db.prepare("SELECT * FROM account_map_avatars WHERE principal_id=?").get(owner.session.id) as Record<string, unknown>;
    const otherBefore = db.prepare("SELECT * FROM account_map_avatars WHERE principal_id=?").get(other.session.id);
    restoreAvatarPreview(db, "recovery-job", assets.sprite, assets);
    const after = db.prepare("SELECT * FROM avatar_jobs WHERE id='recovery-job'").get() as Record<string, unknown>;
    assert.deepEqual({ ...after, render: null }, { ...before, render: null });
    assert.equal((after.render as Buffer).equals(assets.preview), true);
    assert.equal(db.prepare("SELECT 1 FROM avatar_events").get(), undefined);
    assert.equal(db.prepare("SELECT 1 FROM avatar_admin_events").get(), undefined);
    const accountAfter = db.prepare("SELECT * FROM account_map_avatars WHERE principal_id=?").get(owner.session.id) as Record<string, unknown>;
    assert.equal(accountAfter.enabled, 0); assert.equal(accountAfter.assigned_at, accountBefore.assigned_at);
    assert.deepEqual(accountAfter.sprite, accountBefore.sprite); assert.notEqual(accountAfter.asset_id, accountBefore.asset_id);
    assert.deepEqual(db.prepare("SELECT * FROM account_map_avatars WHERE principal_id=?").get(other.session.id), otherBefore);
    assert.throws(() => restoreAvatarPreview(db, "recovery-job", assets.sprite, assets), /AVATAR_RECOVERY_CHANGED/);
  } finally { db.close(); }
});


test("nullable rendition migration retains legacy sprites, versions and display choices", async () => {
  const { db, owner } = fixture();
  try {
    const bytes = await sprite(), previous = assignMapAvatar(db, owner.session.id, bytes, true);
    db.exec("ALTER TABLE account_map_avatars DROP COLUMN preview; ALTER TABLE account_map_avatars DROP COLUMN detail");
    initializeCoreSchema(db); initializeCoreSchema(db);
    assert.deepEqual(readMapAvatar(db, owner.session.id), previous);
    assert.deepEqual(ownAvatarSprite(db, owner.session.id), bytes);
    const id = previous.artworkUrl!.split("/").pop()!.slice(0,-5);
    assert.deepEqual(avatarSprite(db, id, true), bytes);
  } finally { db.close(); }
});

test("all account types use full-resolution previews; legacy local-render recovery keeps user choices and refuses replacements", async () => {
  const { restoreAssignedAvatarPreview }=await import('../server/avatar-preview-recovery');
  const { db,owner,other }=fixture();
  try {
    const assets=await prepareAvatarRenditions(await sharp({create:{width:768,height:1344,channels:4,background:{r:25,g:45,b:65,alpha:.8}}}).png().toBuffer());
    for(const [account,enabled] of [[owner,true],[other,false]] as const) {
      assignMapAvatar(db,account.session.id,assets.sprite,enabled);
      const before=db.prepare('SELECT * FROM account_map_avatars WHERE principal_id=?').get(account.session.id) as Record<string,unknown>;
      restoreAssignedAvatarPreview(db,account.session.id,assets.sprite,assets);
      const after=db.prepare('SELECT * FROM account_map_avatars WHERE principal_id=?').get(account.session.id) as Record<string,unknown>;
      assert.equal(after.assigned_at,before.assigned_at);assert.equal(after.enabled,before.enabled);assert.deepEqual(after.sprite,before.sprite);
      assert.deepEqual(ownAvatarSprite(db,account.session.id),assets.preview);
      assert.equal((await sharp(ownAvatarSprite(db,account.session.id)!).metadata()).height,1344);
      assert.throws(()=>restoreAssignedAvatarPreview(db,account.session.id,assets.sprite,assets),/AVATAR_RECOVERY_CHANGED/);
    }
    assert.equal((db.prepare('SELECT count(*) AS n FROM avatar_jobs').get() as {n:number}).n,0);
    assert.equal((db.prepare('SELECT count(*) AS n FROM avatar_events').get() as {n:number}).n,0);
  } finally {db.close();}
});
