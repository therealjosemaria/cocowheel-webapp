import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { once } from "node:events";
import {
  initializeCoreSchema,
  findSession,
  publishRide,
  requestRide,
  cancelRide,
  currentOpenRides,
  createGuestSession,
} from "../server/core";
import {
  normalizeUniKey,
  requestUniversityCode,
  verifyUniversityCode,
  logoutUniversity,
} from "../server/university-auth";
import { createApiServer } from "../server/index";

process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString(
  "base64",
);
function database() {
  const db = new Database(":memory:");
  initializeCoreSchema(db);
  return db;
}
async function login(
  db: Database.Database,
  unikey: string,
  now: number,
  previous: string | null = null,
) {
  let delivered = "";
  const challenge = await requestUniversityCode(
    db,
    unikey,
    async (email, code) => {
      assert.equal(email, `${unikey.toLowerCase()}@uni.sydney.edu.au`);
      delivered = code;
    },
    now,
  );
  assert.ok(!JSON.stringify(challenge).includes(delivered));
  return verifyUniversityCode(
    db,
    challenge.challengeId,
    delivered,
    previous,
    new Date(now),
  );
}
test("UniKey-only input normalizes case and rejects emails and injected recipients", () => {
  assert.equal(normalizeUniKey(" JMOS0905 "), "jmos0905");
  for (const value of [
    "jmos0905@example.com",
    "jmos0905\nbcc:x",
    "admin",
    "jmos0905@uni.sydney.edu.au",
    {},
    null,
  ])
    assert.throws(() => normalizeUniKey(value));
});
test("verification is single use, expires, caps guesses and resends, and never stores plaintext codes", async () => {
  const db = database();
  let code = "";
  const send = async (_email: string, value: string) => {
    code = value;
  };
  const first = await requestUniversityCode(db, "test0001", send, 0);
  const stored = db.prepare("SELECT code_hash FROM university_codes").get() as {
    code_hash: string;
  };
  assert.notEqual(stored.code_hash, code);
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++)
    assert.throws(
      () =>
        verifyUniversityCode(db, first.challengeId, wrong, null, new Date(1)),
      /VERIFICATION_INVALID/,
    );
  assert.throws(
    () => verifyUniversityCode(db, first.challengeId, code, null, new Date(2)),
    /VERIFICATION_INVALID/,
  );
  await assert.rejects(
    requestUniversityCode(db, "test0001", send, 5000),
    /VERIFICATION_RATE_LIMITED/,
  );
  const second = await requestUniversityCode(db, "test0001", send, 60001);
  assert.throws(() =>
    verifyUniversityCode(db, first.challengeId, code, null, new Date(60002)),
  );
  assert.throws(
    () =>
      verifyUniversityCode(
        db,
        second.challengeId,
        code,
        null,
        new Date(660001),
      ),
    /VERIFICATION_INVALID/,
  );
  const third = await requestUniversityCode(db, "test0001", send, 660002);
  const result = verifyUniversityCode(
    db,
    third.challengeId,
    code,
    null,
    new Date(660003),
  );
  assert.equal(
    findSession(db, result.token, new Date(660004))?.alias,
    "test0001",
  );
  assert.throws(() =>
    verifyUniversityCode(db, third.challengeId, code, null, new Date(660004)),
  );
  logoutUniversity(db, result.token);
  assert.equal(findSession(db, result.token, new Date(660005)), null);
  db.close();
});
test("ordinary accounts share history and one role across devices; only verified test UniKey separates devices", async () => {
  const db = database();
  const start = Date.now();
  const now = start + 120000;
  const first = await login(db, "stud0001", start);
  const second = await login(db, "stud0001", start + 60001);
  assert.equal(
    findSession(db, first.token)?.id,
    findSession(db, second.token)?.id,
  );
  const offer = {
    origin: { latitude: -33.87, longitude: 151.2 },
    destination: { latitude: -33.92, longitude: 151.26 },
    scheduledDepartureAt: new Date(now).toISOString(),
    priceAud: 5,
  };
  const ride = publishRide(db, first.token, offer, new Date(now)).ride;
  assert.equal(ride.driverAlias, "stud0001");
  assert.equal(
    currentOpenRides(db, second.token, new Date(now))[0].ride.rideId,
    ride.rideId,
  );
  assert.throws(
    () => publishRide(db, second.token, offer, new Date(now)),
    /OPEN_ITEM_EXISTS/,
  );
  const request = {
    pickup: offer.origin,
    destination: offer.destination,
    requestedDepartureAt: new Date(now).toISOString(),
  };
  assert.throws(
    () => requestRide(db, second.token, ride.rideId, request, new Date(now)),
    /OWN_RIDE_JOIN_NOT_ALLOWED/,
  );
  const testDriver = await login(db, "jmos0905", start);
  const testRider = await login(db, "jmos0905", start + 60001);
  assert.notEqual(
    findSession(db, testDriver.token)?.id,
    findSession(db, testRider.token)?.id,
  );
  const sample = publishRide(db, testDriver.token, offer, new Date(now)).ride;
  assert.throws(
    () => requestRide(db, second.token, sample.rideId, request, new Date(now)),
    /ROLE_CHANGE_REQUIRES_TERMINATION/,
  );
  const joined = requestRide(
    db,
    testRider.token,
    sample.rideId,
    request,
    new Date(now),
  ).ride;
  assert.equal(joined.request?.riderAlias, "jmos0905");
  cancelRide(db, first.token, ride.rideId, new Date(now));
  assert.ok(
    requestRide(db, second.token, sample.rideId, request, new Date(now)).ride
      .request,
  );
  assert.throws(
    () => publishRide(db, first.token, offer, new Date(now)),
    /ROLE_CHANGE_REQUIRES_TERMINATION/,
  );
  assert.equal(
    findSession(db, first.token, new Date(start + 30 * 86400000)),
    null,
  );
  db.close();
});
test("public API cannot publish or join with missing or legacy guest authentication", async () => {
  const db = database();
  const api = createApiServer(db, { sampleRides: false });
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const address = api.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const guest = createGuestSession(db).token;
    for (const route of ["/api/rides", "/api/rides/COCO-ANY/requests"])
      for (const token of ["", guest]) {
        const response = await fetch(base + route, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        });
        assert.equal(response.status, 401);
        assert.equal(
          (await response.json()).error,
          "UNIVERSITY_VERIFICATION_REQUIRED",
        );
      }
    const csrf = await fetch(base + "/api/university/code", {
      method: "POST",
      body: JSON.stringify({ unikey: "jmos0905" }),
    });
    assert.equal(csrf.status, 403);
  } finally {
    api.closeAllConnections();
    await new Promise<void>((resolve) => api.close(() => resolve()));
    db.close();
  }
});
