import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import Database from "better-sqlite3";
import sharp from "sharp";
import { createGuestSession, initializeCoreSchema } from "../server/core";
import { createApiServer } from "../server/index";
import { AVATAR_DELAY_MS, AVATAR_LEASE_MS, AVATAR_PHOTO_TTL, avatarJobSummary, claimAvatarPhoto, completeAvatarPhoto, enqueueAvatarPhoto, expireAvatarJobs, prepareQueuedAvatarPhoto, reviewAvatarEvent } from "../server/avatar-jobs";
import { runAvatarGeneration as generateAvatar, type AvatarProvider } from "../server/avatar-generation";
import { actOnAdminAvatar } from "../server/avatar-admin";
import { deliverAvatarReminder } from "../server/avatar-email";
import { readMapAvatar } from "../server/map-avatars";

// Fake image processing keeps provider/lifecycle tests independent of local model files.
const background = { check: async () => {}, remove: async (image: Buffer) => image };
const runAvatarGeneration = (db: Database.Database, api: AvatarProvider, now: number) => generateAvatar(db, api, now, background);

process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.COCOWHEELS_AVATAR_UPLOADS = "1";
process.env.COCOWHEELS_AVATAR_WORKER_KEY = "synthetic-test-worker-key-".repeat(3);
const start = Date.parse("2026-11-16T00:00:00Z");
function fixture() {
  const db = new Database(":memory:"); db.pragma("foreign_keys=ON"); initializeCoreSchema(db);
  function account(name: string) {
    const session = createGuestSession(db).session, token = `synthetic-${name}`;
    db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(name, session.id, new Date(start).toISOString());
    db.prepare("INSERT INTO university_sessions VALUES (?,?,?,?)").run(createHash("sha256").update(token).digest("hex"), name, session.id, "2099-01-01T00:00:00Z");
    return { id: session.id, token };
  }
  return { db, owner: account("owner@example.com"), other: account("other@example.com"), admin: account("jmos0905") };
}
async function image() { return sharp({ create: { width: 400, height: 800, channels: 3, background: "#999999" } }).jpeg().toBuffer(); }
async function render() { return sharp({ create: { width: 128, height: 256, channels: 4, background: { r: 20, g: 30, b: 50, alpha: 0.5 } } }).png().toBuffer(); }
function approved(db: Database.Database, principal: string, photo: Buffer, now = start) {
  enqueueAvatarPhoto(db, principal, photo, randomUUID(), true, now);
  const claimed = claimAvatarPhoto(db, now)!;
  completeAvatarPhoto(db, claimed.id, claimed.lease, "approved", null, now + 1);
  const admin = db.prepare("SELECT principal_id FROM university_accounts WHERE unikey='jmos0905'").get() as { principal_id: string };
  actOnAdminAvatar(db, claimed.id, "approve", admin.principal_id, now + 1);
  return claimed.id;
}

test("rejected checks do not consume the three-pass allowance; one pending submission still applies", async () => {
  const { db, owner } = fixture(), photo = await image();
  try {
    for (let i = 0; i < 4; i++) {
      const at = start + i * 1000;
      enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, at);
      const claim = claimAvatarPhoto(db, at)!;
      completeAvatarPhoto(db, claim.id, claim.lease, "rejected", "FEET", at + 1);
    }
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM avatar_jobs WHERE status='REJECTED'").get() as { n: number }).n, 4);
    assert.equal(enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, start + 5000).job!.status, "QUEUED");
    assert.throws(() => enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, start + 5001), /AVATAR_ALREADY_QUEUED/);
  } finally { db.close(); }
});

