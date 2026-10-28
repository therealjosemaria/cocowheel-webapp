import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  initializeCoreSchema,
  createGuestSession,
  findSession,
  getRide,
  cancelRide,
  publishRide,
  requestRide,
  decideRequest,
} from "../server/core";
import {
  postDemand,
  searchDemands,
  offerDemand,
  respondToDemandOffer,
  cancelDemand,
  demandActivity,
  pendingDemandOffers,
  activeDemand,
} from "../server/rider-demands";
import {
  checkedDemandRoute,
  demandExpiry,
  demandWindows,
} from "../lib/rider-demand";
import { initialDeparture, sydneyInstant } from "../lib/ride-schedule";
import { createApiServer } from "../server/index";
import { saveVehicle } from "../server/vehicles";
process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
  "base64",
);
const now = new Date("2026-10-25T00:00:00Z");
const origin = { latitude: -33.91, longitude: 151.18, label: "Example origin" };
const destination = {
  latitude: -33.86,
  longitude: 151.21,
  label: "Example destination",
};
const route = { origin, destination, date: "any", time: "" };
function fixture() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  initializeCoreSchema(db);
  function account(name: string) {
    const guest = createGuestSession(db);
    db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(
      name,
      guest.session.id,
      now.toISOString(),
    );
    const token = `verified-${name}`;
    db.prepare("INSERT INTO university_sessions VALUES (?,?,?,?)").run(
      createHash("sha256").update(token).digest("hex"),
      name,
      guest.session.id,
      "2099-01-01T00:00:00Z",
    );
    return { token, session: findSession(db, token)! };
  }
  const rider = account("rider01"),
    driver = account("driver01"),
    other = account("other01");
  return { db, rider, driver, other };
}
const offerBody = {
  ...route,
  scheduledDepartureAt: "2026-10-25T01:00:00.000Z",
  priceAud: 0,
  plate: "ABC123",
};

test("posted driver can propose a distinct journey, then replace atomically at acceptance", () => {
  const { db, rider, driver, other } = fixture();
  try {
    const source = publishRide(db, driver.token, { ...offerBody, origin: { latitude: -34.4, longitude: 150.9 }, destination: { latitude: -34.2, longitude: 150.8 } }, now).ride;
    const waiting = requestRide(db, other.token, source.rideId, { pickup: origin, destination, requestedDepartureAt: offerBody.scheduledDepartureAt }, now);
    const requested = postDemand(db, rider.token, route, now);
    assert.throws(() => offerDemand(db, driver.token, requested.id, offerBody, now), /POSTED_JOURNEY_REPLACEMENT_REQUIRED/);
    assert.throws(() => offerDemand(db, driver.token, requested.id, { ...offerBody, replacePostedRideId: "wrong" }, now), /POSTED_JOURNEY_REPLACEMENT_REQUIRED/);
    const body = { ...offerBody, replacePostedRideId: source.rideId };
    const offered = offerDemand(db, driver.token, requested.id, body, now);
    assert.equal(offered.pendingReplacement, true);
    assert.equal(offered.rideId, "");
    assert.deepEqual(offered.origin, origin);
    assert.equal(offerDemand(db, driver.token, requested.id, body, now).id, offered.id);
    assert.equal(pendingDemandOffers(db, rider.token, now), 1);
    assert.equal((db.prepare("SELECT count(*) n FROM rides").get() as { n: number }).n, 1);
    assert.equal(getRide(db, source.rideId, driver.session, now).status, "REQUESTED");
    assert.throws(() => respondToDemandOffer(db, other.token, offered.id, "ACCEPT", now), /RIDE_ACCESS_DENIED/);
    const paired = respondToDemandOffer(db, rider.token, offered.id, "ACCEPT", now)!;
    assert.notEqual(paired.rideId, source.rideId);
    assert.equal(paired.status, "ACCEPTED");
    assert.equal(paired.request?.status, "ACCEPTED");
    assert.equal(getRide(db, source.rideId, driver.session, now).cancellationReason, "JOURNEY_REPLACED");
    assert.equal(getRide(db, source.rideId, other.session, now).request?.status, "DISCARDED");
    assert.ok(waiting.ride.request);
    assert.equal(respondToDemandOffer(db, rider.token, offered.id, "ACCEPT", now)!.rideId, paired.rideId);
    assert.equal(demandActivity(db, driver.token, now).sent.filter(item => item.id === offered.id).length, 1);
    assert.equal(pendingDemandOffers(db, rider.token, now), 0);
    assert.equal((db.prepare("SELECT count(*) n FROM rides WHERE status='ACCEPTED'").get() as { n: number }).n, 1);
  } finally { db.close(); }
});

