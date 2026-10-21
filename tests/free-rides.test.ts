import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { allowFreeRideFares } from "../server/free-ride-schema";
import { fareLabel, validFare, validFareDraft } from "../lib/fare";
import {
  initializeCoreSchema,
  publishRide,
  requestRide,
  decideRequest,
  findSession,
  getRide,
  publicRidePreview,
  confirmCoRideCode,
  completeCoRide,
  privateHistory,
} from "../server/core";
import {
  initializeUsualRoutes,
  saveUsualRoute,
  readUsualRoute,
  validateUsualRoute,
} from "../server/usual-routes";

const now = new Date("2026-10-21T01:00:00Z");
const input = {
  origin: { latitude: -33.88, longitude: 151.18, label: "Origin" },
  destination: { latitude: -33.88, longitude: 151.28, label: "Destination" },
  scheduledDepartureAt: now.toISOString(),
  priceAud: 10,
  payId: "driver@example.com",
  payIdType: "EMAIL" as const,
};

test("free fares are explicit and paid contribution validation stays unchanged", () => {
  assert.equal(fareLabel(0), "Free");
  assert.equal(fareLabel(5), "A$5");
  for (const value of [-1, 0.99, 5.555, 10000.01, 10001, NaN, Infinity])
    assert.equal(validFare(value), false);
  for (const value of [0, 1, 1.01, 4, 5, 5.5, 8.03, 9999.99, 10000])
    assert.equal(validFare(value), true);
  assert.equal(fareLabel(5.5), "A$5.50");
  for (const value of ["", "5.", "5.50", "10000.00"])
    assert.equal(validFareDraft(value), true);
  for (const value of ["5.555", "10000.01", "999999", "1e3", "-5", "abc"])
    assert.equal(validFareDraft(value), false);
});

test("decimal contributions survive SQLite and saved-route round trips", () => {
  const db = new Database(":memory:");
  try {
    initializeCoreSchema(db);
    const paid = publishRide(db, null, { ...input, priceAud: 1.03 }, now);
    assert.equal(publicRidePreview(db, paid.ride.rideId, now).priceAud, 1.03);
    const owner = findSession(db, paid.sessionToken, now)!;
    const route = validateUsualRoute({
      origin: input.origin,
      destination: input.destination,
      days: [],
      minute: null,
      alerts: false,
      priceAud: 5.5,
      payId: input.payId,
      payIdType: "EMAIL",
    });
    saveUsualRoute(db, owner.id, route, now);
    assert.equal(readUsualRoute(db, owner.id)?.priceAud, 5.5);
    assert.throws(
      () => validateUsualRoute({ ...route, priceAud: 5.555 }),
      /INVALID_USUAL_ROUTE/,
    );
  } finally {
    db.close();
  }
});

for (const priorCheck of ["CHECK (price_aud >= 5)", "CHECK (price_aud = 0 OR price_aud >= 5)"])
test(`fare migration preserves records, FK, indexes and triggers from ${priorCheck}`, () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  try {
    db.exec(
      readFileSync("server/schema.sql", "utf8").replace(
        "CHECK (price_aud = 0 OR price_aud >= 1)",
        priorCheck,
      ),
    );
    // Initialize ancillary schemas without upgrading the legacy rides table yet.
    initializeUsualRoutes(db);
    db.exec(readFileSync("server/messaging-schema.sql", "utf8"));
    db.exec(
      "ALTER TABLE live_locations ADD COLUMN moving INTEGER NOT NULL DEFAULT 0",
    );
    const paid = publishRide(db, null, input, now);
    requestRide(
      db,
      null,
      paid.ride.rideId,
      {
        pickup: input.origin,
        destination: input.destination,
        requestedDepartureAt: now.toISOString(),
      },
      now,
    );
    db.exec(
      "CREATE TABLE migration_audit (ride_id TEXT); CREATE TRIGGER preserve_test_trigger AFTER UPDATE ON rides BEGIN INSERT INTO migration_audit VALUES (NEW.id); END;",
    );
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    const snapshot = () =>
      Object.fromEntries(
        tables.map(({ name }) => [
          name,
          db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all(),
        ]),
      );
    const before = snapshot();
    const objects = () =>
      db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type IN ('index','trigger') AND sql IS NOT NULL ORDER BY name",
        )
        .all();
    const definitions = objects();
    allowFreeRideFares(db);
    allowFreeRideFares(db);
    assert.deepEqual(snapshot(), before);
    assert.deepEqual(objects(), definitions);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
    initializeCoreSchema(db);
    const free = publishRide(db, null, { ...input, priceAud: 0 }, now);
    assert.equal(free.ride.priceAud, 0);
    const smallContribution = publishRide(db, null, { ...input, priceAud: 1.25 }, now);
    assert.equal(smallContribution.ride.priceAud, 1.25);
    assert.equal(publicRidePreview(db, paid.ride.rideId, now).priceAud, 10);
  } finally {
    db.close();
  }
});