test("three completed passes count from check time, survive review/cancellation and free a slot at the exact rolling boundary", async () => {
  const { db, owner, other, admin } = fixture(), photo = await image(), submissions: string[] = [];
  const firstPass = start + 23 * 3600_000;
  try {
    for (let i = 0; i < 3; i++) {
      const submission = randomUUID(); submissions.push(submission);
      enqueueAvatarPhoto(db, owner.id, photo, submission, true, start + i * 1000);
      const claim = claimAvatarPhoto(db, firstPass + i * 1000)!;
      completeAvatarPhoto(db, claim.id, claim.lease, "approved", null, firstPass + i * 1000 + 1);
      const result = avatarJobSummary(db, owner.id)!;
      reviewAvatarEvent(db, owner.id, result.notificationKey, firstPass + i * 1000 + 2);
      actOnAdminAvatar(db, claim.id, "cancel", admin.id, firstPass + i * 1000 + 3);
    }
    // Upload dates are already a day old, but their checks passed recently.
    assert.throws(() => enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, start + 86400_000 + 10_000), /AVATAR_UPLOAD_LIMIT/);
    assert.doesNotThrow(() => enqueueAvatarPhoto(db, owner.id, photo, submissions[2], true, firstPass + 4000), "Retrying the existing submission is idempotent");
    assert.equal(enqueueAvatarPhoto(db, other.id, photo, randomUUID(), true, firstPass + 4000).job!.status, "QUEUED");
    assert.throws(() => enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, firstPass + 86400_000), /AVATAR_UPLOAD_LIMIT/);
    assert.equal(enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, firstPass + 86400_000 + 1).job!.status, "QUEUED");
  } finally { db.close(); }
});

test("manual quality rejection releases a Mac pass; cancellation before a check consumes no allowance", async () => {
  const { db, owner, admin } = fixture(), photo = await image();
  try {
    for (let i = 0; i < 3; i++) {
      const at = start + i * 1000;
      enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, at);
      const claim = claimAvatarPhoto(db, at)!;
      completeAvatarPhoto(db, claim.id, claim.lease, "approved", null, at + 1);
      actOnAdminAvatar(db, claim.id, "reject", admin.id, at + 2, "Show both hands.");
    }
    for (let i = 0; i < 4; i++) {
      const at = start + 5000 + i * 1000;
      const id = enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, at).job!.id;
      actOnAdminAvatar(db, id, "cancel", admin.id, at + 1);
    }
    assert.equal(enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, start + 10_000).job!.status, "QUEUED");
  } finally { db.close(); }
});