test("public acceptance wins over pending proposals, even after that journey closes", () => {
  const { db, rider, driver, other } = fixture();
  try {
    const source = publishRide(db, driver.token, offerBody, now).ride;
    const requested = postDemand(db, rider.token, route, now);
    const offered = offerDemand(db, driver.token, requested.id, { ...offerBody, replacePostedRideId: source.rideId }, now);
    const joined = requestRide(db, other.token, source.rideId, { pickup: origin, destination, requestedDepartureAt: offerBody.scheduledDepartureAt }, now);
    decideRequest(db, driver.token, source.rideId, joined.ride.request!.requestId, "ACCEPT", now);
    assert.equal(pendingDemandOffers(db, rider.token, now), 0);
    assert.equal(demandActivity(db, rider.token, now).requests[0].offers[0].status, "UNAVAILABLE");
    assert.throws(() => respondToDemandOffer(db, rider.token, offered.id, "ACCEPT", now), /DEMAND_UNAVAILABLE/);
    cancelRide(db, driver.token, source.rideId, now);
    assert.throws(() => respondToDemandOffer(db, rider.token, offered.id, "ACCEPT", now), /DEMAND_UNAVAILABLE/);
  } finally { db.close(); }
});

test("declining or expiring a proposal leaves the public journey unchanged", () => {
  const { db, rider, driver } = fixture();
  try {
    const source = publishRide(db, driver.token, offerBody, now).ride;
    const requested = postDemand(db, rider.token, route, now);
    const body = { ...offerBody, replacePostedRideId: source.rideId };
    const offered = offerDemand(db, driver.token, requested.id, body, now);
    respondToDemandOffer(db, rider.token, offered.id, "DECLINE", now);
    assert.equal(getRide(db, source.rideId, driver.session, now).status, "PUBLISHED");
    const next = offerDemand(db, driver.token, requested.id, body, now);
    assert.notEqual(next.id, offered.id);
    const later = new Date("2026-10-25T01:01:00Z");
    assert.throws(() => respondToDemandOffer(db, rider.token, next.id, "ACCEPT", later), /DEMAND_UNAVAILABLE/);
    assert.equal(getRide(db, source.rideId, driver.session, later).status, "PUBLISHED");
  } finally { db.close(); }
});

test("one proposal wins, paid details stay private, and the losing proposal cannot replace the winner", () => {
  const { db, rider, driver, other } = fixture();
  try {
    const source = publishRide(db, driver.token, offerBody, now).ride;
    const first = postDemand(db, rider.token, route, now);
    const second = postDemand(db, other.token, route, now);
    const body = { ...offerBody, replacePostedRideId: source.rideId, priceAud: 5, payId: "driver@example.com", payIdType: "EMAIL" };
    const a = offerDemand(db, driver.token, first.id, body, now);
    const b = offerDemand(db, driver.token, second.id, body, now);
    assert.equal(JSON.stringify(demandActivity(db, rider.token, now)).includes("driver@example.com"), false);
    assert.equal(a.priceAud, 5);
    const paired = respondToDemandOffer(db, rider.token, a.id, "ACCEPT", now)!;
    assert.equal(paired.priceAud, 5);
    assert.throws(() => respondToDemandOffer(db, other.token, b.id, "ACCEPT", now), /DEMAND_UNAVAILABLE/);
    assert.equal(demandActivity(db, other.token, now).requests[0].offers[0].status, "UNAVAILABLE");
    assert.equal((db.prepare("SELECT count(*) n FROM rides WHERE status='ACCEPTED'").get() as { n: number }).n, 1);
  } finally { db.close(); }
});

