import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import Database from "better-sqlite3";
import sharp from "sharp";
import { createGuestSession, initializeCoreSchema } from "../server/core";
import { createApiServer } from "../server/index";
import { AVATAR_DELAY_MS, AVATAR_PHOTO_TTL, avatarJobSummary, claimAvatarPhoto, completeAvatarPhoto, enqueueAvatarPhoto, expireAvatarJobs } from "../server/avatar-jobs";
import { actOnAdminAvatar, adminAvatarAsset, adminAvatarJobs, adminAvatarNotices, reviewAdminAvatar } from "../server/avatar-admin";
import { deliverAdminAvatarReminder, deliverAvatarReminder } from "../server/avatar-email";
import { runAvatarGeneration, type AvatarProvider } from "../server/avatar-generation";
import { readMapAvatar } from "../server/map-avatars";

process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.COCOWHEELS_AVATAR_UPLOADS = "1";
process.env.COCOWHEELS_AVATAR_DAILY_CREDITS = "330";
const now = Date.now();
async function fixture() {
  const db = new Database(":memory:"); db.pragma("foreign_keys=ON"); initializeCoreSchema(db);
  function account(unikey: string) {
    const { session } = createGuestSession(db), token = `synthetic-${unikey}`;
    db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(unikey, session.id, new Date(now).toISOString());
    db.prepare("INSERT INTO university_sessions VALUES (?,?,?,?)").run(createHash("sha256").update(token).digest("hex"), unikey, session.id, "2099-01-01T00:00:00Z");
    return { id: session.id, token };
  }
  const owner = account("submitter@example.com"), other = account("other@example.com"), admin = account("jmos0905");
  const photo = await sharp({ create: { width: 400, height: 800, channels: 3, background: "#888888" } }).jpeg().toBuffer();
  const id = enqueueAvatarPhoto(db, owner.id, photo, randomUUID(), true, now).job!.id;
  const verify = () => { const claim = claimAvatarPhoto(db, now)!; completeAvatarPhoto(db, claim.id, claim.lease, "approved", null, now + 1); };
  let balance = 1000, submits = 0;
  const api: AvatarProvider = { request: async path => {
    if (path === "/account/balance") return { balance };
    if (path === "/files") return { file_token: "test-file" };
    if (path === "/generation/image-to-model") { submits++; return { task_id: "test-task" }; }
    return { status: "success", output: { rendered_image_url: "https://tripo3d.ai/test.png" } };
  }, image: async () => sharp({ create: { width: 128, height: 256, channels: 4, background: { r: 20, g: 30, b: 40, alpha: 0.5 } } }).png().toBuffer() };
  return { db, owner, other, admin, id, photo, verify, api, submits: () => submits, balance: (value: number) => { balance = value; } };
}

test("verified photos, including upgraded jobs, never generate without explicit owner-admin approval", async () => {
  const f = await fixture();
  try {
    assert.throws(() => actOnAdminAvatar(f.db, f.id, "approve", f.admin.id, now), /AVATAR_JOB_CHANGED/);
    f.verify();
    initializeCoreSchema(f.db);
    let calls = 0;
    await runAvatarGeneration(f.db, { ...f.api, request: async (...args) => { calls++; return f.api.request(...args); } }, now + 2);
    assert.equal(calls, 0); assert.equal(adminAvatarJobs(f.db).jobs[0].hold, "AWAITING_APPROVAL");
    assert.throws(() => actOnAdminAvatar(f.db, f.id, "approve", f.owner.id, now + 2), /ADMIN_ACCESS_DENIED/);
    actOnAdminAvatar(f.db, f.id, "approve", f.admin.id, now + 2);
    actOnAdminAvatar(f.db, f.id, "approve", f.admin.id, now + 3);
    initializeCoreSchema(f.db);
    await runAvatarGeneration(f.db, f.api, now + 4);
    assert.equal(f.submits(), 1); assert.equal(adminAvatarJobs(f.db).jobs[0].status, "GENERATING");
    await runAvatarGeneration(f.db, f.api, now + 20_000);
    assert.equal(adminAvatarJobs(f.db).jobs[0].status, "READY");
    assert.ok(adminAvatarAsset(f.db, f.id, "render")); assert.ok(adminAvatarAsset(f.db, f.id, "photo"));
    assert.equal(readMapAvatar(f.db, f.owner.id).available, true); assert.equal(readMapAvatar(f.db, f.owner.id).enabled, false);
    expireAvatarJobs(f.db, now + AVATAR_PHOTO_TTL + 1); assert.equal(adminAvatarAsset(f.db, f.id, "photo"), undefined);
    assert.ok(adminAvatarAsset(f.db, f.id, "render"));
    expireAvatarJobs(f.db, now + 31 * 86400_000);
    assert.equal(adminAvatarJobs(f.db).total, 0);
    assert.equal(adminAvatarNotices(f.db).count, 0);
    assert.equal(readMapAvatar(f.db, f.owner.id).available, true);
  } finally { f.db.close(); }
});

