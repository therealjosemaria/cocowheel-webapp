import type { Db } from "./core";
import type { Conversation, ConversationSummary } from "../lib/messaging-types";

type Thread = {
  id: string;
  driver: string;
  rider: string;
  driver_alias: string;
  rider_alias: string;
  status: string;
  ride_status: string;
  accepted_request_id: string | null;
  expires: string;
  last_activity_at: string;
};
const query = `SELECT q.id, r.driver_session_id AS driver, q.rider_session_id AS rider,
 r.driver_alias, q.rider_alias, q.status, r.status AS ride_status, r.accepted_request_id,
 COALESCE(r.offer_expires_at, strftime('%Y-%m-%dT%H:%M:%fZ',r.scheduled_departure_at,'+6 hours')) AS expires,
 r.last_activity_at FROM ride_requests q JOIN rides r ON r.id=q.ride_id`;
function active(t: Thread, now: Date) {
  if (["PUBLISHED", "REQUESTED"].includes(t.ride_status))
    return t.status === "PENDING" && Date.parse(t.expires) > now.getTime();
  return (
    ["ACCEPTED", "RIDE_ACTIVE", "CO_RIDE_ACTIVE"].includes(t.ride_status) &&
    t.status === "ACCEPTED" &&
    t.accepted_request_id === t.id &&
    Date.parse(t.last_activity_at) > now.getTime() - 86400000
  );
}
function thread(
  db: Db,
  ride: string,
  request: string,
  principal: string,
  now: Date,
) {
  const t = db
    .prepare(`${query} WHERE r.public_id=? AND q.id=?`)
    .get(ride, request) as Thread | undefined;
  if (!t || ![t.driver, t.rider].includes(principal))
    throw new Error("RIDE_ACCESS_DENIED");
  if (!active(t, now)) throw new Error("CONVERSATION_CLOSED");
  return t;
}
function stopped(db: Db, id: string) {
  return Boolean(
    db.prepare("SELECT 1 FROM message_stops WHERE request_id=?").get(id),
  );
}
export function conversationSummaries(
  db: Db,
  ride: string,
  principal: string,
  now = new Date(),
): ConversationSummary[] {
  const rows = db
    .prepare(
      `${query} WHERE r.public_id=? AND (r.driver_session_id=? OR q.rider_session_id=?)`,
    )
    .all(ride, principal, principal) as Thread[];
  return rows
    .filter((t) => active(t, now))
    .map((t) => ({
      requestId: t.id,
      peer: principal === t.driver ? t.rider_alias : t.driver_alias,
      stopped: stopped(db, t.id),
      unread: stopped(db, t.id)
        ? 0
        : (
            db
              .prepare(
                `SELECT COUNT(*) AS n FROM ride_messages WHERE request_id=? AND sender_id<>? AND id>COALESCE((SELECT last_id FROM message_reads WHERE request_id=? AND principal_id=?),0)`,
              )
              .get(t.id, principal, t.id, principal) as { n: number }
          ).n,
    }));
}
export function readConversation(
  db: Db,
  ride: string,
  request: string,
  principal: string,
  now = new Date(),
): Conversation {
  thread(db, ride, request, principal, now);
  const rows = db
    .prepare(
      "SELECT id,sender_id,body,created_at FROM ride_messages WHERE request_id=? ORDER BY id LIMIT 500",
    )
    .all(request) as {
    id: number;
    sender_id: string;
    body: string;
    created_at: string;
  }[];
  return {
    stopped: stopped(db, request),
    messages: rows.map((m) => ({
      id: m.id,
      mine: m.sender_id === principal,
      text: m.body,
      createdAt: m.created_at,
    })),
  };
}
export function sendMessage(
  db: Db,
  ride: string,
  request: string,
  principal: string,
  text: unknown,
  clientId: unknown,
  now = new Date(),
) {
  return db.transaction(() => {
    thread(db, ride, request, principal, now);
    if (stopped(db, request)) throw new Error("MESSAGING_STOPPED");
    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 1000 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text) ||
      typeof clientId !== "string" ||
      !/^[a-zA-Z0-9-]{16,64}$/.test(clientId)
    )
      throw new Error("INVALID_MESSAGE");
    const body = text.trim();
    const existing = db
      .prepare(
        "SELECT id,body FROM ride_messages WHERE request_id=? AND sender_id=? AND client_id=?",
      )
      .get(request, principal, clientId) as
      { id: number; body: string } | undefined;
    if (existing) {
      if (existing.body !== body) throw new Error("MESSAGE_CONFLICT");
      return { id: existing.id };
    }
    const count = (
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM ride_messages WHERE sender_id=? AND created_at>?",
        )
        .get(principal, new Date(now.getTime() - 60000).toISOString()) as {
        n: number;
      }
    ).n;
    if (count >= 20) throw new Error("MESSAGE_RATE_LIMITED");
    if (
      (
        db
          .prepare("SELECT COUNT(*) AS n FROM ride_messages WHERE request_id=?")
          .get(request) as { n: number }
      ).n >= 500
    )
      throw new Error("CONVERSATION_FULL");
    const result = db
      .prepare(
        "INSERT INTO ride_messages(request_id,sender_id,client_id,body,created_at) VALUES (?,?,?,?,?)",
      )
      .run(request, principal, clientId, body, now.toISOString());
    return { id: Number(result.lastInsertRowid) };
  })();
}
export function markMessagesRead(
  db: Db,
  ride: string,
  request: string,
  principal: string,
  lastId: unknown,
  now = new Date(),
) {
  thread(db, ride, request, principal, now);
  if (
    typeof lastId !== "number" ||
    !Number.isSafeInteger(lastId) ||
    lastId < 1 ||
    !db
      .prepare("SELECT 1 FROM ride_messages WHERE request_id=? AND id=?")
      .get(request, lastId)
  )
    throw new Error("INVALID_MESSAGE");
  db.prepare(
    "INSERT INTO message_reads(request_id,principal_id,last_id) VALUES (?,?,?) ON CONFLICT(request_id,principal_id) DO UPDATE SET last_id=MAX(last_id,excluded.last_id)",
  ).run(request, principal, lastId);
}
export function stopMessages(
  db: Db,
  ride: string,
  request: string,
  principal: string,
  now = new Date(),
) {
  thread(db, ride, request, principal, now);
  db.prepare(
    "INSERT OR IGNORE INTO message_stops(request_id,principal_id,created_at) VALUES (?,?,?)",
  ).run(request, principal, now.toISOString());
}
