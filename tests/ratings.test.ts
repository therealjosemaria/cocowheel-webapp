import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createApiServer } from "../server/index";
import {
  requestUniversityCode,
  verifyUniversityCode,
} from "../server/university-auth";
import { openDatabase } from "../server/db";
import {
  initializeCoreSchema,
  publishRide,
  requestRide,
  decideRequest,
  confirmCoRideCode,
  completeCoRide,
  findSession,
  getRide,
  createGuestSession,
} from "../server/core";
import {
  ratingSummary,
  rideRatingState,
  submitRating,
  RATING_WINDOW_MS,
} from "../server/ratings";

const now = new Date("2026-10-19T00:00:00Z");
process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
  "base64",
);
const origin = { latitude: -33.87, longitude: 151.21, label: "Test origin" };
const destination = {
  latitude: -33.92,
  longitude: 151.25,
  label: "Test destination",
};
function setup() {
  const db = openDatabase(":memory:");
  initializeCoreSchema(db);
  return db;
}
function completed(
  db: ReturnType<typeof setup>,
  driverToken?: string,
  riderToken?: string,
) {
  const offer = publishRide(
    db,
    driverToken ?? null,
    {
      origin,
      destination,
      scheduledDepartureAt: now.toISOString(),
      priceAud: 5,
      payId: "driver@example.com",
      payIdType: "EMAIL",
    },
    now,
  );
  const join = requestRide(
    db,
    riderToken ?? null,
    offer.ride.rideId,
    { pickup: origin, destination, requestedDepartureAt: now.toISOString() },
    now,
  );
  offer.sessionToken = offer.sessionToken ?? driverToken!;
  join.sessionToken = join.sessionToken ?? riderToken!;
  const driver = findSession(db, offer.sessionToken, now)!;
  const rider = findSession(db, join.sessionToken, now)!;
  const id = offer.ride.rideId;
  decideRequest(
    db,
    offer.sessionToken,
    id,
    join.ride.request!.requestId,
    "ACCEPT",
    now,
  );
  const code = getRide(db, id, rider, now).coRideCode!;
  confirmCoRideCode(db, offer.sessionToken, id, code, now);
  completeCoRide(db, offer.sessionToken, id, null, now, true);
  return {
    id,
    driver,
    rider,
    driverToken: offer.sessionToken,
    riderToken: join.sessionToken,
  };
}

test("ratings validate participants, scores, eligibility and immutable idempotent submission", () => {
  const db = setup();
  try {
    const f = completed(db);
    const outsider = createGuestSession(db, now).session;
    assert.throws(
      () => submitRating(db, f.id, outsider.id, 5, now),
      /RIDE_ACCESS_DENIED/,
    );
    for (const invalid of [0, 6, -1, 2.5, "5", null, {}, NaN, Infinity])
      assert.throws(
        () => submitRating(db, f.id, f.driver.id, invalid, now),
        /INVALID_RATING/,
      );
    assert.equal(getRide(db, f.id, f.driver, now).rating?.canRate, true);
    assert.equal(submitRating(db, f.id, f.driver.id, 4, now)?.submitted, true);
    assert.equal(submitRating(db, f.id, f.driver.id, 4, now)?.submitted, true);
    assert.throws(
      () => submitRating(db, f.id, f.driver.id, 5, now),
      /RATING_ALREADY_SUBMITTED/,
    );
    assert.equal(getRide(db, f.id, f.rider, now).rating?.submitted, false);
    assert.equal(
      JSON.stringify(getRide(db, f.id, f.rider, now)).includes('"score"'),
      false,
    );
    assert.equal(
      (db.prepare("SELECT count(*) n FROM ride_ratings").get() as { n: number })
        .n,
      1,
    );
    initializeCoreSchema(db);
    assert.equal(rideRatingState(db, f.id, f.driver.id, now)?.submitted, true);
    for (const status of [
      "ACCEPTED",
      "CO_RIDE_ACTIVE",
      "CANCELLED",
      "EXPIRED",
    ]) {
      db.prepare("UPDATE rides SET status = ? WHERE public_id = ?").run(
        status,
        f.id,
      );
      assert.throws(
        () => submitRating(db, f.id, f.rider.id, 5, now),
        /RATING_UNAVAILABLE/,
      );
    }
    db.prepare(
      "UPDATE rides SET status = 'COMPLETED', is_sample = 1 WHERE public_id = ?",
    ).run(f.id);
    assert.throws(
      () => submitRating(db, f.id, f.rider.id, 5, now),
      /RATING_UNAVAILABLE/,
    );
    db.prepare(
      "UPDATE rides SET is_sample = 0, co_ride_started_at = NULL WHERE public_id = ?",
    ).run(f.id);
    assert.throws(
      () => submitRating(db, f.id, f.rider.id, 5, now),
      /RATING_UNAVAILABLE/,
    );
  } finally {
    db.close();
  }
});

