import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import sharp from "sharp";
import { initializeCoreSchema, createGuestSession } from "../server/core";
import { enqueueAvatarPhoto, claimAvatarPhoto, completeAvatarPhoto, avatarJobSummary } from "../server/avatar-jobs";
import { actOnAdminAvatar, adminAvatarJobs, adminAvatarAsset } from "../server/avatar-admin";
import { runAvatarGeneration, type AvatarProvider } from "../server/avatar-generation";
import { avatarBackground, AvatarBackgroundError, type AvatarBackgroundProcessor } from "../server/avatar-background";
import { assignMapAvatar, readMapAvatar } from "../server/map-avatars";
import { avatarGenerationPayload, AVATAR_CREDITS } from "../lib/avatar-generation";

process.env.COCOWHEELS_AVATAR_UPLOADS = "1";
const now = Date.now();
async function fixture() {
  const db = new Database(":memory:"); db.pragma("foreign_keys=ON"); initializeCoreSchema(db);
  const owner = createGuestSession(db).session.id, admin = createGuestSession(db).session.id;
  for (const [name, id] of [["owner@example.com", owner], ["jmos0905", admin]])
    db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(name, id, new Date(now).toISOString());
  const photo = await sharp({ create: { width: 400, height: 800, channels: 3, background: "white" } }).png().toBuffer();
  const cutout = await sharp({ create: { width: 128, height: 256, channels: 4, background: { r: 30, g: 40, b: 50, alpha: 0.5 } } }).png().toBuffer();
  const id = enqueueAvatarPhoto(db, owner, photo, randomUUID(), true, now).job!.id;
  const requests: { path: string; body?: unknown }[] = [];
  const api: AvatarProvider = { request: async (path, body) => {
    requests.push({ path, body });
    if (path === "/account/balance") return { balance: 5 };
    if (path === "/files") return { file_token: "fixture-file" };
    if (path === "/generation/image-to-image") return { task_id: "fixture-seedream" };
    return { status: "success", output: { generated_image_url: "https://tripo3d.ai/fixture.png", rendered_image_url: "https://tripo3d.ai/legacy.png" } };
  }, image: async () => photo };
  const background: AvatarBackgroundProcessor = { check: async () => {}, remove: async () => cutout };
  const verify = () => { const claim = claimAvatarPhoto(db, now)!; completeAvatarPhoto(db, id, claim.lease, "approved", null, now + 1); };
  return { db, owner, admin, id, photo, cutout, api, background, requests, verify };
}

test("production Seedream payload preserves the person's outfit and requests a plain background with compatible five-credit settings", () => {
  const value = avatarGenerationPayload("private-file-token");
  assert.equal(value.model, "seedream_v5"); assert.equal(AVATAR_CREDITS, 5);
  assert.equal(value.size, "2K"); assert.equal(value.output_format, "png");
  assert.equal("quality" in value, false); assert.equal("background" in value, false);
  assert.match(value.prompt, /Preserve their facial identity/); assert.match(value.prompt, /uniform white background/);
  assert.doesNotMatch(value.prompt, /black suit|white tie|\bhis\b|\bher\b/);
});

