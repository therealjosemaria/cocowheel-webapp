import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import Database from "better-sqlite3";
import sharp from "sharp";
import { createGuestSession, initializeCoreSchema } from "../server/core";
import { createApiServer } from "../server/index";
import { AVATAR_PHOTO_TTL, claimAvatarPhoto, completeAvatarPhoto, enqueueAvatarPhoto, expireAvatarJobs, initializeAvatarJobs } from "../server/avatar-jobs";
import { actOnAdminAvatar, adminAvatarJobs } from "../server/avatar-admin";
import { avatarHistory, avatarHistoryThumbnail, ownAvatarHistoryPhoto } from "../server/avatar-history";
import { adminAvatarVerification } from "../lib/admin-avatar";

process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.COCOWHEELS_AVATAR_UPLOADS = "1";
const now = Date.now();
async function fixture() {
  const db = new Database(":memory:"); db.pragma("foreign_keys=ON"); initializeCoreSchema(db);
  function account(name: string) {
    const session = createGuestSession(db).session, token = `synthetic-${name}`;
    db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(name, session.id, new Date(now).toISOString());
    db.prepare("INSERT INTO university_sessions VALUES (?,?,?,?)").run(createHash("sha256").update(token).digest("hex"), name, session.id, "2099-01-01T00:00:00Z");
    return { id: session.id, token };
  }
  const owner = account("owner@example.com"), other = account("other@example.com"), admin = account("jmos0905");
  const photo = await sharp({ create: { width: 400, height: 800, channels: 3, background: "#999999" } }).jpeg().toBuffer();
  function add(time = now) { return enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, time).job!.id; }
  return { db, owner, other, admin, photo, add };
}

test("photo check receipt and execution duration are separate, optional and preserved through review", async () => {
  const f = await fixture();
  try {
    const id = f.add(), claim = claimAvatarPhoto(f.db, now)!;
    assert.equal(adminAvatarJobs(f.db).jobs[0].checkedAt, null);
    for (const invalid of [-1, 60001, 1.5, NaN, "300", {}, Infinity]) {
      assert.throws(() => completeAvatarPhoto(f.db, id, claim.lease, "approved", null, now + 1000, invalid), /INVALID_AVATAR_VERDICT/);
      assert.equal(adminAvatarJobs(f.db).jobs[0].checkedAt, null);
    }
    assert.throws(() => completeAvatarPhoto(f.db, id, "wrong", "approved", null, now + 1000, 400), /AVATAR_LEASE_EXPIRED/);
    completeAvatarPhoto(f.db, id, claim.lease, "approved", null, now + 1000, 432);
    let row = adminAvatarJobs(f.db).jobs[0];
    assert.equal(row.checkedAt, new Date(now + 1000).toISOString());
    assert.equal(row.checkDurationMs, 432);
    assert.equal(row.createdAt, new Date(now).toISOString());
    assert.deepEqual(adminAvatarVerification(row), { icon: "accepted", label: "Photo check passed" });
    actOnAdminAvatar(f.db, id, "reject", f.admin.id, now + 1100, "Show both hands.");
    row = adminAvatarJobs(f.db).jobs[0];
    assert.deepEqual(adminAvatarVerification(row), { icon: "rejected", label: "Rejected on review" });
    assert.equal(row.checkDurationMs, 432); assert.equal(row.checkedAt, new Date(now + 1000).toISOString());
    const second = f.add(now + 1200), next = claimAvatarPhoto(f.db, now + 1200)!;
    completeAvatarPhoto(f.db, second, next.lease, "rejected", "FEET", now + 1500);
    row = adminAvatarJobs(f.db).jobs[0];
    assert.equal(row.checkDurationMs, null, "Old workers may omit duration");
    assert.equal(row.checkedAt, new Date(now + 1500).toISOString());
    assert.equal(adminAvatarVerification(row)?.label, "Photo check failed");
  } finally { f.db.close(); }
});

test("schema upgrade does not invent historical timings and retry is not a completed photo check", async () => {
  const f = await fixture();
  try {
    f.add(); f.db.exec("ALTER TABLE avatar_jobs DROP COLUMN checked_at; ALTER TABLE avatar_jobs DROP COLUMN check_duration_ms;");
    initializeAvatarJobs(f.db);
    assert.equal(adminAvatarJobs(f.db).jobs[0].checkedAt, null);
    assert.equal(adminAvatarJobs(f.db).jobs[0].checkDurationMs, null);
    const claim = claimAvatarPhoto(f.db, now)!;
    completeAvatarPhoto(f.db, claim.id, claim.lease, "retry", null, now + 100, null);
    assert.equal(adminAvatarJobs(f.db).jobs[0].checkedAt, null);
    for (const status of ["QUEUED", "CHECKING", "CANCELLED", "EXPIRED", "FAILED", "REVIEW_REQUIRED"] as const)
      assert.equal(adminAvatarVerification({ status, reason: null, approvedAt: null }), null);
    assert.equal(adminAvatarVerification({ status: "REVIEW_REQUIRED", reason: "BACKGROUND_REVIEW", approvedAt: null })?.label, "Photo check passed");
  } finally { f.db.close(); }
});