test("full-body normalization strips metadata without square cropping; rejects invalid/animated/undersized images", async () => {
  const raw = await image();
  const normalized = await prepareQueuedAvatarPhoto(`data:image/jpeg;base64,${raw.toString("base64")}`);
  const info = await sharp(normalized).metadata();
  assert.equal(info.width, 400); assert.equal(info.height, 800); assert.equal(info.exif, undefined);
  for (const value of [null, "https://example.com/photo.jpg", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/jpeg;base64,bm90IGFuIGltYWdl"])
    await assert.rejects(prepareQueuedAvatarPhoto(value), /INVALID_AVATAR_PHOTO/);
  const small = await sharp(raw).resize(128, 256).png().toBuffer();
  await assert.rejects(prepareQueuedAvatarPhoto(`data:image/png;base64,${small.toString("base64")}`), /INVALID_AVATAR_PHOTO/);
});

test("queue is idempotent, private, consented, persistent and limited to one active job; admin cancellation invalidates leases", async () => {
  const { db, owner, other, admin } = fixture(), photo = await image(), submission = randomUUID();
  try {
    assert.throws(() => enqueueAvatarPhoto(db, owner.id, photo, submission, false, start), /INVALID_AVATAR_SUBMISSION/);
    const first = enqueueAvatarPhoto(db, owner.id, photo, submission, true, start);
    assert.equal(enqueueAvatarPhoto(db, owner.id, photo, submission, true, start).job?.id, first.job?.id);
    assert.throws(() => enqueueAvatarPhoto(db, owner.id, Buffer.from("changed"), submission, true, start), /AVATAR_SUBMISSION_CHANGED/);
    assert.throws(() => enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, start), /AVATAR_ALREADY_QUEUED/);
    assert.equal(avatarJobSummary(db, other.id), null);
    assert.ok(!JSON.stringify(first).includes("photo_hash")); assert.ok(!JSON.stringify(first).includes("principal"));
    initializeCoreSchema(db); assert.equal(avatarJobSummary(db, owner.id)?.status, "QUEUED");
    const claimed = claimAvatarPhoto(db, start)!;
    assert.equal(claimAvatarPhoto(db, start), null);
    assert.throws(() => actOnAdminAvatar(db, claimed.id, "cancel", other.id, start), /ADMIN_ACCESS_DENIED/);
    assert.throws(() => completeAvatarPhoto(db, claimed.id, "invalid", "approved", null, start), /AVATAR_LEASE_EXPIRED/);
    actOnAdminAvatar(db, claimed.id, "cancel", admin.id, start + 1);
    assert.ok(avatarJobSummary(db, owner.id)?.notificationKey, "Admin cancellation notifies the submitter");
    assert.throws(() => completeAvatarPhoto(db, claimed.id, claimed.lease, "approved", null, start + 2), /AVATAR_LEASE_EXPIRED/);
    assert.equal((db.prepare("SELECT photo FROM avatar_jobs").get() as { photo: null }).photo, null);
  } finally { db.close(); }
});

test("offline Mac leases retry three times and stale/replayed results cannot approve; photo TTL removes bytes", async () => {
  const { db, owner, admin } = fixture(), photo = await image();
  try {
    enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, start);
    const first = claimAvatarPhoto(db, start)!;
    const second = claimAvatarPhoto(db, start + AVATAR_LEASE_MS + 1)!;
    assert.notEqual(first.lease, second.lease);
    assert.throws(() => completeAvatarPhoto(db, first.id, first.lease, "approved", null, start + AVATAR_LEASE_MS + 2), /AVATAR_LEASE_EXPIRED/);
    const third = claimAvatarPhoto(db, start + 2 * AVATAR_LEASE_MS + 2)!;
    assert.ok(third);
    expireAvatarJobs(db, start + 3 * AVATAR_LEASE_MS + 3);
    assert.equal(avatarJobSummary(db, owner.id)?.status, "QUEUED");
    assert.equal((db.prepare("SELECT hold_reason FROM avatar_jobs").get() as { hold_reason: string }).hold_reason, "CHECK_UNAVAILABLE");
    assert.equal(claimAvatarPhoto(db, start + 3 * AVATAR_LEASE_MS + 4), null);
    actOnAdminAvatar(db, first.id, "cancel", admin.id, start + 3 * AVATAR_LEASE_MS + 5);
    enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, start + 4 * AVATAR_LEASE_MS);
    expireAvatarJobs(db, start + AVATAR_PHOTO_TTL + 4 * AVATAR_LEASE_MS + 1);
    assert.equal(avatarJobSummary(db, owner.id)?.status, "EXPIRED");
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM avatar_jobs WHERE photo IS NOT NULL").get() as { n: number }).n, 0);
  } finally { db.close(); }
});

test("rejection supplies only a supported reason and never calls generation; reminders wait five minutes and respect reviews", async () => {
  const { db, owner } = fixture(), photo = await image(), emails: unknown[] = [];
  try {
    enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, start);
    const claim = claimAvatarPhoto(db, start)!;
    assert.throws(() => completeAvatarPhoto(db, claim.id, claim.lease, "rejected", "invented", start), /INVALID_AVATAR_VERDICT/);
    completeAvatarPhoto(db, claim.id, claim.lease, "rejected", "FEET", start);
    let calls = 0;
    await runAvatarGeneration(db, { request: async () => { calls++; return {}; }, image: async () => Buffer.alloc(0) }, start);
    assert.equal(calls, 0);
    const send = async (email: unknown) => { emails.push(email); };
    await deliverAvatarReminder(db, send, start + AVATAR_DELAY_MS - 1); assert.equal(emails.length, 0);
    const notification = avatarJobSummary(db, owner.id)!.notificationKey!;
    reviewAvatarEvent(db, owner.id, notification, start + 1000);
    await deliverAvatarReminder(db, send, start + AVATAR_DELAY_MS); assert.equal(emails.length, 0);
    approved(db, owner.id, photo, start + AVATAR_DELAY_MS + 1);
    await deliverAvatarReminder(db, send, start + 2 * AVATAR_DELAY_MS + 2); assert.equal(emails.length, 1);
    await deliverAvatarReminder(db, send, start + 3 * AVATAR_DELAY_MS); assert.equal(emails.length, 1);
    assert.ok(!JSON.stringify(emails).includes(photo.toString("base64")));
  } finally { db.close(); }
});

