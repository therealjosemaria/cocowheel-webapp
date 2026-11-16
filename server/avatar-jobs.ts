import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import type { Db } from "./core";
import type { AvatarJob, AvatarJobs, AvatarJobStatus } from "../lib/avatar-job";
import { avatarJobActive, avatarJobCancellable, avatarRejections } from "../lib/avatar-job";
import { assignMapAvatar } from "./map-avatars";

export const AVATAR_PHOTO_TTL = 7 * 86400_000;
export const AVATAR_LEASE_MS = 5 * 60_000;
export const AVATAR_DELAY_MS = 5 * 60_000;
export const AVATAR_MODEL = "P2-20260801";
export const AVATAR_CREDITS = 110;
export type AvatarJobRow = { id: string; principal_id: string; status: AvatarJobStatus; reason: string | null; photo: Buffer | null; photo_hash: string; lease_hash: string | null; lease_until: number | null; check_attempts: number; task_id: string | null; file_token: string | null; created_at: number; updated_at: number; next_at: number; submitted_at: number | null; generation_approved_at: number | null; generation_approved_by: string | null; hold_reason: string | null; render: Buffer | null; };
export function initializeAvatarJobs(db: Db) {
  db.exec(`CREATE TABLE IF NOT EXISTS avatar_jobs (
    id TEXT PRIMARY KEY, principal_id TEXT NOT NULL REFERENCES guest_sessions(id),
    submission_id TEXT NOT NULL, photo_hash TEXT NOT NULL, photo BLOB,
    status TEXT NOT NULL CHECK(status IN ('QUEUED','CHECKING','APPROVED','SUBMITTING','GENERATING','READY','REJECTED','FAILED','REVIEW_REQUIRED','CANCELLED','EXPIRED')),
    reason TEXT, lease_hash TEXT, lease_until INTEGER, check_attempts INTEGER NOT NULL DEFAULT 0,
    file_token TEXT, task_id TEXT UNIQUE, submitted_at INTEGER, created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, next_at INTEGER NOT NULL,
    UNIQUE(principal_id,submission_id));
    CREATE UNIQUE INDEX IF NOT EXISTS avatar_one_active ON avatar_jobs(principal_id)
      WHERE status IN ('QUEUED','CHECKING','APPROVED','SUBMITTING','GENERATING','REVIEW_REQUIRED');
    CREATE INDEX IF NOT EXISTS avatar_queue ON avatar_jobs(status,next_at,created_at);
    CREATE TABLE IF NOT EXISTS avatar_events (
      event_key TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES avatar_jobs(id) ON DELETE CASCADE,
      principal_id TEXT NOT NULL REFERENCES guest_sessions(id), status TEXT NOT NULL,
      created_at INTEGER NOT NULL, due_at INTEGER NOT NULL, reviewed_at INTEGER,
      sent_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, payload TEXT);
    CREATE TABLE IF NOT EXISTS avatar_worker_state (id INTEGER PRIMARY KEY CHECK(id=1), seen_at INTEGER NOT NULL);`);
  // Existing approved jobs deliberately receive no generation approval on upgrade.
  const columns = new Set((db.prepare("PRAGMA table_info(avatar_jobs)").all() as { name: string }[]).map(row => row.name));
  for (const [name, type] of [["generation_approved_at", "INTEGER"], ["generation_approved_by", "TEXT"], ["hold_reason", "TEXT"], ["render", "BLOB"]])
    if (!columns.has(name)) db.exec(`ALTER TABLE avatar_jobs ADD COLUMN ${name} ${type}`);
  db.exec(`CREATE TABLE IF NOT EXISTS avatar_admin_events (
    event_key TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES avatar_jobs(id) ON DELETE CASCADE,
    stage TEXT NOT NULL, created_at INTEGER NOT NULL, due_at INTEGER NOT NULL, reviewed_at INTEGER,
    sent_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, payload TEXT);
    CREATE INDEX IF NOT EXISTS avatar_admin_due ON avatar_admin_events(reviewed_at,sent_at,next_at);
    CREATE INDEX IF NOT EXISTS avatar_admin_job ON avatar_admin_events(job_id,created_at);`);
  for (const job of db.prepare("SELECT id,status FROM avatar_jobs WHERE status IN ('QUEUED','CHECKING','APPROVED') AND NOT EXISTS (SELECT 1 FROM avatar_admin_events e WHERE e.job_id=avatar_jobs.id)").all() as AvatarJobRow[])
    avatarAdminEvent(db, job.id, job.status === "APPROVED" ? "VERIFIED" : "SUBMITTED");
}
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export function authorizeAvatarWorker(value: string | undefined) {
  const key = process.env.COCOWHEELS_AVATAR_WORKER_KEY;
  if (!key || key.length < 43 || !value?.startsWith("Bearer ")) return false;
  const a = Buffer.from(hash(key)), b = Buffer.from(hash(value.slice(7)));
  return timingSafeEqual(a, b);
}
export function avatarUploadsEnabled() { return process.env.COCOWHEELS_AVATAR_UPLOADS === "1"; }
export function expireAvatarJobs(db: Db, now = Date.now()) {
  db.transaction(() => {
    for (const job of db.prepare("SELECT * FROM avatar_jobs WHERE photo IS NOT NULL AND created_at<=? AND status IN ('QUEUED','CHECKING','APPROVED')").all(now - AVATAR_PHOTO_TTL) as AvatarJobRow[])
      finishAvatarJob(db, job.id, "EXPIRED", null, now);
    // An interrupted paid submission is never blindly repeated.
    for (const job of db.prepare("SELECT * FROM avatar_jobs WHERE status='SUBMITTING' AND updated_at<?").all(now - 120_000) as AvatarJobRow[])
      finishAvatarJob(db, job.id, "REVIEW_REQUIRED", "SUBMISSION_UNCERTAIN", now);
    for (const job of db.prepare("SELECT * FROM avatar_jobs WHERE status='CHECKING' AND lease_until<=?").all(now) as AvatarJobRow[]) {
      if (job.check_attempts >= 3) holdAvatarCheck(db, job.id, now);
      else db.prepare("UPDATE avatar_jobs SET status='QUEUED',lease_hash=NULL,lease_until=NULL,updated_at=?,next_at=? WHERE id=?").run(now, now, job.id);
    }
    db.prepare("UPDATE avatar_jobs SET photo=NULL WHERE created_at<=?").run(now - AVATAR_PHOTO_TTL);
    db.prepare("DELETE FROM avatar_jobs WHERE updated_at<? AND status IN ('READY','REJECTED','FAILED','CANCELLED','EXPIRED','REVIEW_REQUIRED')").run(now - 30 * 86400_000);
  })();
}
export function avatarJobSummary(db: Db, principal: string): AvatarJob | null {
  const row = db.prepare("SELECT id,status,reason,created_at FROM avatar_jobs WHERE principal_id=? ORDER BY created_at DESC,id DESC LIMIT 1").get(principal) as Pick<AvatarJobRow, "id" | "status" | "reason" | "created_at"> | undefined;
  if (!row) return null;
  const event = db.prepare("SELECT event_key FROM avatar_events WHERE job_id=? AND reviewed_at IS NULL ORDER BY created_at DESC LIMIT 1").get(row.id) as { event_key: string } | undefined;
  // Operational failures belong in Admin; the user retains the last completed stage.
  const status = row.status === "REVIEW_REQUIRED" ? "APPROVED"
    : row.status === "FAILED" ? (row.reason === "CHECK_UNAVAILABLE" ? "QUEUED" : "APPROVED") : row.status;
  return { id: row.id, status, reason: row.reason && avatarRejections[row.reason] ? row.reason : null,
    notificationKey: event?.event_key ?? null, createdAt: new Date(row.created_at).toISOString() };
}
export function readAvatarJobs(db: Db, principal: string): AvatarJobs {
  return { accepting: avatarUploadsEnabled(), job: avatarJobSummary(db, principal) };
}
let decoding = false;
export async function prepareQueuedAvatarPhoto(value: unknown): Promise<Buffer> {
  if (typeof value !== "string" || value.length > 2_800_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))
    throw new Error("INVALID_AVATAR_PHOTO");
  if (decoding) throw new Error("PHOTO_BUSY");
  decoding = true;
  try {
    const image = sharp(Buffer.from(value.slice(value.indexOf(",") + 1), "base64"), { limitInputPixels: 32_000_000, failOn: "warning" });
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) !== 1) throw new Error();
    const bytes = await image.rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "white" }).jpeg({ quality: 92 }).toBuffer();
    const normalized = await sharp(bytes).metadata();
    if (!normalized.width || normalized.width < 256 || !normalized.height || normalized.height < 512 || bytes.length > 2_000_000) throw new Error();
    return bytes;
  } catch { throw new Error("INVALID_AVATAR_PHOTO"); }
  finally { decoding = false; }
}
export function enqueueAvatarPhoto(db: Db, principal: string, photo: Buffer, submissionId: unknown, consent: unknown, now = Date.now()): AvatarJobs {
  if (!avatarUploadsEnabled()) throw new Error("AVATAR_UPLOADS_UNAVAILABLE");
  if (consent !== true || typeof submissionId !== "string" || !/^[a-f0-9-]{36}$/.test(submissionId)) throw new Error("INVALID_AVATAR_SUBMISSION");
  return db.transaction(() => {
    expireAvatarJobs(db, now);
    const existing = db.prepare("SELECT * FROM avatar_jobs WHERE principal_id=? AND submission_id=?").get(principal, submissionId) as AvatarJobRow | undefined;
    if (existing) {
      if (existing.photo_hash !== hash(photo)) throw new Error("AVATAR_SUBMISSION_CHANGED");
      return readAvatarJobs(db, principal);
    }
    const current = avatarJobSummary(db, principal);
    if (current && avatarJobActive(current.status)) throw new Error("AVATAR_ALREADY_QUEUED");
    if ((db.prepare("SELECT COUNT(*) AS n FROM avatar_jobs WHERE principal_id=? AND created_at>?").get(principal, now - 86400_000) as { n: number }).n >= 3)
      throw new Error("AVATAR_UPLOAD_LIMIT");
    if ((db.prepare("SELECT COUNT(*) AS n FROM avatar_jobs WHERE photo IS NOT NULL OR status IN ('QUEUED','CHECKING','APPROVED','SUBMITTING','GENERATING','REVIEW_REQUIRED')").get() as { n: number }).n >= 25)
      throw new Error("AVATAR_QUEUE_FULL");
    db.prepare("UPDATE avatar_events SET reviewed_at=COALESCE(reviewed_at,?) WHERE principal_id=?").run(now, principal);
    const id = randomUUID();
    db.prepare(`INSERT INTO avatar_jobs(id,principal_id,submission_id,photo_hash,photo,status,created_at,updated_at,next_at)
      VALUES (?,?,?,?,?,'QUEUED',?,?,?)`).run(id, principal, submissionId, hash(photo), photo, now, now, now);
    avatarAdminEvent(db, id, "SUBMITTED", now);
    return readAvatarJobs(db, principal);
  })();
}
export function finishAvatarJob(db: Db, id: string, status: AvatarJobStatus, reason: string | null = null, now = Date.now()) {
  db.transaction(() => {
    const job = db.prepare("SELECT principal_id,status FROM avatar_jobs WHERE id=?").get(id) as { principal_id: string; status: AvatarJobStatus } | undefined;
    if (!job || job.status === "CANCELLED") return;
    db.prepare("UPDATE avatar_events SET reviewed_at=COALESCE(reviewed_at,?) WHERE job_id=?").run(now, id);
    db.prepare(`UPDATE avatar_jobs SET status=?,reason=?,updated_at=?,next_at=?,lease_hash=NULL,lease_until=NULL,
      hold_reason=NULL,photo=CASE WHEN ? IN ('CANCELLED','EXPIRED') THEN NULL ELSE photo END WHERE id=?`).run(status, reason, now, now, status, id);
    avatarAdminEvent(db, id, status === "APPROVED" ? "VERIFIED" : status, now);
    if (!["QUEUED", "CHECKING", "REVIEW_REQUIRED", "FAILED"].includes(status))
      db.prepare(`INSERT OR IGNORE INTO avatar_events(event_key,job_id,principal_id,status,created_at,due_at,next_at) VALUES (?,?,?,?,?,?,?)`)
        .run(`avatar:${id}:${status}`, id, job.principal_id, status, now, now + AVATAR_DELAY_MS, now + AVATAR_DELAY_MS);
  })();
}
export function cancelAvatarJob(db: Db, principal: string, id: unknown, now = Date.now()) {
  const job = db.prepare("SELECT * FROM avatar_jobs WHERE principal_id=? AND id=?").get(principal, typeof id === "string" ? id : "") as AvatarJobRow | undefined;
  if (!job || (!avatarJobCancellable(job.status) && !["REVIEW_REQUIRED", "FAILED"].includes(job.status))) throw new Error("AVATAR_JOB_CHANGED");
  db.transaction(() => {
    finishAvatarJob(db, job.id, "CANCELLED", null, now);
    // The submitter already knows about their own cancellation. Admin-initiated
    // cancellations still create the normal user result notification.
    db.prepare("UPDATE avatar_events SET reviewed_at=COALESCE(reviewed_at,?) WHERE job_id=? AND status='CANCELLED'").run(now, job.id);
  })();
  return readAvatarJobs(db, principal);
}
export function claimAvatarPhoto(db: Db, now = Date.now()) {
  return db.transaction(() => {
    expireAvatarJobs(db, now);
    db.prepare("INSERT INTO avatar_worker_state VALUES (1,?) ON CONFLICT(id) DO UPDATE SET seen_at=excluded.seen_at").run(now);
    const row = db.prepare("SELECT * FROM avatar_jobs WHERE status='QUEUED' AND check_attempts<3 AND next_at<=? ORDER BY created_at,id LIMIT 1").get(now) as AvatarJobRow | undefined;
    if (!row || !row.photo) return null;
    const lease = randomBytes(32).toString("hex");
    db.prepare("UPDATE avatar_jobs SET status='CHECKING',lease_hash=?,lease_until=?,check_attempts=check_attempts+1,updated_at=? WHERE id=? AND status='QUEUED'")
      .run(hash(lease), now + AVATAR_LEASE_MS, now, row.id);
    return { id: row.id, lease, photo: row.photo.toString("base64") };
  })();
}
export function completeAvatarPhoto(db: Db, id: unknown, lease: unknown, verdict: unknown, reason: unknown, now = Date.now()) {
  return db.transaction(() => {
    const row = db.prepare("SELECT * FROM avatar_jobs WHERE id=? AND status='CHECKING'").get(typeof id === "string" ? id : "") as AvatarJobRow | undefined;
    if (!row || typeof lease !== "string" || hash(lease) !== row.lease_hash || !row.lease_until || row.lease_until <= now) throw new Error("AVATAR_LEASE_EXPIRED");
    if (verdict === "retry") {
      if (row.check_attempts >= 3) holdAvatarCheck(db, row.id, now);
      else db.prepare("UPDATE avatar_jobs SET status='QUEUED',lease_hash=NULL,lease_until=NULL,updated_at=?,next_at=? WHERE id=?").run(now, now + 60_000, row.id);
    } else if (verdict === "approved") finishAvatarJob(db, row.id, "APPROVED", null, now);
    else if (verdict === "rejected" && typeof reason === "string" && Object.hasOwn(avatarRejections, reason)) finishAvatarJob(db, row.id, "REJECTED", reason, now);
    else throw new Error("INVALID_AVATAR_VERDICT");
  })();
}
export function reviewAvatarEvent(db: Db, principal: string, key: unknown, now = Date.now()) {
  if (typeof key !== "string" || key.length > 100) throw new Error("INVALID_NOTIFICATION_REVIEW");
  db.prepare("UPDATE avatar_events SET reviewed_at=COALESCE(reviewed_at,?) WHERE principal_id=? AND event_key=?").run(now, principal, key);
}
export function completeGeneratedAvatar(db: Db, id: string, sprite: Buffer, now = Date.now()) {
  db.transaction(() => {
    const row = db.prepare("SELECT * FROM avatar_jobs WHERE id=? AND status='GENERATING'").get(id) as AvatarJobRow | undefined;
    if (!row) throw new Error("AVATAR_JOB_CHANGED");
    // Generation never opts an account into public display; preserve its existing choice.
    const previous = db.prepare("SELECT enabled FROM account_map_avatars WHERE principal_id=?").get(row.principal_id) as { enabled: number } | undefined;
    assignMapAvatar(db, row.principal_id, sprite, Boolean(previous?.enabled));
    db.prepare("UPDATE avatar_jobs SET render=? WHERE id=?").run(sprite, id);
    finishAvatarJob(db, id, "READY", null, now);
  })();
}