test("Mac verification and explicit owner-admin approval precede Seedream; local processing is checked before spending and display choice is preserved", async () => {
  const f = await fixture();
  try {
    await runAvatarGeneration(f.db, f.api, now, f.background); assert.equal(f.requests.length, 0);
    f.verify(); await runAvatarGeneration(f.db, f.api, now + 2, f.background); assert.equal(f.requests.length, 0);
    actOnAdminAvatar(f.db, f.id, "approve", f.admin, now + 3);
    await runAvatarGeneration(f.db, f.api, now + 4, { ...f.background, check: async () => { throw new Error("offline local runtime"); } });
    assert.equal(f.requests.length, 0); assert.equal(adminAvatarJobs(f.db).jobs[0].hold, "BACKGROUND_UNAVAILABLE");
    assignMapAvatar(f.db, f.owner, f.cutout, true);
    await runAvatarGeneration(f.db, f.api, now + 60_005, f.background);
    const submits = f.requests.filter(r => r.path === "/generation/image-to-image"); assert.equal(submits.length, 1);
    assert.deepEqual(submits[0].body, avatarGenerationPayload("fixture-file"));
    assert.deepEqual(f.db.prepare("SELECT generation_model,generation_credits FROM avatar_jobs WHERE id=?").get(f.id), { generation_model: "seedream_v5", generation_credits: 5 });
    initializeCoreSchema(f.db);
    let processed = 0;
    await runAvatarGeneration(f.db, f.api, now + 80_006, { ...f.background, remove: async image => { assert.deepEqual(image, f.photo); processed++; return f.cutout; } });
    assert.equal(processed, 1); assert.equal(avatarJobSummary(f.db, f.owner)!.status, "READY");
    assert.equal(readMapAvatar(f.db, f.owner).enabled, true);
    const generatedPreview = adminAvatarAsset(f.db, f.id, "render")!;
    assert.ok(generatedPreview);
    const previewInfo = await sharp(generatedPreview).metadata(), sourceInfo = await sharp(f.cutout).metadata();
    assert.equal(previewInfo.width, sourceInfo.width); assert.equal(previewInfo.height, sourceInfo.height);
    await runAvatarGeneration(f.db, f.api, now + 160_007, f.background);
    assert.equal(f.requests.filter(r => r.path === "/generation/image-to-image").length, 1);
  } finally { f.db.close(); }
});

test("a cutout requiring review retains a private generated preview, leaves the current avatar unchanged and never repeats the paid task", async () => {
  const f = await fixture();
  try {
    assignMapAvatar(f.db, f.owner, f.cutout, true); const previous = readMapAvatar(f.db, f.owner);
    f.verify(); actOnAdminAvatar(f.db, f.id, "approve", f.admin, now + 2);
    await runAvatarGeneration(f.db, f.api, now + 3, f.background);
    await runAvatarGeneration(f.db, f.api, now + 20_004, { ...f.background, remove: async () => { throw new AvatarBackgroundError(); } });
    const row = adminAvatarJobs(f.db).jobs[0]; assert.equal(row.status, "REVIEW_REQUIRED"); assert.equal(row.reason, "BACKGROUND_REVIEW");
    assert.ok(adminAvatarAsset(f.db, f.id, "render")); assert.deepEqual(readMapAvatar(f.db, f.owner), previous);
    assert.equal(avatarJobSummary(f.db, f.owner)!.status, "APPROVED");
    assert.doesNotMatch(JSON.stringify(avatarJobSummary(f.db, f.owner)), /BACKGROUND|task_id|credits/);
    const count = f.requests.length; await runAvatarGeneration(f.db, f.api, now + 120_005, f.background); assert.equal(f.requests.length, count);
    actOnAdminAvatar(f.db, f.id, "cancel", f.admin, now + 120_006); assert.equal(adminAvatarJobs(f.db).jobs[0].status, "CANCELLED");
  } finally { f.db.close(); }
});