test("Seedream generation waits for funds, preserves task IDs on interruption, deduplicates submits and assigns only the approved result", async () => {
  const { db, owner } = fixture(), photo = await image(), output = await render();
  let balance = 4, submits = 0, uploads = 0;
  const api: AvatarProvider = { request: async (path, body) => {
    if (path === "/account/balance") return { balance };
    if (path === "/files") { uploads++; return { file_token: "file_test" }; }
    if (path === "/generation/image-to-image") {
      submits++; assert.equal((body as Record<string, unknown>).model, "seedream_v5");
      return { task_id: "test-task" };
    }
    return { status: "success", output: { generated_image_url: "https://tripo3d.ai/test.png" } };
  }, image: async () => output };
  try {
    const id = approved(db, owner.id, photo);
    await runAvatarGeneration(db, api, start + 2); assert.equal(submits, 0); assert.equal(uploads, 0);
    assert.equal(avatarJobSummary(db, owner.id)?.status, "APPROVED");
    balance = 200;
    await Promise.all([runAvatarGeneration(db, api, start + 60_003), runAvatarGeneration(db, api, start + 60_003)]);
    assert.equal(submits, 1); assert.equal(avatarJobSummary(db, owner.id)?.status, "GENERATING");
    initializeCoreSchema(db);
    await runAvatarGeneration(db, api, start + 80_004);
    assert.equal(avatarJobSummary(db, owner.id)?.status, "READY"); assert.equal(submits, 1);
    assert.equal(readMapAvatar(db, owner.id).available, true); assert.equal(readMapAvatar(db, owner.id).enabled, false);
    assert.ok((db.prepare("SELECT photo FROM avatar_jobs WHERE id=?").get(id) as { photo: Buffer }).photo);
    expireAvatarJobs(db, start + AVATAR_PHOTO_TTL + 1);
    assert.equal((db.prepare("SELECT photo FROM avatar_jobs WHERE id=?").get(id) as { photo: null }).photo, null);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM avatar_events WHERE reviewed_at IS NULL").get() as { n: number }).n, 1, "ready supersedes the approval reminder");
  } finally { db.close(); }
});

test("uncertain paid submissions require review and never resubmit automatically", async () => {
  const { db, owner } = fixture(), photo = await image(); let submits = 0;
  const api: AvatarProvider = { request: async path => {
    if (path === "/account/balance") return { balance: 1000 };
    if (path === "/files") return { file_token: "file_test" };
    submits++; throw new Error("response lost after acceptance");
  }, image: async () => Buffer.alloc(0) };
  try {
    approved(db, owner.id, photo);
    await runAvatarGeneration(db, api, start + 2);
    await runAvatarGeneration(db, api, start + 90_000);
    assert.equal(submits, 1); assert.equal(avatarJobSummary(db, owner.id)?.status, "APPROVED");
    assert.equal((db.prepare("SELECT status FROM avatar_jobs").get() as { status: string }).status, "REVIEW_REQUIRED");
  } finally { db.close(); }
});