test("funding, cap and provider holds are per-job admin data, not user errors or emails", async () => {
  const f = await fixture();
  try {
    f.verify(); actOnAdminAvatar(f.db, f.id, "approve", f.admin.id, now + 2); f.balance(50);
    await runAvatarGeneration(f.db, f.api, now + 3);
    assert.equal(adminAvatarJobs(f.db).jobs[0].hold, "INSUFFICIENT_CREDITS");
    assert.equal(avatarJobSummary(f.db, f.owner.id)!.status, "APPROVED");
    assert.ok(!JSON.stringify(avatarJobSummary(f.db, f.owner.id)).includes("CREDITS"));
    const emails: string[] = [];
    await deliverAvatarReminder(f.db, async email => { emails.push(JSON.stringify(email)); }, now + AVATAR_DELAY_MS + 10);
    assert.equal(emails.length, 1); assert.doesNotMatch(emails[0], /credits|Tripo|provider/i);
    process.env.COCOWHEELS_AVATAR_DAILY_CREDITS = "0";
    await runAvatarGeneration(f.db, f.api, now + 60_004);
    assert.equal(adminAvatarJobs(f.db).jobs[0].hold, "GENERATION_PAUSED");
    process.env.COCOWHEELS_AVATAR_DAILY_CREDITS = "330";
    await runAvatarGeneration(f.db, { ...f.api, request: async () => { throw new Error("private provider response"); } }, now + 120_005);
    assert.equal(adminAvatarJobs(f.db).jobs[0].hold, "PROVIDER_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(adminAvatarJobs(f.db)), /private provider response/);
    f.balance(1000); await runAvatarGeneration(f.db, f.api, now + 180_006);
    assert.equal(f.submits(), 1); assert.equal(adminAvatarJobs(f.db).jobs[0].hold, null);
    assert.equal(adminAvatarNotices(f.db).count, 0, "Recovered holds must not send stale admin reminders");
    const badRender = { ...f.api, image: async () => { throw new Error("test download failure"); } };
    await runAvatarGeneration(f.db, badRender, now + 210_007);
    const issueKey = adminAvatarJobs(f.db).jobs[0].notificationKey;
    await runAvatarGeneration(f.db, badRender, now + 280_008);
    assert.equal(adminAvatarJobs(f.db).jobs[0].notificationKey, issueKey, "An unchanged retrieval error keeps its original reminder deadline");
  } finally { process.env.COCOWHEELS_AVATAR_DAILY_CREDITS = "330"; f.db.close(); }
});

test("admin cancellation invalidates checking and late paid results without assignment or duplicate submission", async () => {
  const f = await fixture();
  try {
    const check = claimAvatarPhoto(f.db, now)!;
    actOnAdminAvatar(f.db, f.id, "cancel", f.admin.id, now + 1);
    assert.throws(() => completeAvatarPhoto(f.db, f.id, check.lease, "approved", null, now + 2), /AVATAR_LEASE_EXPIRED/);
    assert.equal(adminAvatarAsset(f.db, f.id, "photo"), undefined);
    const second = enqueueAvatarPhoto(f.db, f.owner.id, f.photo, randomUUID(), true, now + 3).job!.id;
    const claim = claimAvatarPhoto(f.db, now + 3)!; completeAvatarPhoto(f.db, claim.id, claim.lease, "approved", null, now + 4);
    actOnAdminAvatar(f.db, second, "approve", f.admin.id, now + 5);
    let release!: () => void, submitted = 0;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const work = runAvatarGeneration(f.db, { ...f.api, request: async path => {
      if (path !== "/generation/image-to-model") return f.api.request(path);
      submitted++; await wait; return { task_id: "cancelled-task" };
    } }, now + 6);
    while (!submitted) await new Promise(resolve => setImmediate(resolve));
    actOnAdminAvatar(f.db, second, "cancel", f.admin.id, now + 7); release(); await work;
    await runAvatarGeneration(f.db, f.api, now + 80_000);
    const row = adminAvatarJobs(f.db).jobs.find(job => job.id === second)!;
    assert.equal(row.status, "CANCELLED"); assert.equal(row.taskId, "cancelled-task");
    assert.equal(readMapAvatar(f.db, f.owner.id).available, false);
    actOnAdminAvatar(f.db, second, "cancel", f.admin.id, now + 8);
    assert.equal(avatarJobSummary(f.db, f.owner.id)!.status, "CANCELLED");
  } finally { f.db.close(); }
});

test("each submission and passed check creates an admin notification; five-minute emails honour per-stage visible reviews", async () => {
  const f = await fixture(), emails: { subject: string; to: string[] }[] = [];
  const send = async (email: { subject: string; to: string[] }) => { emails.push(email); };
  try {
    assert.equal(adminAvatarNotices(f.db).count, 1);
    await deliverAdminAvatarReminder(f.db, send, now + AVATAR_DELAY_MS - 1); assert.equal(emails.length, 0);
    await deliverAdminAvatarReminder(f.db, send, now + AVATAR_DELAY_MS); assert.equal(emails.length, 1);
    assert.match(emails[0].subject, /submitted for verification/); assert.deepEqual(emails[0].to, ["jmos0905@uni.sydney.edu.au"]);
    f.verify(); assert.equal(adminAvatarNotices(f.db).count, 1);
    const key = adminAvatarJobs(f.db).jobs[0].notificationKey!;
    reviewAdminAvatar(f.db, key, now + 2);
    await deliverAdminAvatarReminder(f.db, send, now + AVATAR_DELAY_MS + 2); assert.equal(emails.length, 1);
    assert.equal(adminAvatarNotices(f.db).count, 0);
    assert.ok(avatarJobSummary(f.db, f.owner.id)!.notificationKey, "Admin review must not clear the submitter's result");
    assert.ok(!JSON.stringify(emails).includes(f.photo.toString("base64").slice(0, 40)));
  } finally { f.db.close(); }
});

test("admin HTTP assets, list, notices and mutations require the existing owner cookie and same-origin mutation headers", async () => {
  const f = await fixture(), server = createApiServer(f.db);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const adminHeaders = { Cookie: `cocowheels_guest=${f.admin.token}`, "Content-Type": "application/json", "X-Admin-Request": "1", Origin: "http://localhost:3000" };
  const deniedHeaders: Record<string, string>[] = [{}, { Cookie: `cocowheels_guest=${f.owner.token}` }, { Cookie: `cocowheels_guest=${f.other.token}` }, { Authorization: `Bearer ${f.admin.token}` }];
  try {
    for (const path of ["", "/notifications", `/${f.id}/photo`, `/${f.id}/render`]) {
      for (const headers of deniedHeaders)
        assert.equal((await fetch(base + "/api/admin/avatar-jobs" + path, { headers })).status, 403);
    }
    const listed = await fetch(base + "/api/admin/avatar-jobs", { headers: adminHeaders }); assert.equal(listed.status, 200);
    const listing = JSON.stringify(await listed.json()); assert.doesNotMatch(listing, /photo_hash|lease|submission_id|file_token/);
    const asset = await fetch(base + `/api/admin/avatar-jobs/${f.id}/photo`, { headers: adminHeaders });
    assert.equal(asset.status, 200); assert.match(asset.headers.get("cache-control")!, /private, no-store/); assert.deepEqual(Buffer.from(await asset.arrayBuffer()), f.photo);
    f.verify();
    for (const headers of [{ ...adminHeaders, Origin: "https://attacker.invalid" }, { Cookie: adminHeaders.Cookie, "Content-Type": "application/json" }, { ...adminHeaders, Cookie: `cocowheels_guest=${f.owner.token}` }])
      assert.equal((await fetch(base + `/api/admin/avatar-jobs/${f.id}/approve`, { method: "POST", headers, body: "{}" })).status, 403);
    assert.equal((await fetch(base + `/api/admin/avatar-jobs/${f.id}/approve`, { method: "POST", headers: adminHeaders, body: "{}" })).status, 200);
    assert.equal((await fetch(base + `/api/admin/avatar-jobs/${f.id}/cancel`, { method: "POST", headers: adminHeaders, body: "{}" })).status, 200);
    assert.equal((await fetch(base + `/api/admin/avatar-jobs/${f.id}/photo`, { headers: adminHeaders })).status, 404);
    assert.equal((await fetch(base + `/api/admin/avatar-jobs/${f.id}/approve`, { method: "POST", headers: adminHeaders, body: "{}" })).status, 409);
  } finally { server.close(); server.closeAllConnections(); await once(server, "close"); f.db.close(); }
});

test("cancellation while checking balance or retrieving a generated render cannot continue paid work or assign it", async () => {
  for (const boundary of ["balance", "render"] as const) {
    const f = await fixture();
    try {
      f.verify(); actOnAdminAvatar(f.db, f.id, "approve", f.admin.id, now + 2);
      if (boundary === "render") await runAvatarGeneration(f.db, f.api, now + 3);
      let entered = false, uploads = 0, release!: () => void;
      const wait = new Promise<void>(resolve => { release = resolve; });
      const api: AvatarProvider = {
        request: async (...args) => {
          if (boundary === "balance" && args[0] === "/account/balance") { entered = true; await wait; }
          if (args[0] === "/files") uploads++;
          return f.api.request(...args);
        },
        image: async url => { entered = true; await wait; return f.api.image(url); },
      };
      const running = runAvatarGeneration(f.db, api, now + 20_000);
      while (!entered) await new Promise(resolve => setImmediate(resolve));
      actOnAdminAvatar(f.db, f.id, "cancel", f.admin.id, now + 20_001); release(); await running;
      assert.equal(adminAvatarJobs(f.db).jobs[0].status, "CANCELLED");
      assert.equal(readMapAvatar(f.db, f.owner.id).available, false);
      assert.equal(uploads, 0);
      assert.equal(f.submits(), boundary === "render" ? 1 : 0);
    } finally { f.db.close(); }
  }
});

test("a successful photo check sends a distinct admin approval reminder, with stable bounded retry and no photo", async () => {
  const f = await fixture();
  let attempts = 0; const payloads: string[] = [], keys: string[] = [];
  try {
    const submissionKey = adminAvatarJobs(f.db).jobs[0].notificationKey!;
    reviewAdminAvatar(f.db, submissionKey, now + 1); f.verify();
    const send = async (email: unknown, key: string) => { attempts++; payloads.push(JSON.stringify(email)); keys.push(key); if (attempts < 3) throw new Error("test transport unavailable"); };
    await deliverAdminAvatarReminder(f.db, send, now + AVATAR_DELAY_MS + 2);
    await deliverAdminAvatarReminder(f.db, send, now + AVATAR_DELAY_MS + 3); assert.equal(attempts, 1);
    await deliverAdminAvatarReminder(f.db, send, now + AVATAR_DELAY_MS + 60_003);
    await deliverAdminAvatarReminder(f.db, send, now + AVATAR_DELAY_MS + 120_004);
    await deliverAdminAvatarReminder(f.db, send, now + AVATAR_DELAY_MS + 180_005);
    assert.equal(attempts, 3); assert.equal(new Set(payloads).size, 1); assert.equal(new Set(keys).size, 1);
    assert.match(payloads[0], /waiting for generation approval/);
    assert.ok(!payloads[0].includes(f.photo.toString("base64")));
  } finally { f.db.close(); }
});

test("held Mac checks can be explicitly retried without approving generation", async () => {
  const f = await fixture();
  try {
    let current = now;
    for (let attempt = 0; attempt < 3; attempt++) {
      const claim = claimAvatarPhoto(f.db, current)!; assert.ok(claim);
      completeAvatarPhoto(f.db, claim.id, claim.lease, "retry", null, current + 1);
      current += 60_002;
    }
    assert.equal(claimAvatarPhoto(f.db, current), null);
    assert.equal(adminAvatarJobs(f.db).jobs[0].hold, "CHECK_UNAVAILABLE");
    actOnAdminAvatar(f.db, f.id, "retry-check", f.admin.id, current + 1);
    const fresh = claimAvatarPhoto(f.db, current + 2)!; assert.ok(fresh);
    completeAvatarPhoto(f.db, fresh.id, fresh.lease, "approved", null, current + 3);
    await runAvatarGeneration(f.db, f.api, current + 4); assert.equal(f.submits(), 0);
    assert.equal(adminAvatarJobs(f.db).jobs[0].hold, "AWAITING_APPROVAL");
  } finally { f.db.close(); }
});

test("seven-day admin photo retention remains bounded by the global queue/storage limit", async () => {
  const f = await fixture();
  try {
    for (let index = 0; index < 24; index++) {
      const { session } = createGuestSession(f.db);
      f.db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(`bounded${index}@example.com`, session.id, new Date(now).toISOString());
      enqueueAvatarPhoto(f.db, session.id, f.photo, randomUUID(), true, now);
    }
    for (let index = 0; index < 25; index++) {
      const claim = claimAvatarPhoto(f.db, now)!;
      completeAvatarPhoto(f.db, claim.id, claim.lease, "rejected", "FEET", now + 1);
    }
    assert.throws(() => enqueueAvatarPhoto(f.db, f.owner.id, f.photo, randomUUID(), true, now + 2), /AVATAR_QUEUE_FULL/);
    expireAvatarJobs(f.db, now + AVATAR_PHOTO_TTL + 1);
    assert.ok(enqueueAvatarPhoto(f.db, f.owner.id, f.photo, randomUUID(), true, now + AVATAR_PHOTO_TTL + 2).job);
  } finally { f.db.close(); }
});