test("ten released ratings are required per role, mutual release and seven-day deadline", () => {
  const db = setup();
  try {
    let f = completed(db);
    const first = f;
    for (let i = 0; i < 10; i++) {
      if (i) f = completed(db, first.driverToken, first.riderToken);
      submitRating(db, f.id, f.rider.id, i === 9 ? 1 : 5, now);
      assert.equal(ratingSummary(db, f.driver.id, "DRIVER", now), null);
      if (i < 9) submitRating(db, f.id, f.driver.id, 4, now);
    }
    assert.equal(ratingSummary(db, f.rider.id, "RIDER", now), null);
    const before = new Date(now.getTime() + RATING_WINDOW_MS - 1);
    assert.equal(ratingSummary(db, f.driver.id, "DRIVER", before), null);
    const deadline = new Date(now.getTime() + RATING_WINDOW_MS);
    assert.deepEqual(ratingSummary(db, f.driver.id, "DRIVER", deadline), {
      average: 4.6,
      count: 10,
    });
    assert.equal(
      rideRatingState(db, f.id, f.driver.id, deadline)?.canRate,
      false,
    );
    assert.throws(
      () => submitRating(db, f.id, f.driver.id, 4, deadline),
      /RATING_WINDOW_CLOSED/,
    );
    // Test mutual release using an earlier clock, before the window closes.
    submitRating(db, f.id, f.driver.id, 4, before);
    assert.deepEqual(ratingSummary(db, f.driver.id, "DRIVER", before), {
      average: 4.6,
      count: 10,
    });
    assert.deepEqual(ratingSummary(db, f.rider.id, "RIDER", before), {
      average: 4,
      count: 10,
    });
    assert.equal(ratingSummary(db, f.driver.id, "RIDER", deadline), null);
    assert.equal(ratingSummary(db, f.rider.id, "DRIVER", deadline), null);
  } finally {
    db.close();
  }
});

test("ratings HTTP requires verified account, scopes recipients and protects retries across devices", async () => {
  const db = setup();
  const server = createApiServer(db, { sampleRides: false });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  async function login(unikey: string, at = new Date()) {
    let code = "";
    const challenge = await requestUniversityCode(
      db,
      unikey,
      async (_email, value) => {
        code = value;
      },
      at.getTime(),
    );
    return verifyUniversityCode(db, challenge.challengeId, code, null, at)
      .token;
  }
  try {
    const driverToken = await login("rate0001");
    const riderToken = await login("rate0002");
    const f = completed(db, driverToken, riderToken);
    // Keep HTTP fixture completion relative to real server time.
    db.prepare("UPDATE rides SET completed_at = ? WHERE public_id = ?").run(
      new Date().toISOString(),
      f.id,
    );
    async function post(
      token?: string,
      score: unknown = 5,
      originValue = "http://localhost:3000",
    ) {
      return fetch(`${base}/api/rides/${f.id}/ratings`, {
        method: "POST",
        headers: {
          Origin: originValue,
          "Content-Type": "application/json",
          ...(token ? { Cookie: `cocowheels_guest=${token}` } : {}),
        },
        body: JSON.stringify({
          score,
          recipient_id: "forged",
          recipient_role: "RIDER",
        }),
      });
    }
    assert.equal((await post()).status, 401);
    const guest = createGuestSession(db).token;
    assert.equal((await post(guest)).status, 401);
    const stranger = await login("rate0003");
    assert.equal((await post(stranger)).status, 403);
    assert.equal(
      (await post(riderToken, 5, "https://attacker.invalid")).status,
      403,
    );
    assert.equal((await post(riderToken, "5")).status, 400);
    const responses = await Promise.all([post(riderToken), post(riderToken)]);
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control")!, /no-store/);
      const data = await response.json();
      assert.equal(data.rating.submitted, true);
      assert.equal(data.rating.score, undefined);
    }
    const secondDevice = await login("rate0002", new Date(Date.now() + 61_000));
    assert.equal((await post(secondDevice, 1)).status, 409);
    assert.equal((await post(driverToken, 4)).status, 200);
    const stored = db
      .prepare(
        "SELECT recipient_id, recipient_role, score FROM ride_ratings WHERE rater_id = ?",
      )
      .get(f.rider.id) as {
      recipient_id: string;
      recipient_role: string;
      score: number;
    };
    assert.deepEqual(stored, {
      recipient_id: f.driver.id,
      recipient_role: "DRIVER",
      score: 5,
    });
    const session = await fetch(`${base}/api/university/session`, {
      headers: { Cookie: `cocowheels_guest=${driverToken}` },
    });
    assert.deepEqual((await session.json()).ratings, {
      driver: null,
      rider: null,
    });
  } finally {
    server.close();
    server.closeAllConnections();
    await once(server, "close");
    db.close();
  }
});