test("HTTP routes enforce owner sessions and separate worker credentials, reject cross-origin and hide photos from users", async () => {
  const { db, owner, other, admin } = fixture(), photo = await image();
  const server = createApiServer(db); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`, headers = { Authorization: `Bearer ${owner.token}`, "Content-Type": "application/json" };
  try {
    assert.equal((await fetch(base + "/api/avatar/jobs")).status, 401);
    assert.equal((await fetch(base + "/api/avatar-worker/claim", { method: "POST", headers })).status, 403);
    assert.equal((await fetch(base + "/api/avatar/jobs", { headers: { ...headers, Origin: "https://attacker.invalid" } })).status, 403);
    const created = await fetch(base + "/api/avatar/jobs", { method: "POST", headers, body: JSON.stringify({ photo: `data:image/jpeg;base64,${photo.toString("base64")}`, submissionId: randomUUID(), consent: true, principal: other.id }) });
    assert.equal(created.status, 200); const result = await created.json();
    assert.equal(result.job.status, "QUEUED"); assert.equal(avatarJobSummary(db, other.id), null);
    assert.equal((await fetch(base + "/api/avatar/jobs/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
    assert.equal((await fetch(base + "/api/avatar/jobs/cancel", { method: "POST", headers: { ...headers, Authorization: `Bearer ${admin.token}` }, body: JSON.stringify({ id: result.job.id }) })).status, 403);
    // The submitter and old clients cannot cancel any phase or select another owner.
    for (const status of ["QUEUED", "CHECKING", "APPROVED", "SUBMITTING", "GENERATING", "REVIEW_REQUIRED", "FAILED", "READY"]) {
      db.prepare("UPDATE avatar_jobs SET status=? WHERE id=?").run(status, result.job.id);
      const denied = await fetch(base + "/api/avatar/jobs/cancel", { method: "POST", headers, body: JSON.stringify({ id: result.job.id, principal: other.id }) });
      assert.equal(denied.status, 403);
      assert.equal((await denied.json()).error, "AVATAR_CANCELLATION_ADMIN_ONLY");
      assert.equal((db.prepare("SELECT status FROM avatar_jobs WHERE id=?").get(result.job.id) as { status: string }).status, status);
      assert.ok((db.prepare("SELECT photo FROM avatar_jobs WHERE id=?").get(result.job.id) as { photo: Buffer }).photo);
    }
    db.prepare("UPDATE avatar_jobs SET status='QUEUED' WHERE id=?").run(result.job.id);
    db.prepare("UPDATE avatar_jobs SET created_at=? WHERE id=?").run(Date.now() - AVATAR_PHOTO_TTL - 1, result.job.id);
    assert.equal((await fetch(base + "/api/avatar/jobs/cancel", { method: "POST", headers, body: JSON.stringify({ id: result.job.id }) })).status, 403);
    assert.equal((db.prepare("SELECT status FROM avatar_jobs WHERE id=?").get(result.job.id) as { status: string }).status, "QUEUED", "denial must not trigger job expiry or erase source bytes");
    assert.ok((db.prepare("SELECT photo FROM avatar_jobs WHERE id=?").get(result.job.id) as { photo: Buffer }).photo);
    db.prepare("UPDATE avatar_jobs SET created_at=? WHERE id=?").run(start, result.job.id);
    const otherResult = await fetch(base + "/api/avatar/jobs", { headers: { Authorization: `Bearer ${other.token}` } });
    assert.equal((await otherResult.json()).job, null);
    const workerHeaders = { Authorization: `Bearer ${process.env.COCOWHEELS_AVATAR_WORKER_KEY}`, "Content-Type": "application/json" };
    const claim = (await (await fetch(base + "/api/avatar-worker/claim", { method: "POST", headers: workerHeaders, body: "{}" })).json()).job;
    assert.ok(claim.photo); assert.ok(claim.lease);
    const visible = await (await fetch(base + "/api/avatar/jobs", { headers })).json();
    assert.ok(!JSON.stringify(visible).includes(claim.photo)); assert.ok(!JSON.stringify(visible).includes(claim.lease));
    assert.equal((await fetch(base + "/api/avatar-worker/result", { method: "POST", headers: workerHeaders, body: JSON.stringify({ id: claim.id, lease: claim.lease, verdict: "rejected", reason: "FEET" }) })).status, 200);
    assert.equal((await fetch(base + "/api/avatar/jobs/cancel", { method: "POST", headers: { ...headers, Authorization: `Bearer ${other.token}` }, body: JSON.stringify({ id: claim.id }) })).status, 403);
  } finally { server.close(); server.closeAllConnections(); await once(server, "close"); db.close(); }
});
