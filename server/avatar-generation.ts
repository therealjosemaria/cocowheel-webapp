import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import sharp from "sharp";
import type { Db } from "./core";
import { comparisonPayload } from "../lib/tripo-comparison";
import { prepareAvatarSprite } from "./map-avatars";
import { AVATAR_CREDITS, AVATAR_MODEL, clearAvatarHold, completeGeneratedAvatar, expireAvatarJobs, finishAvatarJob, holdAvatarJob, type AvatarJobRow } from "./avatar-jobs";
import type { AdminAvatarBalance } from "../lib/admin-avatar";

type ProviderResult = { balance?: number; frozen?: number; file_token?: string; task_id?: string; status?: string; output?: { rendered_image_url?: string } };
export type AvatarProvider = { request: (path: string, body?: FormData | Record<string, unknown>, timeoutMs?: number) => Promise<ProviderResult>; image: (url: string) => Promise<Buffer> };
class TripoError extends Error { constructor(readonly definitive: boolean) { super("TRIPO_REQUEST_FAILED"); } }
async function tripoKey() {
  if (process.env.TRIPO_API_KEY) return process.env.TRIPO_API_KEY;
  const path = process.env.COCOWHEELS_TRIPO_CREDENTIALS_FILE;
  return path ? parseEnv(await readFile(path, "utf8")).TRIPO_API_KEY : undefined;
}
const provider: AvatarProvider = {
  async request(path, body, timeoutMs = 60_000) {
    const key = await tripoKey();
    if (!key) throw new TripoError(true);
    const response = await fetch(`https://openapi.tripo3d.ai/v3${path}`, {
      method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${key}`, ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    // A definite 4xx rejection is safe to defer. Timeouts/5xx after paid POSTs are uncertain.
    if (!response.ok) throw new TripoError(response.status >= 400 && response.status < 500);
    const json = await response.json();
    if (json.code !== 0 || !json.data) throw new TripoError(false);
    return json.data;
  },
  async image(url) {
    const address = new URL(url);
    if (address.protocol !== "https:" || !/(^|\.)(tripo3d\.ai|openapi-dl\.data\.tripo3d\.com|tripo-data\.s3\.amazonaws\.com)$/.test(address.hostname))
      throw new Error("UNEXPECTED_AVATAR_HOST");
    const response = await fetch(address, { redirect: "error", signal: AbortSignal.timeout(60_000) });
    if (!response.ok || !response.body) throw new Error("AVATAR_DOWNLOAD_FAILED");
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 10_000_000) { await reader.cancel(); throw new Error("AVATAR_IMAGE_TOO_LARGE"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks);
  },
};
const balanceCache = new WeakMap<AvatarProvider, { expires: number; value: Promise<AdminAvatarBalance> }>();
/** Read-only, owner-route-only balance. Cache failures too; never expose provider errors. */
export function readAdminAvatarBalance(api: AvatarProvider = provider, now = Date.now()): Promise<AdminAvatarBalance> {
  const cached = balanceCache.get(api);
  if (cached && cached.expires > now) return cached.value;
  const value = (async (): Promise<AdminAvatarBalance> => {
    try {
      const result = await api.request("/account/balance", undefined, 8_000);
      if (typeof result.balance !== "number" || !Number.isFinite(result.balance) || result.balance < 0) throw new Error("INVALID_BALANCE");
      return { availableCredits: result.balance,
        frozenCredits: typeof result.frozen === "number" && Number.isFinite(result.frozen) && result.frozen >= 0 ? result.frozen : null,
        checkedAt: new Date(now).toISOString() };
    } catch { return { availableCredits: null, frozenCredits: null, checkedAt: null }; }
  })();
  balanceCache.set(api, { expires: now + 30_000, value });
  return value;
}
const working = new WeakSet<Db>();
/** One durable task at a time. Validation cannot call the paid provider. */
export async function runAvatarGeneration(db: Db, api: AvatarProvider = provider, now = Date.now()) {
  if (working.has(db)) return;
  if (api === provider && process.env.COCOWHEELS_AVATAR_UPLOADS !== "1") return;
  working.add(db);
  try {
    expireAvatarJobs(db, now);
    const pending = db.prepare("SELECT * FROM avatar_jobs WHERE status='GENERATING' AND next_at<=? ORDER BY submitted_at LIMIT 1").get(now) as AvatarJobRow | undefined;
    if (pending) {
      if (!pending.task_id || now - pending.submitted_at! > 86400_000) { finishAvatarJob(db, pending.id, "REVIEW_REQUIRED", "PROVIDER_REVIEW", now); return; }
      db.prepare("UPDATE avatar_jobs SET next_at=? WHERE id=?").run(now + 15_000, pending.id);
      try {
        const task = await api.request(`/tasks/${encodeURIComponent(pending.task_id)}`);
        if (!db.prepare("SELECT 1 FROM avatar_jobs WHERE id=? AND status='GENERATING'").get(pending.id)) return;
        if (!task.status) throw new Error("MISSING_TASK_STATUS");
        if (task.status === "success") {
          if (!task.output?.rendered_image_url) throw new Error("NO_AVATAR_RENDER");
          const image = await api.image(task.output.rendered_image_url);
          const stats = await sharp(image, { limitInputPixels: 16_000_000 }).stats();
          if (!stats.channels[3] || stats.channels[3].min === 255) throw new Error("OPAQUE_AVATAR_RENDER");
          completeGeneratedAvatar(db, pending.id, await prepareAvatarSprite(image), now);
        } else if (["failed", "cancelled", "canceled", "expired", "banned"].includes(task.status ?? "")) {
          if (db.prepare("SELECT 1 FROM avatar_jobs WHERE id=? AND status='GENERATING'").get(pending.id))
            finishAvatarJob(db, pending.id, "REVIEW_REQUIRED", "PROVIDER_FAILED", now);
        } else clearAvatarHold(db, pending.id, now);
      } catch {
        // Retain the task ID; downloads/polls retry this result, never create another paid task.
        db.prepare("UPDATE avatar_jobs SET next_at=? WHERE id=? AND status='GENERATING'").run(now + 60_000, pending.id);
        holdAvatarJob(db, pending.id, "RESULT_UNAVAILABLE", now);
      }
      return;
    }
    if (db.prepare("SELECT 1 FROM avatar_jobs WHERE status IN ('SUBMITTING','GENERATING')").get()) return;
    const job = db.prepare("SELECT * FROM avatar_jobs WHERE status='APPROVED' AND generation_approved_at IS NOT NULL AND generation_approved_by IS NOT NULL AND next_at<=? ORDER BY created_at,id LIMIT 1").get(now) as AvatarJobRow | undefined;
    if (!job || !job.photo) return;
    db.prepare("UPDATE avatar_jobs SET next_at=? WHERE id=? AND status='APPROVED'").run(now + 60_000, job.id);
    const cap = Number(process.env.COCOWHEELS_AVATAR_DAILY_CREDITS ?? 330);
    if (!Number.isFinite(cap) || cap < AVATAR_CREDITS) { holdAvatarJob(db, job.id, "GENERATION_PAUSED", now); return; }
    let balance: ProviderResult;
    try { balance = await api.request("/account/balance"); } catch { holdAvatarJob(db, job.id, "PROVIDER_UNAVAILABLE", now); return; }
    if (!Number.isFinite(balance.balance)) { holdAvatarJob(db, job.id, "PROVIDER_UNAVAILABLE", now); return; }
    if (balance.balance! < AVATAR_CREDITS) { holdAvatarJob(db, job.id, "INSUFFICIENT_CREDITS", now); return; }
    // Cancellation during an awaited provider request must stop subsequent work.
    if (!db.prepare("SELECT 1 FROM avatar_jobs WHERE id=? AND status='APPROVED' AND generation_approved_at IS NOT NULL").get(job.id)) return;
    let token = job.file_token;
    if (!token) {
      const file = new FormData();
      file.append("file", new Blob([new Uint8Array(job.photo)], { type: "image/jpeg" }), "avatar-photo.jpg");
      try { token = (await api.request("/files", file)).file_token ?? null; } catch { holdAvatarJob(db, job.id, "UPLOAD_FAILED", now); return; }
      if (!token || token.length > 300) { holdAvatarJob(db, job.id, "UPLOAD_FAILED", now); return; }
    }
    const claimed = db.transaction(() => {
      const day = new Date(now).toISOString().slice(0, 10);
      const count = (db.prepare("SELECT COUNT(*) AS n FROM avatar_jobs WHERE submitted_at>=?").get(Date.parse(`${day}T00:00:00Z`)) as { n: number }).n;
      if ((count + 1) * AVATAR_CREDITS > cap) { holdAvatarJob(db, job.id, "DAILY_LIMIT", now); return false; }
      const changed = db.prepare("UPDATE avatar_jobs SET status='SUBMITTING',file_token=?,submitted_at=?,updated_at=?,hold_reason=NULL WHERE id=? AND status='APPROVED' AND generation_approved_at IS NOT NULL AND generation_approved_by IS NOT NULL")
        .run(token, now, now, job.id).changes === 1;
      if (changed) clearAvatarHold(db, job.id, now);
      return changed;
    })();
    if (!claimed) return;
    try {
      const task = await api.request("/generation/image-to-model", comparisonPayload(token, AVATAR_MODEL));
      if (!task.task_id || !/^[a-zA-Z0-9-]{1,100}$/.test(task.task_id)) throw new Error("MISSING_TASK_ID");
      // Keep the private source for the seven-day admin review window. A late
      // response may record its task ID, but cannot revive a cancelled job.
      db.prepare("UPDATE avatar_jobs SET task_id=? WHERE id=? AND status IN ('SUBMITTING','CANCELLED')").run(task.task_id, job.id);
      db.prepare("UPDATE avatar_jobs SET status='GENERATING',updated_at=?,next_at=? WHERE id=? AND status='SUBMITTING'")
        .run(now, now + 15_000, job.id);
    } catch (error) {
      if (error instanceof TripoError && error.definitive) {
        db.prepare("UPDATE avatar_jobs SET status='APPROVED',submitted_at=NULL,updated_at=?,next_at=? WHERE id=? AND status='SUBMITTING'")
          .run(now, now + 60_000, job.id);
        holdAvatarJob(db, job.id, "SUBMISSION_REJECTED", now);
      } else finishAvatarJob(db, job.id, "REVIEW_REQUIRED", "SUBMISSION_UNCERTAIN", now);
    }
  } finally { working.delete(db); }
}