test("failed replacement acceptance rolls back the old journey and all pending request changes", () => {
  const { db, rider, driver, other } = fixture();
  try {
    const source = publishRide(db, driver.token, offerBody, now).ride;
    requestRide(db, other.token, source.rideId, { pickup: origin, destination, requestedDepartureAt: offerBody.scheduledDepartureAt }, now);
    const requested = postDemand(db, rider.token, route, now);
    const offered = offerDemand(db, driver.token, requested.id, { ...offerBody, replacePostedRideId: source.rideId }, now);
    db.exec("CREATE TRIGGER fail_pair BEFORE UPDATE OF status ON rides WHEN NEW.status='ACCEPTED' BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
    assert.throws(() => respondToDemandOffer(db, rider.token, offered.id, "ACCEPT", now), /injected failure/);
    assert.equal(getRide(db, source.rideId, driver.session, now).status, "REQUESTED");
    assert.equal(getRide(db, source.rideId, other.session, now).request?.status, "PENDING");
    assert.equal((db.prepare("SELECT count(*) n FROM rides").get() as { n: number }).n, 1);
    assert.equal(demandActivity(db, rider.token, now).requests[0].offers[0].status, "PENDING");
    db.exec("DROP TRIGGER fail_pair");
    assert.equal(respondToDemandOffer(db, rider.token, offered.id, "ACCEPT", now)!.status, "ACCEPTED");
  } finally { db.close(); }
});
test("rider contributions validate, survive discovery/replacement/history, and do not set the driver's fare", () => {
  const { db, rider, driver } = fixture();
  try {
    for (const amount of [-1, 0.5, 10000.01, 1.001, NaN, Infinity, null, "10", true]) {
      assert.throws(() => postDemand(db, rider.token, { ...route, offeredContributionAud: amount }, now), /INVALID_FIXED_PRICE/);
    }
    const legacy = postDemand(db, rider.token, route, now);
    assert.equal(legacy.offeredContributionAud, undefined);
    assert.equal(postDemand(db, rider.token, { ...route, offeredContributionAud: 0 }, now).id, legacy.id);
    let previous = legacy;
    for (const amount of [1, 10.25, 10000]) {
      assert.throws(() => postDemand(db, rider.token, { ...route, offeredContributionAud: amount }, now), /DEMAND_ALREADY_OPEN/);
      const next = postDemand(db, rider.token, { ...route, offeredContributionAud: amount, replaceDemandId: previous.id }, now);
      assert.equal(next.offeredContributionAud, amount);
      assert.equal(postDemand(db, rider.token, { ...route, offeredContributionAud: amount }, now).id, next.id);
      assert.equal(searchDemands(db, driver.token, route, now)[0].offeredContributionAud, amount);
      const historical = demandActivity(db, rider.token, now).requests.find(item => item.id === previous.id)!;
      assert.equal(historical.status, "CANCELLED");
      assert.equal(historical.offeredContributionAud, previous.offeredContributionAud);
      previous = next;
    }
    const offered = offerDemand(db, driver.token, previous.id, offerBody, now);
    assert.equal(offered.priceAud, 0);
    assert.equal(offered.status, "PENDING");
    assert.equal(activeDemand(db, rider.token, now)?.status, "OPEN");
    respondToDemandOffer(db, rider.token, offered.id, "ACCEPT", now);
    assert.equal(demandActivity(db, rider.token, now).requests.find(item => item.id === previous.id)!.offeredContributionAud, 10000);
    assert.equal(getRide(db, offered.rideId, rider.session, now).priceAud, 0);
  } finally { db.close(); }
});
test("ordinary acceptance fulfils the public post and prevents accepting another invitation", () => {
  const { db, rider, driver, other } = fixture();
  try {
    const posted = postDemand(db, rider.token, route, now);
    const first = publishRide(db, driver.token, offerBody, now).ride;
    const joined = requestRide(db, rider.token, first.rideId, { pickup: origin, destination, requestedDepartureAt: offerBody.scheduledDepartureAt }, now);
    assert.equal(activeDemand(db, rider.token, now)?.id, posted.id);
    assert.equal(activeDemand(db, other.token, now), null);
    assert.equal(searchDemands(db, other.token, route, now).length, 1);
    const alternative = offerDemand(db, other.token, posted.id, offerBody, now);
    assert.equal(demandActivity(db, rider.token, now).requests[0].status, "OPEN");
    decideRequest(db, driver.token, first.rideId, joined.ride.request!.requestId, "ACCEPT", now);
    assert.equal(demandActivity(db, rider.token, now).requests[0].status, "FULFILLED");
    assert.equal(demandActivity(db, rider.token, now).requests[0].offers[0].status, "UNAVAILABLE");
    assert.equal(activeDemand(db, rider.token, now), null);
    assert.equal(pendingDemandOffers(db, rider.token, now), 0);
    assert.throws(() => respondToDemandOffer(db, rider.token, alternative.id, "ACCEPT", now), /DEMAND_UNAVAILABLE/);
    assert.equal(db.prepare("SELECT count(*) n FROM rides WHERE status='ACCEPTED'").get()!.n, 1);
  } finally { db.close(); }
});

test("accepting an invitation rolls pending join withdrawal back on failure, then wins against stale acceptance", () => {
  const { db, rider, driver, other } = fixture();
  try {
    const first = publishRide(db, driver.token, offerBody, now).ride;
    const joined = requestRide(db, rider.token, first.rideId, { pickup: origin, destination, requestedDepartureAt: offerBody.scheduledDepartureAt }, now);
    const posted = postDemand(db, rider.token, route, now); // Posting after a pending join is allowed too.
    const alternative = offerDemand(db, other.token, posted.id, offerBody, now);
    db.exec("CREATE TRIGGER fail_accept BEFORE UPDATE OF status ON rides WHEN NEW.status='ACCEPTED' BEGIN SELECT RAISE(ABORT,'TEST_FAILURE'); END");
    assert.throws(() => respondToDemandOffer(db, rider.token, alternative.id, "ACCEPT", now), /TEST_FAILURE/);
    assert.equal(getRide(db, first.rideId, rider.session, now).request!.status, "PENDING");
    assert.equal(demandActivity(db, rider.token, now).requests[0].status, "OPEN");
    db.exec("DROP TRIGGER fail_accept");
    respondToDemandOffer(db, rider.token, alternative.id, "ACCEPT", now);
    assert.throws(() => decideRequest(db, driver.token, first.rideId, joined.ride.request!.requestId, "ACCEPT", now), /REQUEST_UNAVAILABLE/);
    assert.equal(getRide(db, first.rideId, driver.session, now).status, "PUBLISHED");
    assert.equal(demandActivity(db, rider.token, now).requests[0].status, "FULFILLED");
    assert.equal(respondToDemandOffer(db, rider.token, alternative.id, "ACCEPT", now)!.status, "ACCEPTED");
  } finally { db.close(); }
});

test("discovery accepts optional endpoints without weakening publication or access rules", () => {
  const { db, rider, driver, other } = fixture();
  const any = { date: "any", time: "" };
  const far = { latitude: -37.8, longitude: 145 };
  try {
    const near = postDemand(db, rider.token, route, now);
    const distant = postDemand(db, other.token, { ...route, origin: far, destination: far }, now);
    assert.equal(searchDemands(db, driver.token, any, now).length, 2);
    assert.deepEqual(searchDemands(db, driver.token, { ...any, origin }, now).map(r => r.id), [near.id]);
    assert.deepEqual(searchDemands(db, driver.token, { ...any, destination }, now).map(r => r.id), [near.id]);
    const ownResults = searchDemands(db, rider.token, any, now);
    assert.deepEqual(new Set(ownResults.map(r => r.id)), new Set([near.id, distant.id]));
    assert.equal(ownResults.find(r => r.id === near.id)?.isOwn, true);
    assert.equal(ownResults.find(r => r.id === distant.id)?.isOwn, false);
    assert.equal(searchDemands(db, driver.token, any, now).every(r => r.isOwn === false), true);
    assert.equal(searchDemands(db, rider.token, { ...any, date: "2026-10-29" }, now).length, 0);
    assert.equal(searchDemands(db, driver.token, { ...any, origin: { ...origin, latitude: origin.latitude + .02 } }, now).length, 0);
    assert.equal(searchDemands(db, driver.token, { ...any, destination: { ...destination, latitude: destination.latitude + .03 } }, now).length, 0);
    assert.equal(searchDemands(db, driver.token, { ...any, date: "2026-10-29" }, now).length, 0);
    assert.throws(() => searchDemands(db, null, any, now), /VERIFICATION_REQUIRED/);
    for (const invalid of [null, {}, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }]) {
      assert.throws(() => searchDemands(db, driver.token, { ...any, origin: invalid }, now), /INVALID_DEMAND/);
    }
    assert.throws(() => postDemand(db, driver.token, any, now), /INVALID_DEMAND/);
    // A direct response takes its endpoints from the requested journey, not client filters.
    assert.deepEqual(offerDemand(db, driver.token, near.id, { ...offerBody, origin: undefined }, now).origin, origin);
    cancelDemand(db, other.token, distant.id, now);
    assert.equal(searchDemands(db, driver.token, any, now).length, 1);
    assert.equal(searchDemands(db, driver.token, any, new Date(+now + 48 * 3600000)).length, 0);
  } finally { db.close(); }
});
test("switching from a lift request requires exact consent and rolls back failed publication", () => {
  const { db, rider, driver } = fixture();
  try {
    const posted = postDemand(db, rider.token, route, now);
    assert.throws(() => publishRide(db, rider.token, offerBody, now), /LIFT_REQUEST_WITHDRAWAL_REQUIRED/);
    assert.throws(() => publishRide(db, rider.token, { ...offerBody, withdrawLiftRequestId: "wrong" }, now), /LIFT_REQUEST_WITHDRAWAL_REQUIRED/);
    db.exec("CREATE TRIGGER fail_offer BEFORE INSERT ON rides BEGIN SELECT RAISE(ABORT, 'TEST_FAILURE'); END");
    assert.throws(() => publishRide(db, rider.token, { ...offerBody, withdrawLiftRequestId: posted.id }, now), /TEST_FAILURE/);
    assert.equal(demandActivity(db, rider.token, now).requests[0].status, "OPEN");
    db.exec("DROP TRIGGER fail_offer");
    cancelDemand(db, rider.token, posted.id, now);
    const replacement = postDemand(db, rider.token, route, now);
    assert.throws(() => publishRide(db, rider.token, { ...offerBody, withdrawLiftRequestId: posted.id }, now), /LIFT_REQUEST_WITHDRAWAL_REQUIRED/);
    publishRide(db, rider.token, { ...offerBody, withdrawLiftRequestId: replacement.id }, now);
    assert.ok(demandActivity(db, rider.token, now).requests.every(r => r.status === "CANCELLED"));
    assert.equal(searchDemands(db, driver.token, route, now).length, 0);
  } finally { db.close(); }
});
test("responding as a driver also requires withdrawal consent for the driver's own lift request", () => {
  const { db, rider, driver } = fixture();
  try {
    const target = postDemand(db, rider.token, route, now);
    const own = postDemand(db, driver.token, route, now);
    assert.throws(() => offerDemand(db, driver.token, target.id, offerBody, now), /LIFT_REQUEST_WITHDRAWAL_REQUIRED/);
    assert.equal(demandActivity(db, driver.token, now).requests[0].status, "OPEN");
    offerDemand(db, driver.token, target.id, { ...offerBody, withdrawLiftRequestId: own.id }, now);
    assert.equal(demandActivity(db, driver.token, now).requests[0].status, "CANCELLED");
    assert.equal(demandActivity(db, rider.token, now).requests[0].status, "OPEN");
  } finally { db.close(); }
});
test("demand schedules preserve any-date/time independence and Sydney expiry", () => {
  assert.equal(demandExpiry(route, now), "2026-10-27T00:00:00.000Z");
  assert.equal(
    demandExpiry({ ...route, date: "2026-10-25" }, now),
    "2026-10-25T13:00:00.000Z",
  );
  assert.equal(
    demandExpiry({ ...route, date: "2026-10-25", time: "12:00" }, now),
    "2026-10-25T02:00:00.000Z",
  );
  const windows = demandWindows(
    { ...route, time: "12:00" },
    now,
    demandExpiry(route, now),
  );
  assert.equal(windows.length, 2);
  assert.equal(windows[0][1] - windows[0][0], 2 * 3600000);
  assert.throws(
    () => checkedDemandRoute({ ...route, date: "2026-02-30" }, now),
    /INVALID_REQUEST_TIME/,
  );
  assert.throws(
    () =>
      checkedDemandRoute(
        { ...route, origin: { latitude: NaN, longitude: 0 } },
        now,
      ),
    /INVALID_DEMAND/,
  );
  assert.throws(
    () => checkedDemandRoute({ ...route, date: "2027-02-01" }, now),
    /INVALID_REQUEST_TIME/,
  );
  const beforeDST = new Date("2026-10-03T00:00:00Z");
  assert.throws(
    () =>
      checkedDemandRoute(
        { ...route, date: "2026-10-04", time: "02:30" },
        beforeDST,
      ),
    /INVALID_REQUEST_TIME/,
  );
});
test("replacing a post needs exact consent, retains history and rolls back on failure", () => {
  const { db, rider, driver, other } = fixture();
  try {
    const original = postDemand(db, rider.token, route, now);
    const foreign = postDemand(db, other.token, route, now);
    const oldOffer = offerDemand(db, driver.token, original.id, offerBody, now);
    const changed = { ...route, time: "12:00" };
    assert.throws(() => postDemand(db, rider.token, changed, now), /DEMAND_ALREADY_OPEN/);
    assert.throws(() => postDemand(db, rider.token, { ...changed, replaceDemandId: foreign.id }, now), /DEMAND_CHANGED/);
    db.exec("CREATE TRIGGER fail_post BEFORE INSERT ON rider_demands BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    assert.throws(() => postDemand(db, rider.token, { ...changed, replaceDemandId: original.id }, now), /test failure/);
    assert.equal(activeDemand(db, rider.token, now)?.id, original.id);
    db.exec("DROP TRIGGER fail_post");
    const replaced = postDemand(db, rider.token, { ...changed, replaceDemandId: original.id }, now);
    assert.notEqual(replaced.id, original.id);
    assert.equal(demandActivity(db, rider.token, now).requests.find(p => p.id === original.id)?.status, "CANCELLED");
    assert.equal(demandActivity(db, rider.token, now).requests.find(p => p.id === original.id)?.offers[0].status, "UNAVAILABLE");
    assert.throws(() => respondToDemandOffer(db, rider.token, oldOffer.id, "ACCEPT", now), /DEMAND_UNAVAILABLE/);
    assert.equal(activeDemand(db, other.token, now)?.id, foreign.id);
    assert.equal(postDemand(db, rider.token, { ...changed, replaceDemandId: original.id }, now).id, replaced.id);
    assert.throws(() => postDemand(db, rider.token, { ...route, replaceDemandId: original.id }, now), /DEMAND_CHANGED/);
    cancelDemand(db, rider.token, replaced.id, now);
    assert.throws(() => postDemand(db, rider.token, { ...route, replaceDemandId: replaced.id }, now), /DEMAND_CHANGED/);
  } finally { db.close(); }
});

test("posting, idempotency, private activity, route and time matching, cancellation and expiry", () => {
  const { db, rider, driver, other } = fixture();
  try {
    assert.throws(
      () => postDemand(db, null, route, now),
      /VERIFICATION_REQUIRED/,
    );
    const posted = postDemand(db, rider.token, route, now);
    assert.equal(
      postDemand(db, rider.token, route, new Date(+now + 60000)).expiresAt,
      posted.expiresAt,
    );
    assert.throws(
      () => postDemand(db, rider.token, { ...route, time: "12:00" }, now),
      /DEMAND_ALREADY_OPEN/,
    );
    assert.equal(searchDemands(db, rider.token, route, now)[0].isOwn, true);
    assert.equal(searchDemands(db, driver.token, route, now).length, 1);
    assert.equal(
      searchDemands(
        db,
        driver.token,
        { ...route, origin: destination, destination: origin },
        now,
      ).length,
      0,
    );
    assert.equal(
      searchDemands(db, driver.token, { ...route, date: "2026-10-29" }, now)
        .length,
      0,
    );
    assert.equal(demandActivity(db, other.token, now).requests.length, 0);
    assert.throws(
      () => cancelDemand(db, other.token, posted.id, now),
      /RIDE_ACCESS_DENIED/,
    );
    cancelDemand(db, rider.token, posted.id, now);
    assert.equal(searchDemands(db, driver.token, route, now).length, 0);
    assert.equal(searchDemands(db, rider.token, route, now).length, 0);
    const again = postDemand(db, rider.token, route, now);
    assert.notEqual(again.id, posted.id);
    assert.equal(searchDemands(db, rider.token, route, new Date(+now + 48 * 3600000)).length, 0);
    assert.equal(
      searchDemands(db, driver.token, route, new Date(+now + 48 * 3600000))
        .length,
      0,
    );
    assert.equal(
      demandActivity(db, rider.token, new Date(+now + 48 * 3600000)).requests
        .length,
      2,
    );
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  } finally {
    db.close();
  }
});
test("driver offer requires plate, leaves no partial ride on failure, and acceptance reuses pickup and vehicle", () => {
  const { db, rider, driver, other } = fixture();
  try {
    const demand = postDemand(db, rider.token, route, now);
    assert.throws(
      () =>
        offerDemand(
          db,
          driver.token,
          demand.id,
          { ...offerBody, plate: undefined },
          now,
        ),
      /VEHICLE_PLATE_REQUIRED/,
    );
    assert.throws(
      () =>
        offerDemand(
          db,
          driver.token,
          demand.id,
          { ...offerBody, priceAud: 2, payId: 3 },
          now,
        ),
      /INVALID_PAYID/,
    );
    assert.equal(
      (db.prepare("SELECT count(*) n FROM rides").get() as { n: number }).n,
      0,
    );
    assert.throws(
      () => offerDemand(db, rider.token, demand.id, offerBody, now),
      /OWN_RIDE/,
    );
    const offer = offerDemand(db, driver.token, demand.id, offerBody, now);
    assert.equal(
      offerDemand(db, driver.token, demand.id, offerBody, now).id,
      offer.id,
    );
    assert.equal(pendingDemandOffers(db, rider.token, now), 1);
    assert.equal(pendingDemandOffers(db, other.token, now), 0);
    assert.throws(
      () => respondToDemandOffer(db, other.token, offer.id, "ACCEPT", now),
      /RIDE_ACCESS_DENIED/,
    );
    const ride = respondToDemandOffer(
      db,
      rider.token,
      offer.id,
      "ACCEPT",
      now,
    )!;
    assert.equal(ride.status, "ACCEPTED");
    assert.equal(ride.vehicle?.plate, "ABC123");
    assert.ok(ride.coRideCode);
    assert.equal(
      respondToDemandOffer(db, rider.token, offer.id, "ACCEPT", now)!.rideId,
      ride.rideId,
    );
    assert.equal(pendingDemandOffers(db, rider.token, now), 0);
    assert.equal(
      demandActivity(db, rider.token, now).requests[0].status,
      "FULFILLED",
    );
    assert.throws(
      () => getRide(db, ride.rideId, other.session, now),
      /RIDE_ACCESS_DENIED/,
    );
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  } finally {
    db.close();
  }
});
test("decline does not cancel the driver's ride; cancelling or competing acceptance invalidates invitations", () => {
  const { db, rider, driver, other } = fixture();
  try {
    const demand = postDemand(db, rider.token, route, now);
    const offer = offerDemand(db, driver.token, demand.id, offerBody, now);
    respondToDemandOffer(db, rider.token, offer.id, "DECLINE", now);
    assert.equal(
      getRide(db, offer.rideId, driver.session, now).status,
      "PUBLISHED",
    );
    assert.throws(
      () => respondToDemandOffer(db, rider.token, offer.id, "ACCEPT", now),
      /DEMAND_UNAVAILABLE/,
    );
    cancelRide(db, driver.token, offer.rideId, now);
    const second = offerDemand(db, driver.token, demand.id, offerBody, now);
    cancelDemand(db, rider.token, demand.id, now);
    assert.throws(
      () => respondToDemandOffer(db, rider.token, second.id, "ACCEPT", now),
      /DEMAND_UNAVAILABLE/,
    );
    assert.equal(
      getRide(db, second.rideId, driver.session, now).status,
      "PUBLISHED",
    );
    assert.equal(
      demandActivity(db, rider.token, now).requests[0].offers.find(
        (o) => o.id === second.id,
      )!.status,
      "UNAVAILABLE",
    );
    assert.equal(searchDemands(db, other.token, route, now).length, 0);
  } finally {
    db.close();
  }
});
test("paid offer hides PayID, replaces a pending join on acceptance and enforces time fit", () => {
  const { db, rider, driver, other } = fixture();
  try {
    const demand = postDemand(
      db,
      rider.token,
      { ...route, date: "2026-10-25", time: "12:00" },
      now,
    );
    assert.throws(
      () =>
        offerDemand(
          db,
          driver.token,
          demand.id,
          { ...offerBody, scheduledDepartureAt: "2026-10-25T04:00:00Z" },
          now,
        ),
      /REQUEST_TIME_INCOMPATIBLE/,
    );
    const offer = offerDemand(
      db,
      driver.token,
      demand.id,
      {
        ...offerBody,
        priceAud: 2,
        payId: "driver@example.com",
        payIdType: "EMAIL",
      },
      now,
    );
    assert.equal(
      JSON.stringify(demandActivity(db, rider.token, now)).includes(
        "driver@example.com",
      ),
      false,
    );
    const elsewhere = publishRide(db, other.token, { ...offerBody }, now).ride;
    requestRide(
      db,
      rider.token,
      elsewhere.rideId,
      {
        pickup: origin,
        destination,
        requestedDepartureAt: offerBody.scheduledDepartureAt,
      },
      now,
    );
    assert.equal(respondToDemandOffer(db, rider.token, offer.id, "ACCEPT", now)!.status, "ACCEPTED");
    assert.equal(getRide(db, elsewhere.rideId, rider.session, now).request?.status, "CANCELLED");
    assert.equal(
      getRide(db, offer.rideId, driver.session, now).status,
      "ACCEPTED",
    );
  } finally {
    db.close();
  }
});
test("another rider securing the public ride invalidates its demand invitation", () => {
  const { db, rider, driver, other } = fixture();
  try {
    const demand = postDemand(db, rider.token, route, now);
    const offer = offerDemand(db, driver.token, demand.id, offerBody, now);
    const joined = requestRide(
      db,
      other.token,
      offer.rideId,
      {
        pickup: origin,
        destination,
        requestedDepartureAt: offerBody.scheduledDepartureAt,
      },
      now,
    );
    decideRequest(
      db,
      driver.token,
      offer.rideId,
      joined.ride.request!.requestId,
      "ACCEPT",
      now,
    );
    assert.throws(
      () => respondToDemandOffer(db, rider.token, offer.id, "ACCEPT", now),
      /DEMAND_UNAVAILABLE/,
    );
    assert.equal(
      demandActivity(db, rider.token, now).requests[0].status,
      "OPEN",
    );
    assert.equal(pendingDemandOffers(db, rider.token, now), 0);
    assert.equal(
      (
        db
          .prepare(
            "SELECT count(*) n FROM ride_requests WHERE status='ACCEPTED'",
          )
          .get() as { n: number }
      ).n,
      1,
    );
  } finally {
    db.close();
  }
});

test("HTTP workflow authenticates and creates a real accepted ride without provider calls", async () => {
  const { db, rider, driver, other } = fixture();
  saveVehicle(db, driver.session.id, { plate: "ABC123" });
  const api = createApiServer(db);
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const address = api.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  async function call(path: string, token?: string, body?: unknown) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    assert.equal((await call("/api/rider-demands")).status, 401);
    const invalidContribution = await call("/api/rider-demands", rider.token, { ...route, offeredContributionAud: "10" });
    assert.equal(invalidContribution.status, 400);
    assert.equal(invalidContribution.body.error, "INVALID_FIXED_PRICE");
    const posted = await call("/api/rider-demands", rider.token, { ...route, offeredContributionAud: 10.25 });
    assert.equal(posted.status, 201);
    assert.equal(posted.body.request.offeredContributionAud, 10.25);
    assert.equal((await call("/api/current", rider.token)).body.activeDemand.id, posted.body.request.id);
    assert.equal((await call("/api/current", other.token)).body.activeDemand, null);
    const found = await call("/api/rider-demands/search", driver.token, route);
    assert.equal(found.body.requests.length, 1);
    assert.equal(found.body.requests[0].offeredContributionAud, 10.25);
    assert.equal(found.body.requests[0].isOwn, false);
    const ownFound = await call("/api/rider-demands/search", rider.token, { date: "any", time: "" });
    assert.equal(ownFound.body.requests[0].id, posted.body.request.id);
    assert.equal(ownFound.body.requests[0].isOwn, true);
    assert.equal("owner_id" in ownFound.body.requests[0], false);
    const selfOffer = await call(`/api/rider-demands/${posted.body.request.id}/offer`, rider.token, { ...offerBody, isOwn: false });
    assert.equal(selfOffer.status, 409);
    assert.equal(selfOffer.body.error, "OWN_RIDE_JOIN_NOT_ALLOWED");
    assert.equal((db.prepare("SELECT count(*) n FROM rides").get() as { n: number }).n, 0);
    const ownPost = await call("/api/rider-demands", other.token, route);
    const revised = { ...route, destination: { ...destination, label: "Updated destination" } };
    const stale = await call("/api/rider-demands", other.token, { ...revised, replaceDemandId: posted.body.request.id });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, "DEMAND_CHANGED");
    const replaced = await call("/api/rider-demands", other.token, { ...revised, replaceDemandId: ownPost.body.request.id });
    assert.equal(replaced.status, 201);
    assert.notEqual(replaced.body.request.id, ownPost.body.request.id);
    assert.equal((await call(`/api/rider-demands/${replaced.body.request.id}/cancel`, other.token, {})).status, 200);
    const schedule = initialDeparture();
    const driversOwn = await call("/api/rider-demands", driver.token, route);
    const driverBody = { ...offerBody, scheduledDepartureAt: sydneyInstant(schedule.date, schedule.time) };
    assert.equal((await call("/api/rides", driver.token, driverBody)).body.error, "LIFT_REQUEST_WITHDRAWAL_REQUIRED");
    assert.equal((await call("/api/rides", driver.token, { ...driverBody, withdrawLiftRequestId: posted.body.request.id })).body.error, "LIFT_REQUEST_WITHDRAWAL_REQUIRED");
    const offered = await call(
      `/api/rider-demands/${posted.body.request.id}/offer`,
      driver.token,
      {
        ...offerBody,
        withdrawLiftRequestId: driversOwn.body.request.id,
        scheduledDepartureAt: sydneyInstant(schedule.date, schedule.time),
      },
    );
    assert.equal(offered.status, 201, JSON.stringify(offered.body));
    const endpoint = `/api/rider-demands/offers/${offered.body.offer.id}/respond`;
    assert.equal(
      (await call(endpoint, other.token, { decision: "ACCEPT" })).status,
      403,
    );
    const accepted = await call(endpoint, rider.token, { decision: "ACCEPT" });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.ride.status, "ACCEPTED");
    assert.equal((await call("/api/current", rider.token)).body.activeDemand, null);
    assert.equal(
      (await call("/api/current", driver.token)).body.current.ride.status,
      "ACCEPTED",
    );
  } finally {
    api.close();
    api.closeAllConnections();
    await once(api, "close");
    db.close();
  }
});