export function avatarAdminEvent(db: Db, id: string, stage: string, now = Date.now()) {
  db.transaction(() => {
    const key = `admin-avatar:${id}:${stage}`;
    if (db.prepare("SELECT 1 FROM avatar_admin_events WHERE event_key=?").get(key)) return;
    db.prepare("UPDATE avatar_admin_events SET reviewed_at=COALESCE(reviewed_at,?) WHERE job_id=?").run(now, id);
    db.prepare("INSERT INTO avatar_admin_events(event_key,job_id,stage,created_at,due_at,next_at) VALUES (?,?,?,?,?,?)")
      .run(key, id, stage, now, now + AVATAR_DELAY_MS, now + AVATAR_DELAY_MS);
  })();
}
export function holdAvatarJob(db: Db, id: string, reason: string, now = Date.now()) {
  db.transaction(() => {
    const changed = db.prepare("UPDATE avatar_jobs SET hold_reason=? WHERE id=? AND status IN ('QUEUED','APPROVED','GENERATING') AND COALESCE(hold_reason,'')<>?")
      .run(reason, id, reason).changes;
    if (changed) avatarAdminEvent(db, id, `HOLD_${reason}:${now}`, now);
  })();
}
export function clearAvatarHold(db: Db, id: string, now = Date.now()) {
  db.transaction(() => {
    db.prepare("UPDATE avatar_jobs SET hold_reason=NULL WHERE id=? AND status IN ('SUBMITTING','GENERATING')").run(id);
    db.prepare("UPDATE avatar_admin_events SET reviewed_at=COALESCE(reviewed_at,?) WHERE job_id=? AND stage LIKE 'HOLD_%'").run(now, id);
  })();
}
function holdAvatarCheck(db: Db, id: string, now: number) {
  db.prepare("UPDATE avatar_jobs SET status='QUEUED',lease_hash=NULL,lease_until=NULL,updated_at=?,next_at=? WHERE id=?").run(now, now + 60_000, id);
  holdAvatarJob(db, id, "CHECK_UNAVAILABLE", now);
}
