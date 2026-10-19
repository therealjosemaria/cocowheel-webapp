import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initializeCoreSchema,
  publishRide,
  requestRide,
  createGuestSession,
  decideRequest,
  publicRidePreview,
  getRide,
} from "../server/core";
import {
  conversationSummaries,
  readConversation,
  sendMessage,
  markMessagesRead,
  stopMessages,
} from "../server/messaging";
import { createApiServer } from "../server/index";
import {
  requestUniversityCode,
  verifyUniversityCode,
} from "../server/university-auth";

const pin = { latitude: -33.87, longitude: 151.21 };
process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString(
  "base64",
);
const end = { latitude: -33.92, longitude: 151.25 };
function fixture() {
  const db = new Database(":memory:");
  initializeCoreSchema(db);
  const now = new Date();
  const driver = createGuestSession(db, now);
  const rider = createGuestSession(db, now);
  const other = createGuestSession(db, now);
  const published = publishRide(
    db,
    driver.token,
    {
      origin: pin,
      destination: end,
      scheduledDepartureAt: now.toISOString(),
      priceAud: 5,
      payIdType: "EMAIL",
      payId: "test@example.com",
    },
    now,
  );
  const ride = published.ride.rideId;
  const input = {
    pickup: pin,
    destination: end,
    requestedDepartureAt: now.toISOString(),
  };
  const request = requestRide(db, rider.token, ride, input, now).ride.request!
    .requestId;
  const another = requestRide(db, other.token, ride, input, now).ride.request!
    .requestId;
  return { db, now, driver, rider, other, ride, request, another };
}
const key = (n: number) => `message-client-${String(n).padStart(8, "0")}`;
test("private messaging scopes, idempotency, unread cursor and public exclusion", () => {
  const f = fixture();
  const { db, ride, request, rider, driver, other, now } = f;
  try {
    initializeCoreSchema(db);
    const m = sendMessage(
      db,
      ride,
      request,
      rider.session.id,
      "<script>alert(1)</script>",
      key(1),
      now,
    );
    assert.deepEqual(
      sendMessage(
        db,
        ride,
        request,
        rider.session.id,
        "<script>alert(1)</script>",
        key(1),
        now,
      ),
      m,
    );
    assert.throws(
      () =>
        sendMessage(
          db,
          ride,
          request,
          rider.session.id,
          "different",
          key(1),
          now,
        ),
      /MESSAGE_CONFLICT/,
    );
    for (const fn of [
      () => readConversation(db, ride, request, other.session.id, now),
      () =>
        sendMessage(db, ride, request, other.session.id, "hello", key(2), now),
      () => markMessagesRead(db, ride, request, other.session.id, m.id, now),
      () => stopMessages(db, ride, request, other.session.id, now),
      () => readConversation(db, "wrong-ride", request, driver.session.id, now),
    ])
      assert.throws(fn, /RIDE_ACCESS_DENIED/);
    assert.equal(
      readConversation(db, ride, request, driver.session.id, now).messages[0]
        .mine,
      false,
    );
    assert.equal(
      conversationSummaries(db, ride, driver.session.id, now)[0].unread,
      1,
    );
    assert.equal(
      conversationSummaries(db, ride, rider.session.id, now).length,
      1,
    );
    assert.equal(
      conversationSummaries(db, ride, other.session.id, now)[0].unread,
      0,
    );
    const second = sendMessage(
      db,
      ride,
      request,
      rider.session.id,
      "second",
      key(2),
      now,
    );
    markMessagesRead(db, ride, request, driver.session.id, second.id, now);
    markMessagesRead(db, ride, request, driver.session.id, m.id, now);
    assert.equal(
      conversationSummaries(db, ride, driver.session.id, now)[0].unread,
      0,
    );
    assert.throws(
      () => markMessagesRead(db, ride, f.another, driver.session.id, m.id, now),
      /INVALID_MESSAGE/,
    );
    assert.throws(
      () => markMessagesRead(db, ride, request, driver.session.id, 99999, now),
      /INVALID_MESSAGE/,
    );
    assert.ok(
      !JSON.stringify(publicRidePreview(db, ride, now)).includes("<script>"),
    );
    assert.ok(
      !JSON.stringify(getRide(db, ride, rider.session, now)).includes(
        "<script>",
      ),
    );
  } finally {
    db.close();
  }
});
test("validation, principal-wide rate limits and bounded conversation size", () => {
  const { db, ride, request, another, rider, driver, now } = fixture();
  try {
    for (const body of ["", " ", "a".repeat(1001), "bad\u0000", null, {}])
      assert.throws(
        () =>
          sendMessage(db, ride, request, rider.session.id, body, key(0), now),
        /INVALID_MESSAGE/,
      );
    assert.throws(
      () =>
        sendMessage(db, ride, request, rider.session.id, "ok", "short", now),
      /INVALID_MESSAGE/,
    );
    for (let i = 0; i < 20; i++)
      sendMessage(db, ride, request, driver.session.id, "ok", key(i), now);
    assert.throws(
      () =>
        sendMessage(
          db,
          ride,
          another,
          driver.session.id,
          "other thread",
          key(21),
          now,
        ),
      /MESSAGE_RATE_LIMITED/,
    );
    for (let i = 20; i < 500; i++)
      sendMessage(
        db,
        ride,
        request,
        driver.session.id,
        "ok",
        key(i),
        new Date(now.getTime() + Math.floor(i / 20) * 61000),
      );
    assert.throws(
      () =>
        sendMessage(
          db,
          ride,
          request,
          rider.session.id,
          "full",
          key(501),
          new Date(now.getTime() + 2000000),
        ),
      /CONVERSATION_FULL/,
    );
    assert.equal(
      readConversation(
        db,
        ride,
        request,
        rider.session.id,
        new Date(now.getTime() + 2000000),
      ).messages.length,
      500,
    );
  } finally {
    db.close();
  }
});
test("stopping is bilateral and does not cancel or delete the ride", () => {
  const { db, ride, request, rider, driver, now } = fixture();
  try {
    sendMessage(db, ride, request, rider.session.id, "hello", key(1), now);
    stopMessages(db, ride, request, rider.session.id, now);
    for (const principal of [driver.session.id, rider.session.id])
      assert.throws(
        () => sendMessage(db, ride, request, principal, "hello", key(2), now),
        /MESSAGING_STOPPED/,
      );
    assert.equal(
      readConversation(db, ride, request, driver.session.id, now).messages
        .length,
      1,
    );
    assert.equal(
      conversationSummaries(db, ride, driver.session.id, now)[0].unread,
      0,
    );
    assert.equal(getRide(db, ride, driver.session, now).status, "REQUESTED");
  } finally {
    db.close();
  }
});
test("messages, unread cursors and stops survive backup/reopen and schema initialization", async () => {
  const { db, ride, request, rider, driver, now } = fixture();
  const directory = mkdtempSync(join(tmpdir(), "gumwheel-chat-"));
  try {
    const sent = sendMessage(
      db,
      ride,
      request,
      rider.session.id,
      "retained",
      key(1),
      now,
    );
    markMessagesRead(db, ride, request, driver.session.id, sent.id, now);
    stopMessages(db, ride, request, rider.session.id, now);
    await db.backup(join(directory, "restore.db"));
    const restored = new Database(join(directory, "restore.db"));
    try {
      initializeCoreSchema(restored);
      assert.deepEqual(
        readConversation(restored, ride, request, driver.session.id, now),
        readConversation(db, ride, request, driver.session.id, now),
      );
      assert.equal(
        (
          restored
            .prepare(
              "SELECT last_id FROM message_reads WHERE request_id=? AND principal_id=?",
            )
            .get(request, driver.session.id) as { last_id: number }
        ).last_id,
        sent.id,
      );
      assert.deepEqual(restored.pragma("foreign_key_check"), []);
    } finally {
      restored.close();
    }
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test("acceptance keeps only the accepted conversation; closure retains inaccessible records", () => {
  const { db, ride, request, another, rider, driver, now } = fixture();
  try {
    sendMessage(db, ride, request, rider.session.id, "retained", key(1), now);
    decideRequest(db, driver.token, ride, request, "ACCEPT", now);
    assert.equal(
      readConversation(db, ride, request, rider.session.id, now).messages
        .length,
      1,
    );
    assert.throws(
      () => readConversation(db, ride, another, driver.session.id, now),
      /CONVERSATION_CLOSED/,
    );
    for (const status of ["COMPLETED", "CANCELLED", "EXPIRED"]) {
      db.prepare("UPDATE rides SET status=? WHERE public_id=?").run(
        status,
        ride,
      );
      for (const fn of [
        () => readConversation(db, ride, request, rider.session.id, now),
        () =>
          sendMessage(
            db,
            ride,
            request,
            rider.session.id,
            "hello",
            key(2),
            now,
          ),
        () => markMessagesRead(db, ride, request, rider.session.id, 1, now),
        () => stopMessages(db, ride, request, rider.session.id, now),
      ])
        assert.throws(fn, /CONVERSATION_CLOSED/);
      assert.equal(
        conversationSummaries(db, ride, driver.session.id, now).length,
        0,
      );
    }
    assert.equal(
      (
        db.prepare("SELECT count(*) n FROM ride_messages").get() as {
          n: number;
        }
      ).n,
      1,
    );
  } finally {
    db.close();
  }
});
test("declined/withdrawn and expired offers cannot message even before cleanup", () => {
  const { db, ride, request, rider, now } = fixture();
  try {
    for (const status of ["DECLINED", "CANCELLED", "DISCARDED"]) {
      db.prepare("UPDATE ride_requests SET status=? WHERE id=?").run(
        status,
        request,
      );
      assert.throws(
        () => readConversation(db, ride, request, rider.session.id, now),
        /CONVERSATION_CLOSED/,
      );
    }
    db.prepare("UPDATE ride_requests SET status='PENDING' WHERE id=?").run(
      request,
    );
    assert.throws(
      () =>
        readConversation(
          db,
          ride,
          request,
          rider.session.id,
          new Date(now.getTime() + 7 * 3600000),
        ),
      /CONVERSATION_CLOSED/,
    );
  } finally {
    db.close();
  }
});
test("HTTP endpoints require verified participant, reject cross-thread and keep responses no-store", async () => {
  const { db, ride, request, rider, driver } = fixture();
  const api = createApiServer(db, { sampleRides: false });
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const url = `http://127.0.0.1:${(api.address() as { port: number }).port}/api/rides/${ride}/conversations/${request}`;
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (
        await fetch(url, {
          headers: { Authorization: `Bearer ${rider.token}` },
        })
      ).status,
      401,
    );
    const verified = async (unikey: string, principal: string) => {
      let code = "";
      const challenge = await requestUniversityCode(
        db,
        unikey,
        async (_email, c) => {
          code = c;
        },
      );
      const auth = verifyUniversityCode(db, challenge.challengeId, code, null);
      db.prepare(
        "UPDATE university_sessions SET principal_id=? WHERE unikey=?",
      ).run(principal, unikey);
      return auth.token;
    };
    const token = await verified("test1234", rider.session.id);
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const sent = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "private", clientId: key(1) }),
    });
    assert.equal(sent.status, 200, await sent.text());
    const result = await fetch(url, { headers });
    assert.match(result.headers.get("cache-control")!, /no-store/);
    assert.equal((await result.json()).messages[0].text, "private");
    const outsider = await verified("outs1234", "outsider");
    assert.equal(
      (await fetch(url, { headers: { Authorization: `Bearer ${outsider}` } }))
        .status,
      403,
    );
    stopMessages(db, ride, request, driver.session.id);
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ text: "no", clientId: key(2) }),
        })
      ).status,
      409,
    );
  } finally {
    api.closeAllConnections();
    await new Promise<void>((resolve) => api.close(() => resolve()));
    db.close();
  }
});
