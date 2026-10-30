import type { Db } from "./core";
import { conversationSummaries } from "./messaging";
import { pendingOfferNotification } from "./rider-demands";
import { brandedEmailHtml, escapeHtml } from "./route-alert-email";
import { journeyEmailsConfigured, sendTransactionalEmail } from "./email-transport";
import type { AlertSender } from "./usual-routes";
import type { NotificationKind } from "./notification-outbox";

type Job = { id: string; principal_id: string; kind: NotificationKind; entity_id: string; message_id: number | null; deadline: number; reviewed_at: string | null; attempts: number; next_at: number; payload: string | null };
type Thread = { public_id: string; driver_session_id: string; rider_session_id: string; request_status: string; status: string; is_sample: number; offer_expires_at: string; last_activity_at: string; co_ride_started_at: string | null };
const titles: Record<NotificationKind, string> = {
  REQUEST: "A rider requested to join your journey",
  ACCEPTED: "Your request to join was accepted",
  OFFER: "A driver offered you a ride",
  MESSAGE: "You have unread journey messages",
};
function target(db: Db, job: Job, now: Date): string | null {
  if (job.kind === "OFFER") return pendingOfferNotification(db, job.entity_id, job.principal_id, now);
  const row = db.prepare(`SELECT r.public_id,r.driver_session_id,q.rider_session_id,q.status AS request_status,
    r.status,r.is_sample,r.offer_expires_at,r.last_activity_at,r.co_ride_started_at
    FROM ride_requests q JOIN rides r ON r.id=q.ride_id WHERE q.id=?`).get(job.entity_id) as Thread | undefined;
  if (!row || row.is_sample || ![row.driver_session_id,row.rider_session_id].includes(job.principal_id)) return null;
  const open = ["PUBLISHED","REQUESTED"].includes(row.status) && Date.parse(row.offer_expires_at) > +now;
  const accepted = ["ACCEPTED","RIDE_ACTIVE","CO_RIDE_ACTIVE"].includes(row.status) && row.request_status === "ACCEPTED" && Date.parse(row.last_activity_at) > +now - 86_400_000;
  const base = `/activity/${encodeURIComponent(row.public_id)}`;
  if (job.kind === "REQUEST") return open && row.request_status === "PENDING" && row.driver_session_id === job.principal_id ? `${base}#request-${encodeURIComponent(job.entity_id)}` : null;
  if (job.kind === "ACCEPTED") return accepted && !row.co_ride_started_at && row.rider_session_id === job.principal_id ? `${base}?request=${encodeURIComponent(job.entity_id)}#pickup-${encodeURIComponent(row.public_id)}` : null;
  const summary = conversationSummaries(db, row.public_id, job.principal_id, now).find(thread => thread.requestId === job.entity_id);
  const read = (db.prepare("SELECT last_id FROM message_reads WHERE request_id=? AND principal_id=?").get(job.entity_id, job.principal_id) as { last_id: number } | undefined)?.last_id ?? 0;
  return summary?.unread && !summary.stopped && (job.message_id ?? 0) > read ? `${base}${row.rider_session_id === job.principal_id ? `?request=${encodeURIComponent(job.entity_id)}` : ""}#messages-${encodeURIComponent(job.entity_id)}` : null;
}
export function journeyReminderContent(origin: string, kind: NotificationKind, href: string) {
  const title = titles[kind];
  const url = new URL(href, origin).href;
  return { subject: title, text: `${title}.\n\nView update: ${url}`,
    html: brandedEmailHtml(origin, `<h1 style="margin:0 0 24px;font-size:20px;line-height:1.35;font-weight:600">${escapeHtml(title)}</h1>\n<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 20px;background:#111827;color:#ffffff;border-radius:10px;font-size:16px;font-weight:600;text-decoration:none;line-height:1.4">View update</a>\n`) };
}
const sender: AlertSender = (email, id) => sendTransactionalEmail(email, `journey-reminder/${id}`);
export async function deliverJourneyReminder(db: Db, send: AlertSender = sender, now = new Date()) {
  if (send === sender && !journeyEmailsConfigured()) return;
  const job = db.prepare("SELECT * FROM journey_notifications WHERE status='PENDING' AND next_at<=? ORDER BY due_at,id LIMIT 1").get(+now) as Job | undefined;
  if (!job) return;
  const skip = () => db.prepare("UPDATE journey_notifications SET status='SKIPPED' WHERE id=?").run(job.id);
  const href = job.reviewed_at || job.deadline <= +now ? null : target(db, job, now);
  const account = db.prepare("SELECT unikey FROM university_accounts WHERE principal_id=?").get(job.principal_id) as { unikey: string } | undefined;
  if (!href || !account) { skip(); return; }
  if (job.attempts >= 3) { db.prepare("UPDATE journey_notifications SET status='FAILED' WHERE id=?").run(job.id); return; }
  const email = job.payload ? JSON.parse(job.payload) : {
    from: (process.env.COCOWHEELS_EMAIL_FROM ?? "test@example.com").replace(/^"?Coco\s?Wheels?"?(?=\s*<)/i,"GUMWHEEL"),
    to: [account.unikey === "guest" ? "mosciarobusiness@gmail.com" : account.unikey.includes("@") ? account.unikey : `${account.unikey}@uni.sydney.edu.au`],
    ...journeyReminderContent(process.env.COCOWHEELS_PUBLIC_ORIGIN ?? "http://localhost:3000", job.kind, href),
  };
  // Claim synchronously after the last read/relevance check. A review after the
  // provider request starts cannot recall an already submitted email.
  const changed = db.prepare(`UPDATE journey_notifications SET attempts=attempts+1,next_at=?,payload=?
    WHERE id=? AND status='PENDING' AND reviewed_at IS NULL AND next_at<=?`).run(+now + 60_000, JSON.stringify(email), job.id, +now).changes;
  if (!changed) return;
  try {
    await send(email, job.id);
    db.prepare("UPDATE journey_notifications SET status='SENT' WHERE id=?").run(job.id);
  } catch {
    if (job.attempts >= 2) db.prepare("UPDATE journey_notifications SET status='FAILED' WHERE id=? AND status='PENDING'").run(job.id);
  }
}