test("free ride lifecycle keeps pairing, completion and history but never stores payment", () => {
  const db = new Database(":memory:");
  try {
    initializeCoreSchema(db);
    const driver = publishRide(db, null, { ...input, priceAud: 0 }, now);
    assert.equal(driver.ride.payId, null);
    const stored = db
      .prepare("SELECT driver_payid, driver_payid_type FROM rides")
      .get();
    assert.deepEqual(stored, { driver_payid: null, driver_payid_type: null });
    assert.equal(
      publicRidePreview(db, driver.ride.rideId, now).paymentMethod,
      undefined,
    );
    const rider = requestRide(
      db,
      null,
      driver.ride.rideId,
      {
        pickup: input.origin,
        destination: input.destination,
        requestedDepartureAt: now.toISOString(),
      },
      now,
    );
    decideRequest(
      db,
      driver.sessionToken,
      driver.ride.rideId,
      rider.ride.request!.requestId,
      "ACCEPT",
      now,
    );
    assert.throws(
      () =>
        completeCoRide(
          db,
          rider.sessionToken,
          driver.ride.rideId,
          null,
          now,
          true,
        ),
      /COMPLETION_PICKUP_UNCONFIRMED/,
    );
    const view = getRide(
      db,
      driver.ride.rideId,
      findSession(db, rider.sessionToken, now)!,
      now,
    );
    confirmCoRideCode(
      db,
      driver.sessionToken,
      driver.ride.rideId,
      view.coRideCode!,
      now,
    );
    const finished = completeCoRide(
      db,
      rider.sessionToken,
      driver.ride.rideId,
      null,
      now,
      true,
    );
    assert.equal(finished.status, "COMPLETED");
    assert.equal(finished.payId, null);
    assert.equal(finished.paymentHandoffMethod, null);
    assert.equal(
      privateHistory(db, driver.sessionToken, now).driver[0].priceAud,
      0,
    );
    assert.equal(
      privateHistory(db, rider.sessionToken, now).rider[0].priceAud,
      0,
    );
  } finally {
    db.close();
  }
});

test("free saved routes discard payment data without rewriting existing paid preferences", () => {
  const db = new Database(":memory:");
  try {
    initializeCoreSchema(db);
    const paid = publishRide(db, null, input, now);
    const owner = findSession(db, paid.sessionToken, now)!;
    const route = {
      origin: input.origin,
      destination: input.destination,
      days: [],
      minute: null,
      alerts: false,
      priceAud: 10,
      payId: input.payId,
      payIdType: input.payIdType,
    };
    saveUsualRoute(db, owner.id, route, now);
    initializeCoreSchema(db);
    assert.deepEqual(readUsualRoute(db, owner.id), route);
    const free = validateUsualRoute({ ...route, priceAud: 0 });
    assert.equal(free.payId, "");
    saveUsualRoute(db, owner.id, free, now);
    assert.equal(readUsualRoute(db, owner.id)?.priceAud, 0);
    assert.equal(publicRidePreview(db, paid.ride.rideId, now).priceAud, 10);
  } finally {
    db.close();
  }
});
