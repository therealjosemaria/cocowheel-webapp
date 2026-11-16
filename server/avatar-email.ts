import type { Db } from "./core";
import type { AlertSender } from "./usual-routes";
import { brandedEmailHtml, escapeHtml } from "./route-alert-email";
import { journeyEmailsConfigured, sendTransactionalEmail } from "./email-transport";
import { avatarJobMessage, type AvatarJob } from "../lib/avatar-job";
import { avatarJobSummary } from "./avatar-jobs";
import { ADMIN_UNIKEY, UNIVERSITY_DOMAIN } from "./university-auth";

type Event = { event_key: string; job_id: string; principal_id: string; created_at: number; attempts: number; payload: string | null };
const sender: AlertSender = (email, key) => sendTransactionalEmail(email, `avatar/${key}`);
export async function deliverAvatarReminder(db: Db, send: AlertSender = sender, now = Date.now()) {
  if (send === sender && !journeyEmailsConfigured()) return;
  const event = db.prepare("SELECT * FROM avatar_events WHERE reviewed_at IS NULL AND sent_at IS NULL AND next_at<=? AND attempts<3 ORDER BY due_at,event_key LIMIT 1").get(now) as Event | undefined;
  if (!event) return;
  const latest = avatarJobSummary(db, event.principal_id);
  const account = db.prepare("SELECT unikey FROM university_accounts WHERE principal_id=?").get(event.principal_id) as { unikey: string } | undefined;
  if (!latest || latest.id !== event.job_id || latest.notificationKey !== event.event_key || !account || now - event.created_at > 86400_000) {
    db.prepare("UPDATE avatar_events SET reviewed_at=? WHERE event_key=?").run(now, event.event_key); return;
  }
  const origin = process.env.COCOWHEELS_PUBLIC_ORIGIN ?? "http://localhost:3000";
  const href = new URL("/usual-route?avatar=1", origin).href;
  const title = latest.status === "READY" ? "Your avatar is ready" : "Your photo check has an update";
  const text = avatarJobMessage(latest as AvatarJob);
  const email = event.payload ? JSON.parse(event.payload) : {
    from: (process.env.COCOWHEELS_EMAIL_FROM ?? "test@example.com").replace(/^"?Coco\s?Wheels?"?(?=\s*<)/i, "GUMWHEEL"),
    to: [account.unikey === "guest" ? "mosciarobusiness@gmail.com" : account.unikey.includes("@") ? account.unikey : `${account.unikey}@uni.sydney.edu.au`],
    subject: title, text: `${text}\n\nView update: ${href}`,
    html: brandedEmailHtml(origin, `<h1 style="margin:0 0 24px;font-size:20px;line-height:1.35;font-weight:600">${escapeHtml(title)}</h1><p style="margin:0 0 24px">${escapeHtml(text)}</p><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 20px;background:#111827;color:#ffffff;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;line-height:1.4">View update</a>`),
  };
  const claimed = db.prepare("UPDATE avatar_events SET attempts=attempts+1,next_at=?,payload=? WHERE event_key=? AND reviewed_at IS NULL AND sent_at IS NULL AND next_at<=?")
    .run(now + 60_000, JSON.stringify(email), event.event_key, now).changes;
  if (!claimed) return;
  try { await send(email, event.event_key); db.prepare("UPDATE avatar_events SET sent_at=? WHERE event_key=?").run(now, event.event_key); }
  catch { /* The stable payload/key makes the bounded transport retry idempotent. */ }
}

/** Owner-only operational updates, separate from each submitter's result events. */
export async function deliverAdminAvatarReminder(db: Db, send: AlertSender = sender, now = Date.now()) {
  if (send === sender && !journeyEmailsConfigured()) return;
  const event = db.prepare("SELECT * FROM avatar_admin_events WHERE stage<>'READY' AND reviewed_at IS NULL AND sent_at IS NULL AND next_at<=? AND attempts<3 ORDER BY due_at,event_key LIMIT 1").get(now) as (Event & { stage: string }) | undefined;
  if (!event) return;
  if (now - event.created_at > 86400_000) {
    // Expire email eligibility, without clearing the in-app review indicator.
    db.prepare("UPDATE avatar_admin_events SET attempts=3 WHERE event_key=?").run(event.event_key); return;
  }
  if (!db.prepare("SELECT 1 FROM university_accounts WHERE unikey=?").get(ADMIN_UNIKEY)) return;
  const origin = process.env.COCOWHEELS_PUBLIC_ORIGIN ?? "http://localhost:3000";
  const href = new URL(`/admin/avatar-management?job=${event.job_id}`, origin).href;
  const title = event.stage === "SUBMITTED" ? "Avatar photo submitted for verification"
    : event.stage === "VERIFIED" ? "Avatar waiting for generation approval"
    : event.stage === "READY" ? "Avatar generation complete" : "Avatar submission has an update";
  const text = event.stage === "SUBMITTED" ? "A photo is waiting for its requirements check. Open Avatar management to review it."
    : event.stage === "VERIFIED" ? "A photo passed its requirements check. Open Avatar management to approve generation."
    : event.stage === "READY" ? "The generated avatar is available to its owner. Open Avatar management to preview it."
    : "Open Avatar management to review this submission’s status and any operational issues.";
  const email = event.payload ? JSON.parse(event.payload) : {
    from: (process.env.COCOWHEELS_EMAIL_FROM ?? "test@example.com").replace(/^"?Coco\s?Wheels?"?(?=\s*<)/i, "GUMWHEEL"),
    to: [`${ADMIN_UNIKEY}@${UNIVERSITY_DOMAIN}`], subject: title, text: `${text}\n\nView submission: ${href}`,
    html: brandedEmailHtml(origin, `<h1 style="margin:0 0 24px;font-size:20px;line-height:1.35;font-weight:600">${escapeHtml(title)}</h1><p style="margin:0 0 24px">${escapeHtml(text)}</p><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 20px;background:#111827;color:#ffffff;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;line-height:1.4">View submission</a>`),
  };
  const claimed = db.prepare("UPDATE avatar_admin_events SET attempts=attempts+1,next_at=?,payload=? WHERE event_key=? AND reviewed_at IS NULL AND sent_at IS NULL AND next_at<=?")
    .run(now + 60_000, JSON.stringify(email), event.event_key, now).changes;
  if (!claimed) return;
  try { await send(email, event.event_key); db.prepare("UPDATE avatar_admin_events SET sent_at=? WHERE event_key=?").run(now, event.event_key); }
  catch { /* Same persisted payload/key and bounded transport retries as user updates. */ }
}