test("private history paginates newest-first, keeps retake reasons and honours both retention limits", async () => {
  const f = await fixture();
  try {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      // Spread uploads over days to respect the existing three-per-day limit.
      const at = now + i * 86400_000, id = f.add(at); ids.push(id);
      const claim = claimAvatarPhoto(f.db, at)!;
      completeAvatarPhoto(f.db, id, claim.lease, "rejected", "FEET", at + 1, 321);
    }
    const history = avatarHistory(f.db, f.owner.id, null, now + 3 * 86400_000);
    assert.equal(history.total, 4); assert.equal(history.pageSize, 3);
    assert.deepEqual(history.items.map(item => item.id), ids.slice(1).reverse());
    assert.equal(history.items[0].reason, "FEET");
    assert.ok(history.items.every(item => item.thumbnailUrl));
    assert.equal(avatarHistory(f.db, f.owner.id, "1").items[0].id, ids[0]);
    assert.equal(avatarHistory(f.db, f.owner.id, "-1").page, 0);
    assert.equal(avatarHistory(f.db, f.other.id, null).total, 0);
    assert.doesNotMatch(JSON.stringify(history), /duration|checkedAt|photo_hash|principal|lease|notificationKey|taskId|credits/i);
    assert.equal(ownAvatarHistoryPhoto(f.db, f.other.id, ids[0]), null);
    const thumbnail = await avatarHistoryThumbnail(f.photo), meta = await sharp(thumbnail).metadata();
    assert.equal(meta.format, "webp"); assert.ok(meta.width! <= 160 && meta.height! <= 240);
    assert.equal(meta.width! / meta.height!, 0.5); assert.equal(meta.exif, undefined);
    expireAvatarJobs(f.db, now + 11 * 86400_000);
    assert.ok(avatarHistory(f.db, f.owner.id, null, now + 11 * 86400_000).items.every(item => item.thumbnailUrl === null));
    assert.equal(ownAvatarHistoryPhoto(f.db, f.owner.id, ids[0], now + AVATAR_PHOTO_TTL), null);
    expireAvatarJobs(f.db, now + 34 * 86400_000);
    assert.equal(avatarHistory(f.db, f.owner.id, null).total, 0);
  } finally { f.db.close(); }
});

test("history HTTP is authenticated, owner-scoped and read-only; cancelled photos cannot be fetched", async () => {
  const f = await fixture(), id = f.add(), server = createApiServer(f.db);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const url = `/api/avatar/history/${id}/thumbnail`;
  const owner = { Cookie: `cocowheels_guest=${f.owner.token}` }, other = { Cookie: `cocowheels_guest=${f.other.token}` };
  try {
    for (const path of ["/api/avatar/history", url]) assert.equal((await fetch(base + path)).status, 401);
    const list = await fetch(base + `/api/avatar/history?principal=${f.owner.id}`, { headers: other });
    assert.equal((await list.json()).total, 0);
    assert.equal((await fetch(base + url, { headers: other })).status, 404);
    const response = await fetch(base + url, { headers: owner });
    assert.equal(response.status, 200); assert.match(response.headers.get("cache-control")!, /private, no-store/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format, "webp");
    const before = f.db.prepare("SELECT * FROM avatar_jobs").all();
    const blocked = await fetch(base + "/api/avatar/history", { method: "POST", headers: { ...owner, Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify({ status: "READY" }) });
    assert.equal(blocked.status, 404); assert.deepEqual(f.db.prepare("SELECT * FROM avatar_jobs").all(), before);
    actOnAdminAvatar(f.db, id, "cancel", f.admin.id);
    assert.equal((await fetch(base + url, { headers: owner })).status, 404);
    const cancelled = await (await fetch(base + "/api/avatar/history", { headers: owner })).json();
    assert.equal(cancelled.items[0].thumbnailUrl, null); assert.equal(cancelled.items[0].status, "CANCELLED");
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); f.db.close(); }
});
