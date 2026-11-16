import type { Db } from "./core";
import { ADMIN_UNIKEY, UNIVERSITY_DOMAIN } from "./university-auth";
import { AVATAR_CREDITS, AVATAR_MODEL, expireAvatarJobs, finishAvatarJob, type AvatarJobRow } from "./avatar-jobs";
import type { AdminAvatarJobs, AdminAvatarNotice } from "../lib/admin-avatar";
import { avatarReviewReason } from "../lib/avatar-job";

export function adminAvatarNotices(db: Db): AdminAvatarNotice {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM avatar_admin_events WHERE reviewed_at IS NULL").get() as { n: number };
  const first = db.prepare("SELECT job_id,stage FROM avatar_admin_events WHERE reviewed_at IS NULL ORDER BY created_at DESC,event_key DESC LIMIT 1").get() as { job_id: string; stage: string } | undefined;
  return { count: n, href: first ? `/admin/avatar-management?job=${first.job_id}` : "/admin/avatar-management",
    message: first?.stage === "SUBMITTED" ? "Photo submitted for verification"
      : first?.stage === "VERIFIED" ? "Waiting for generation approval"
      : first?.stage === "READY" ? "Generated avatar ready to view" : "Submission update to review" };
}
export function adminAvatarJobs(db: Db, page = 0, focus?: string): AdminAvatarJobs {
  page = Math.floor(Math.max(0, Math.min(Number(page) || 0, 100000)));
  const jobs = db.prepare(`SELECT j.id,j.status,j.reason,j.rejection_note,j.hold_reason,j.created_at,j.updated_at,j.generation_approved_at,j.task_id,j.checked_at,j.check_duration_ms,
    (j.photo IS NOT NULL) AS has_photo,(j.render IS NOT NULL) AS has_render,a.unikey,p.username,
    (SELECT event_key FROM avatar_admin_events e WHERE e.job_id=j.id AND reviewed_at IS NULL ORDER BY created_at DESC,event_key DESC LIMIT 1) AS notification_key
    FROM avatar_jobs j JOIN university_accounts a ON a.principal_id=j.principal_id
    LEFT JOIN account_profiles p ON p.principal_id=j.principal_id
    ORDER BY (j.id=?) DESC, (j.status IN ('QUEUED','CHECKING','APPROVED','SUBMITTING','GENERATING','REVIEW_REQUIRED')) DESC,j.created_at DESC,j.id DESC LIMIT 25 OFFSET ?`)
    .all(focus ?? "", page * 25) as (AvatarJobRow & { unikey: string; username: string | null; notification_key: string | null; has_photo: number; has_render: number })[];
  const worker = db.prepare("SELECT seen_at FROM avatar_worker_state WHERE id=1").get() as { seen_at: number } | undefined;
  return {
    jobs: jobs.map(job => ({ id: job.id, username: job.username ?? job.unikey,
      email: job.unikey === "guest" ? "mosciarobusiness@gmail.com" : job.unikey.includes("@") ? job.unikey : `${job.unikey}@${UNIVERSITY_DOMAIN}`,
      status: job.status, reason: job.reason, reviewReason: job.rejection_note,
      hold: job.status === "APPROVED" && !job.generation_approved_at ? "AWAITING_APPROVAL" : job.hold_reason,
      createdAt: new Date(job.created_at).toISOString(), updatedAt: new Date(job.updated_at).toISOString(),
      approvedAt: job.generation_approved_at ? new Date(job.generation_approved_at).toISOString() : null,
      checkedAt: job.checked_at != null ? new Date(job.checked_at).toISOString() : null, checkDurationMs: job.check_duration_ms,
      taskId: job.task_id, notificationKey: job.notification_key,
      photoUrl: job.has_photo ? `/api/admin/avatar-jobs/${job.id}/photo` : null,
      renderUrl: job.has_render ? `/api/admin/avatar-jobs/${job.id}/render` : null,
    })),
    page, total: (db.prepare("SELECT COUNT(*) AS n FROM avatar_jobs").get() as { n: number }).n,
    workerSeenAt: worker ? new Date(worker.seen_at).toISOString() : null, model: AVATAR_MODEL, creditsPerAvatar: AVATAR_CREDITS,
  };
}
export function adminAvatarAsset(db: Db, id: string, kind: string): Buffer | undefined {
  if (!["photo", "render"].includes(kind)) return;
  const row = db.prepare(`SELECT ${kind} AS bytes FROM avatar_jobs WHERE id=?`).get(id) as { bytes: Buffer | null } | undefined;
  return row?.bytes ?? undefined;
}
export function actOnAdminAvatar(db: Db, id: string, action: string, principal: string, now = Date.now(), reason?: unknown) {
  return db.transaction(() => {
    // Also enforce the immutable admin account here, before any state transition.
    if (!db.prepare("SELECT 1 FROM university_accounts WHERE principal_id=? AND unikey=?").get(principal, ADMIN_UNIKEY)) throw new Error("ADMIN_ACCESS_DENIED");
    expireAvatarJobs(db, now);
    const job = db.prepare("SELECT * FROM avatar_jobs WHERE id=?").get(id) as AvatarJobRow | undefined;
    if (!job) throw new Error("AVATAR_JOB_CHANGED");
    if (action === "reject") {
      const note = avatarReviewReason(reason);
      if (!note) throw new Error("INVALID_AVATAR_REVIEW_REASON");
      // An identical retry must not acknowledge the user's unread rejection result.
      if (!(job.status === "REJECTED" && job.reason === "ADMIN_REJECTED" && job.rejection_note === note)) {
        if (["SUBMITTING", "GENERATING", "REVIEW_REQUIRED"].includes(job.status)) throw new Error("AVATAR_REVIEW_TOO_LATE");
        if (job.status !== "APPROVED" || !job.photo) throw new Error("AVATAR_JOB_CHANGED");
        db.prepare("UPDATE avatar_jobs SET rejection_note=?,generation_approved_at=NULL,generation_approved_by=NULL WHERE id=?").run(note, id);
        finishAvatarJob(db, id, "REJECTED", "ADMIN_REJECTED", now);
      }
    } else if (action === "approve" && job.status === "APPROVED" && job.photo) {
      if (!job.generation_approved_at) db.prepare("UPDATE avatar_jobs SET generation_approved_at=?,generation_approved_by=?,updated_at=?,next_at=?,hold_reason=NULL WHERE id=?")
        .run(now, principal, now, now, id);
    } else if (action === "cancel" && ["QUEUED", "CHECKING", "APPROVED", "SUBMITTING", "GENERATING", "REVIEW_REQUIRED", "FAILED", "CANCELLED"].includes(job.status)) {
      if (job.status !== "CANCELLED") finishAvatarJob(db, id, "CANCELLED", null, now);
    } else if (action === "retry-check" && job.status === "QUEUED" && job.photo && job.hold_reason === "CHECK_UNAVAILABLE") {
      db.prepare("UPDATE avatar_jobs SET check_attempts=0,hold_reason=NULL,updated_at=?,next_at=? WHERE id=?").run(now, now, id);
    } else throw new Error("AVATAR_JOB_CHANGED");
    db.prepare("UPDATE avatar_admin_events SET reviewed_at=COALESCE(reviewed_at,?) WHERE job_id=?").run(now, id);
    return { ok: true };
  })();
}
export function reviewAdminAvatar(db: Db, key: unknown, now = Date.now()) {
  if (typeof key !== "string" || key.length > 200) throw new Error("INVALID_NOTIFICATION_REVIEW");
  db.prepare("UPDATE avatar_admin_events SET reviewed_at=COALESCE(reviewed_at,?) WHERE event_key=?").run(now, key);
}
