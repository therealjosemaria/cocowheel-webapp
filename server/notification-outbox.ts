import { randomUUID } from "node:crypto";
import type { Db } from "./core";

export type NotificationKind = "REQUEST" | "ACCEPTED" | "OFFER" | "MESSAGE";
export const NOTIFICATION_DELAY_MS = 5 * 60_000;
export const NOTIFICATION_TTL_MS = 6 * 60 * 60_000;
export function queueNotification(db: Db, principal: string, kind: NotificationKind, entity: string, key: string, now: Date, messageId: number | null = null) {
  db.prepare(`INSERT OR IGNORE INTO journey_notifications
    (id,principal_id,event_key,kind,entity_id,message_id,created_at,due_at,deadline,next_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(randomUUID(), principal, key, kind, entity, messageId,
      now.toISOString(), +now + NOTIFICATION_DELAY_MS, +now + NOTIFICATION_TTL_MS, +now + NOTIFICATION_DELAY_MS);
}
export function reviewNotifications(db: Db, principal: string, keys: unknown, now = new Date()) {
  if (!Array.isArray(keys) || keys.length > 500 || keys.some(key => typeof key !== "string" || key.length > 200)) throw new Error("INVALID_NOTIFICATION_REVIEW");
  const update = db.prepare("UPDATE journey_notifications SET reviewed_at=COALESCE(reviewed_at,?), status=CASE WHEN status='PENDING' THEN 'REVIEWED' ELSE status END WHERE principal_id=? AND event_key=?");
  db.transaction(() => { for (const key of keys) update.run(now.toISOString(), principal, key); })();
}
export function reviewedNotifications(db: Db, principal: string): string[] {
  return (db.prepare("SELECT event_key FROM journey_notifications WHERE principal_id=? AND reviewed_at IS NOT NULL ORDER BY reviewed_at DESC LIMIT 500").all(principal) as { event_key: string }[]).map(row => row.event_key);
}
export function reviewMessageNotifications(db: Db, principal: string, request: string, lastId: number, now: Date) {
  db.prepare(`UPDATE journey_notifications SET reviewed_at=COALESCE(reviewed_at,?),
    status=CASE WHEN status='PENDING' THEN 'REVIEWED' ELSE status END
    WHERE principal_id=? AND kind='MESSAGE' AND entity_id=? AND message_id<=?`).run(now.toISOString(), principal, request, lastId);
}