test("legacy P2 tasks resume their existing result and legacy daily charges remain 110 credits", async () => {
  const f = await fixture(), cap = process.env.COCOWHEELS_AVATAR_DAILY_CREDITS;
  try {
    f.verify(); actOnAdminAvatar(f.db, f.id, "approve", f.admin, now + 2);
    f.db.prepare("UPDATE avatar_jobs SET status='GENERATING',task_id='legacy-p2',submitted_at=?,next_at=? WHERE id=?").run(now, now, f.id);
    await runAvatarGeneration(f.db, { ...f.api, image: async url => { assert.equal(url, "https://tripo3d.ai/legacy.png"); return f.cutout; } }, now + 3,
      { check: async () => { throw new Error("must not recheck legacy submission"); }, remove: async () => { throw new Error("must not process legacy alpha result"); } });
    assert.equal(avatarJobSummary(f.db, f.owner)!.status, "READY"); assert.equal(f.requests.filter(r => r.path.startsWith("/generation/")).length, 0);
    const next = enqueueAvatarPhoto(f.db, f.owner, f.photo, randomUUID(), true, now + 4).job!.id;
    const claim = claimAvatarPhoto(f.db, now + 4)!; completeAvatarPhoto(f.db, next, claim.lease, "approved", null, now + 5);
    actOnAdminAvatar(f.db, next, "approve", f.admin, now + 6);
    process.env.COCOWHEELS_AVATAR_DAILY_CREDITS = "110";
    await runAvatarGeneration(f.db, f.api, now + 7, f.background); assert.equal(adminAvatarJobs(f.db).jobs.find(j => j.id === next)!.hold, "DAILY_LIMIT");
    process.env.COCOWHEELS_AVATAR_DAILY_CREDITS = "115";
    await runAvatarGeneration(f.db, f.api, now + 60_008, f.background); assert.equal(f.requests.filter(r => r.path === "/generation/image-to-image").length, 1);
  } finally { if (cap === undefined) delete process.env.COCOWHEELS_AVATAR_DAILY_CREDITS; else process.env.COCOWHEELS_AVATAR_DAILY_CREDITS = cap; f.db.close(); }
});

test("cancellation during local preflight or background inference cannot spend or assign a late result", async () => {
  for (const step of ["check", "remove"] as const) {
    const f = await fixture();
    try {
      f.verify(); actOnAdminAvatar(f.db, f.id, "approve", f.admin, now + 2);
      if (step === "remove") await runAvatarGeneration(f.db, f.api, now + 3, f.background);
      const background = { ...f.background, [step]: async () => { actOnAdminAvatar(f.db, f.id, "cancel", f.admin, now + 20_001); return f.cutout; } };
      await runAvatarGeneration(f.db, f.api, now + 20_000, background);
      assert.equal(adminAvatarJobs(f.db).jobs[0].status, "CANCELLED"); assert.equal(readMapAvatar(f.db, f.owner).available, false);
      assert.equal(f.requests.filter(r => r.path === "/generation/image-to-image").length, step === "check" ? 0 : 1);
    } finally { f.db.close(); }
  }
});

test("missing local processing runtime fails closed without a provider request", async () => {
  const previous = process.env.COCOWHEELS_AVATAR_CUTOUT_PYTHON;
  try { process.env.COCOWHEELS_AVATAR_CUTOUT_PYTHON = "/missing-synthetic-python"; await assert.rejects(avatarBackground.check(), AvatarBackgroundError); }
  finally { if (previous === undefined) delete process.env.COCOWHEELS_AVATAR_CUTOUT_PYTHON; else process.env.COCOWHEELS_AVATAR_CUTOUT_PYTHON = previous; }
});


test("completed-result recovery issues only a GET-style read and rejects unfinished or injected task references", async () => {
  const { completedAvatarImage } = await import("../server/avatar-generation");
  const calls: string[] = [];
  const api = { request: async (path: string, body?: unknown) => { assert.equal(body, undefined); calls.push(path); return { status: "success", output: { generated_image_url: "https://tripo3d.ai/fixture.png" } }; }, image: async (url: string) => { calls.push(url); return Buffer.from("fixture"); } };
  assert.deepEqual(await completedAvatarImage("completed-fixture", false, api), Buffer.from("fixture"));
  assert.deepEqual(calls, ["/tasks/completed-fixture", "https://tripo3d.ai/fixture.png"]);
  await assert.rejects(completedAvatarImage("../../submit", false, api), /INVALID_AVATAR_TASK/);
  await assert.rejects(completedAvatarImage("unfinished", false, { ...api, request: async () => ({ status: "running" }) }), /AVATAR_RESULT_NOT_READY/);
});
