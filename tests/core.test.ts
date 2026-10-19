import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openDatabase } from "../server/db";
import { adminInspector } from "../server/admin";
import {
  ANONYMOUS_ANIMALS,
  advanceSampleRide,
  advanceSampleSimulations,
  availableRides,
  beginRide,
  cancelPendingRequest,
  cancelRide,
  completeCoRide,
  confirmCoRideCode,
  createGuestSession,
  currentOpenRide,
  currentOpenRides,
  decideRequest,
  ensureSampleRides,
  retireSampleOffers,
  expireStaleRides,
  findSession,
  getRide,
  initializeCoreSchema,
  privateHistory,
  publicRidePreview,
  publishRide,
  requestRide,
  renewPickupCode,
  searchRides,
  submitLocation,
} from "../server/core";

function harness() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "cocowheels-test-"));
  const db = openDatabase(path.join(directory, "test.db"));
  initializeCoreSchema(db);
  return {
    db,
    close() {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("schema initialization removes the legacy one-request-per-ride constraint", () => {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "cocowheels-migration-"),
  );
  const db = openDatabase(path.join(directory, "test.db"));
  try {
    db.exec(`
      CREATE TABLE ride_requests (
        id TEXT PRIMARY KEY,
        ride_id TEXT NOT NULL,
        rider_session_id TEXT NOT NULL,
        rider_alias TEXT NOT NULL,
        pickup_latitude REAL NOT NULL,
        pickup_longitude REAL NOT NULL,
        pickup_label TEXT,
        destination_latitude REAL NOT NULL,
        destination_longitude REAL NOT NULL,
        destination_label TEXT,
        requested_departure_at TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        decided_at TEXT,
        UNIQUE (ride_id, rider_session_id)
      );
    `);
    initializeCoreSchema(db);
    const definition = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ride_requests'",
      )
      .get() as { sql: string };
    assert.doesNotMatch(
      definition.sql,
      /UNIQUE\s*\(\s*ride_id\s*,\s*rider_session_id\s*\)/i,
    );
    const messageReferences = db
      .prepare("PRAGMA foreign_key_list(ride_messages)")
      .all() as Array<{ table: string }>;
    assert.ok(
      messageReferences.some(
        (reference) => reference.table === "ride_requests",
      ),
    );
    assert.ok(
      !messageReferences.some(
        (reference) => reference.table === "ride_requests_legacy_unique",
      ),
    );
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'ride_requests'",
      )
      .all() as Array<{ name: string }>;
    assert.ok(
      indexes.some((index) => index.name === "ride_requests_rider_index"),
    );
    assert.ok(
      indexes.some((index) => index.name === "ride_requests_ride_index"),
    );
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
const baseTime = new Date("2026-10-01T10:00:00.000Z");
const departure = new Date(baseTime.getTime() + 5 * 60_000).toISOString();
const driverInput = {
  origin: {
    latitude: -33.8688,
    longitude: 151.2093,
    label: "Private driver origin",
  },
  destination: {
    latitude: -33.81,
    longitude: 151.28,
    label: "Private final destination",
  },
  scheduledDepartureAt: departure,
  priceAud: 10,
  payId: "driver@example.com",
  payIdType: "EMAIL" as const,
};

test("published drivers can move while offers remain requestable and public locations age", () => {
  const h = harness();
  try {
    const published = publishRide(h.db, null, driverInput, baseTime);
    const later = new Date(baseTime.getTime() + 1000);
    const fix = {
      latitude: -33.85,
      longitude: 151.25,
      accuracyMeters: 10,
      capturedAt: later.toISOString(),
      moving: true,
    };
    submitLocation(
      h.db,
      published.sessionToken,
      published.ride.rideId,
      fix,
      later,
    );
    const preview = publicRidePreview(h.db, published.ride.rideId, later);
    assert.equal(preview.status, "PUBLISHED");
    assert.equal(
      preview.plannedRoute.origin.latitude,
      driverInput.origin.latitude,
    );
    assert.equal(preview.driverLocation?.latitude, fix.latitude);
    assert.equal(preview.driverLocation?.stale, false);
    assert.equal(
      publicRidePreview(
        h.db,
        published.ride.rideId,
        new Date(later.getTime() + 31000),
      ).driverLocation?.stale,
      true,
    );
    const stranger = createGuestSession(h.db, later);
    assert.throws(
      () =>
        submitLocation(h.db, stranger.token, published.ride.rideId, fix, later),
      /RIDE_ACCESS_DENIED/,
    );
    const requested = requestRide(
      h.db,
      stranger.token,
      published.ride.rideId,
      { ...riderInput, pickup: { latitude: -34.1, longitude: 151.1 } },
      later,
    );
    assert.equal(requested.ride.request?.status, "PENDING");
    assert.equal(requested.ride.request?.directionFit, "POOR");
    assert.throws(
      () =>
        submitLocation(h.db, stranger.token, published.ride.rideId, fix, later),
      /RIDE_ACCESS_DENIED/,
    );
    // Late/out-of-order captures must not overwrite a newer position.
    submitLocation(
      h.db,
      published.sessionToken,
      published.ride.rideId,
      { ...fix, latitude: -34, capturedAt: baseTime.toISOString() },
      later,
    );
    assert.equal(
      publicRidePreview(h.db, published.ride.rideId, later).driverLocation
        ?.latitude,
      fix.latitude,
    );
    const stationaryTime = new Date(later.getTime() + 2000);
    submitLocation(
      h.db,
      published.sessionToken,
      published.ride.rideId,
      { ...fix, moving: false, capturedAt: stationaryTime.toISOString() },
      stationaryTime,
    );
    assert.equal(
      publicRidePreview(
        h.db,
        published.ride.rideId,
        new Date(stationaryTime.getTime() + 31000),
      ).driverLocation?.stale,
      false,
    );
    assert.equal(
      publicRidePreview(
        h.db,
        published.ride.rideId,
        new Date(stationaryTime.getTime() + 61000),
      ).driverLocation?.stale,
      true,
    );
    const expiredTime = new Date(baseTime.getTime() + 6 * 3600000 + 1);
    assert.throws(
      () =>
        submitLocation(
          h.db,
          published.sessionToken,
          published.ride.rideId,
          { ...fix, capturedAt: expiredTime.toISOString() },
          expiredTime,
        ),
      /LOCATION_NOT_ALLOWED/,
    );
  } finally {
    h.close();
  }
});

test("publishing rejects invalid payment inputs and treats SQL-like text as data", () => {
  const h = harness();
  try {
    for (const priceAud of [4, 5.5, 10001, Infinity])
      assert.throws(
        () => publishRide(h.db, null, { ...driverInput, priceAud }, baseTime),
        /INVALID_FIXED_PRICE/,
      );
    for (const [payIdType, payId] of [
      ["MOBILE", "04123"],
      ["EMAIL", "not-an-email"],
      ["OTHER", "12345"],
    ] as const)
      assert.throws(
        () =>
          publishRide(
            h.db,
            null,
            { ...driverInput, payIdType, payId },
            baseTime,
          ),
        /INVALID_PAYID/,
      );
    const label = "Town Hall'); DROP TABLE rides; --";
    const published = publishRide(
      h.db,
      null,
      { ...driverInput, priceAud: 5, origin: { ...driverInput.origin, label } },
      baseTime,
    );
    assert.equal(published.ride.plannedRoute?.origin.label, label);
    assert.equal(
      (
        h.db.prepare("SELECT COUNT(*) AS count FROM rides").get() as {
          count: number;
        }
      ).count,
      1,
    );
    assert.equal(availableRides(h.db, baseTime).length, 1);
    assert.throws(
      () => publicRidePreview(h.db, "' OR 1=1 --", baseTime),
      /RIDE_UNAVAILABLE/,
    );
  } finally {
    h.close();
  }
});

test("rotates through 50 animal aliases without repeating the last ten", () => {
  const h = harness();
  try {
    assert.equal(ANONYMOUS_ANIMALS.length, 50);
    assert.equal(new Set(ANONYMOUS_ANIMALS).size, 50);
    const aliases: string[] = [];
    for (let index = 0; index < 75; index += 1) {
      const created = createGuestSession(
        h.db,
        new Date(baseTime.getTime() + index),
      );
      const recent = aliases.slice(-10);
      assert.equal(recent.includes(created.session.alias), false);
      aliases.push(created.session.alias);
    }
  } finally {
    h.close();
  }
});
const riderInput = {
  pickup: { latitude: -33.855, longitude: 151.225, label: "Rider pickup" },
  destination: {
    latitude: -33.82,
    longitude: 151.265,
    label: "Rider destination",
  },
  requestedDepartureAt: departure,
};

test("retiring samples preserves history and real offers, rejects joins, and is idempotent", () => {
  const h = harness();
  try {
    ensureSampleRides(h.db, baseTime);
    const samples = availableRides(h.db, baseTime);
    assert.equal(samples.length, 3);
    const real = publishRide(h.db, null, driverInput, baseTime);
    const pending = requestRide(
      h.db,
      null,
      samples[0].rideId,
      riderInput,
      baseTime,
    );
    const rider = findSession(h.db, pending.sessionToken, baseTime)!;
    const before = h.db.prepare("SELECT count(*) n FROM rides").get();
    assert.equal(retireSampleOffers(h.db, baseTime), 3);
    assert.deepEqual(
      h.db.prepare("SELECT count(*) n FROM rides").get(),
      before,
    );
    assert.deepEqual(
      availableRides(h.db, baseTime).map((r) => r.rideId),
      [real.ride.rideId],
    );
    assert.equal(
      getRide(h.db, samples[0].rideId, rider, baseTime).request?.status,
      "DISCARDED",
    );
    assert.equal(
      privateHistory(h.db, pending.sessionToken, baseTime).rider.length,
      1,
    );
    assert.throws(
      () => publicRidePreview(h.db, samples[1].rideId, baseTime),
      /RIDE_UNAVAILABLE/,
    );
    assert.throws(
      () => requestRide(h.db, null, samples[1].rideId, riderInput, baseTime),
      /RIDE_UNAVAILABLE/,
    );
    assert.equal(retireSampleOffers(h.db, baseTime), 0);
    assert.equal(
      (
        h.db
          .prepare(
            "SELECT count(*) n FROM ride_events WHERE event = 'SAMPLE_OFFER_RETIRED'",
          )
          .get() as { n: number }
      ).n,
      3,
    );
  } finally {
    h.close();
  }
});

function sessions(h: ReturnType<typeof harness>) {
  const published = publishRide(h.db, null, driverInput, baseTime);
  const driver = findSession(h.db, published.sessionToken, baseTime);
  assert.ok(driver);
  const requested = requestRide(
    h.db,
    null,
    published.ride.rideId,
    riderInput,
    new Date(baseTime.getTime() + 1_000),
  );
  const rider = findSession(
    h.db,
    requested.sessionToken,
    new Date(baseTime.getTime() + 1_000),
  );
  assert.ok(rider);
  return { published, requested, driver, rider };
}

test("pickup code is rider-only at acceptance and gates PayID for every other request", () => {
  const h = harness();
  try {
    const flow = sessions(h);
    const id = flow.published.ride.rideId;
    const other = requestRide(h.db, null, id, riderInput, baseTime);
    const otherSession = findSession(h.db, other.sessionToken, baseTime)!;
    decideRequest(
      h.db,
      flow.published.sessionToken,
      id,
      flow.requested.ride.request!.requestId,
      "ACCEPT",
      baseTime,
    );
    const rider = getRide(h.db, id, flow.rider, baseTime);
    assert.match(rider.coRideCode!, /^\d{4}$/);
    assert.equal(rider.payId, undefined);
    assert.equal(rider.paymentMethod, "PAYID");
    assert.equal(
      getRide(h.db, id, flow.driver, baseTime).coRideCode,
      undefined,
    );
    assert.equal(
      getRide(h.db, id, otherSession, baseTime).coRideCode,
      undefined,
    );
    assert.throws(
      () =>
        confirmCoRideCode(
          h.db,
          flow.requested.sessionToken,
          id,
          rider.coRideCode!,
          baseTime,
        ),
      /RIDE_ACCESS_DENIED/,
    );
    confirmCoRideCode(
      h.db,
      flow.published.sessionToken,
      id,
      rider.coRideCode!,
      baseTime,
    );
    const verified = getRide(h.db, id, flow.rider, baseTime);
    assert.equal(verified.payId, "driver@example.com");
    assert.equal(verified.pickupEstablished, true);
    assert.equal(verified.coRideCode, undefined);
    assert.equal(getRide(h.db, id, otherSession, baseTime).payId, undefined);
    assert.throws(
      () =>
        confirmCoRideCode(
          h.db,
          flow.published.sessionToken,
          id,
          rider.coRideCode!,
          baseTime,
        ),
      /CO_RIDE_CODE_EXPIRED/,
    );
  } finally {
    h.close();
  }
});

test("pickup evidence is non-blocking, immutable and retained; codes have no timer", () => {
  for (const mode of ["near", "far", "driver-only", "missing"] as const) {
    const h = harness();
    try {
      const flow = sessions(h);
      const id = flow.published.ride.rideId;
      decideRequest(
        h.db,
        flow.published.sessionToken,
        id,
        flow.requested.ride.request!.requestId,
        "ACCEPT",
        baseTime,
      );
      const code = getRide(h.db, id, flow.rider, baseTime).coRideCode!;
      const internal = (
        h.db.prepare("SELECT id FROM rides WHERE public_id = ?").get(id) as {
          id: string;
        }
      ).id;
      if (mode !== "missing") {
        const insert = h.db.prepare(
          "INSERT INTO live_locations (ride_id, participant, latitude, longitude, accuracy_meters, captured_at, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        );
        insert.run(
          internal,
          "DRIVER",
          -33.87,
          151.2,
          10,
          baseTime.toISOString(),
          baseTime.toISOString(),
        );
        if (mode !== "driver-only")
          insert.run(
            internal,
            "RIDER",
            mode === "near" ? -33.8701 : -34,
            151.2,
            20,
            baseTime.toISOString(),
            baseTime.toISOString(),
          );
      }
      const later = new Date(baseTime.getTime() + 2 * 60 * 60_000);
      assert.equal(getRide(h.db, id, flow.rider, later).coRideCode, code);
      assert.equal(
        confirmCoRideCode(h.db, flow.published.sessionToken, id, code, later)
          .status,
        "CO_RIDE_ACTIVE",
      );
      const evidence = adminInspector(h.db, id).pickupEvidence!;
      assert.equal(
        evidence.within_250_metres,
        ["missing", "driver-only"].includes(mode)
          ? "Unknown"
          : mode === "near"
            ? "Yes"
            : "No",
      );
      if (mode === "near" || mode === "far")
        assert.equal(evidence.rider_gps_age_seconds, 7200);
      assert.equal(
        "pickupEvidence" in getRide(h.db, id, flow.rider, later),
        false,
      );
      assert.throws(
        () =>
          confirmCoRideCode(h.db, flow.published.sessionToken, id, code, later),
        /CO_RIDE_CODE_EXPIRED/,
      );
      cancelRide(h.db, flow.published.sessionToken, id, later);
      assert.deepEqual(adminInspector(h.db, id).pickupEvidence, evidence);
      assert.equal(adminInspector(h.db, id).locations.length, 0);
    } finally {
      h.close();
    }
  }
});

test("pickup code renewal is rider-only, throttled, invalidates old code and recovers lockout", () => {
  const h = harness();
  try {
    const flow = sessions(h);
    const id = flow.published.ride.rideId;
    decideRequest(
      h.db,
      flow.published.sessionToken,
      id,
      flow.requested.ride.request!.requestId,
      "ACCEPT",
      baseTime,
    );
    assert.throws(
      () => renewPickupCode(h.db, flow.published.sessionToken, id, baseTime),
      /RIDE_ACCESS_DENIED/,
    );
    assert.throws(
      () => renewPickupCode(h.db, flow.requested.sessionToken, id, baseTime),
      /CO_RIDE_CODE_RATE_LIMITED/,
    );
    for (let i = 0; i < 5; i++)
      assert.throws(
        () =>
          confirmCoRideCode(
            h.db,
            flow.published.sessionToken,
            id,
            "0000",
            new Date(+baseTime + i * 3000),
          ),
        /CO_RIDE_CODE_INVALID/,
      );
    const lockedCode = getRide(h.db, id, flow.rider, baseTime).coRideCode!;
    assert.throws(
      () =>
        confirmCoRideCode(
          h.db,
          flow.published.sessionToken,
          id,
          lockedCode,
          new Date(+baseTime + 20000),
        ),
      /CO_RIDE_CODE_LOCKED/,
    );
    const later = new Date(+baseTime + 16 * 60000);
    assert.equal(getRide(h.db, id, flow.rider, later).coRideCode, lockedCode);
    const renewed = renewPickupCode(
      h.db,
      flow.requested.sessionToken,
      id,
      later,
    );
    assert.match(renewed.coRideCode!, /^\d{4}$/);
    assert.notEqual(renewed.coRideCode, lockedCode);
    assert.throws(
      () =>
        confirmCoRideCode(
          h.db,
          flow.published.sessionToken,
          id,
          lockedCode,
          later,
        ),
      /CO_RIDE_CODE_INVALID/,
    );
    assert.equal(
      confirmCoRideCode(
        h.db,
        flow.published.sessionToken,
        id,
        renewed.coRideCode!,
        new Date(+later + 2001),
      ).status,
      "CO_RIDE_ACTIVE",
    );
  } finally {
    h.close();
  }
});

test("pickup renewal rolls back code and audit together when the audit write fails", () => {
  for (const timing of ["BEFORE", "AFTER"]) {
    const h = harness();
    try {
      const flow = sessions(h);
      const id = flow.published.ride.rideId;
      decideRequest(
        h.db,
        flow.published.sessionToken,
        id,
        flow.requested.ride.request!.requestId,
        "ACCEPT",
        baseTime,
      );
      const later = new Date(+baseTime + 61000);
      const read = () => ({
        ride: h.db.prepare("SELECT * FROM rides WHERE public_id = ?").get(id),
        events: h.db.prepare("SELECT * FROM ride_events ORDER BY id").all(),
      });
      const before = read();
      const oldCode = getRide(h.db, id, flow.rider, later).coRideCode;
      h.db
        .exec(`CREATE TEMP TRIGGER fail_renewal ${timing} INSERT ON ride_events
        WHEN NEW.event = 'PICKUP_CODE_RENEWED'
        BEGIN SELECT RAISE(ABORT, 'TEST_AUDIT_FAILURE'); END`);
      assert.throws(
        () => renewPickupCode(h.db, flow.requested.sessionToken, id, later),
        /TEST_AUDIT_FAILURE/,
      );
      assert.deepEqual(read(), before);
      assert.equal(getRide(h.db, id, flow.rider, later).coRideCode, oldCode);
      h.db.exec("DROP TRIGGER fail_renewal");
      const renewed = renewPickupCode(
        h.db,
        flow.requested.sessionToken,
        id,
        later,
      );
      assert.notEqual(renewed.coRideCode, oldCode);
      const eventCount = h.db
        .prepare(
          "SELECT count(*) AS n FROM ride_events WHERE event = 'PICKUP_CODE_RENEWED'",
        )
        .get() as { n: number };
      assert.equal(eventCount.n, 1);
      const committed = read();
      assert.throws(
        () => renewPickupCode(h.db, flow.requested.sessionToken, id, later),
        /CO_RIDE_CODE_RATE_LIMITED/,
      );
      assert.deepEqual(read(), committed);
      assert.equal(renewed.payId, undefined);
    } finally {
      h.close();
    }
  }
});

test("either device at drop-off permits either participant to complete without recording payment", () => {
  for (const reporter of ["DRIVER", "RIDER"])
    for (const finisher of ["DRIVER", "RIDER"]) {
      const h = harness();
      try {
        const flow = sessions(h);
        const id = flow.published.ride.rideId;
        decideRequest(
          h.db,
          flow.published.sessionToken,
          id,
          flow.requested.ride.request!.requestId,
          "ACCEPT",
          baseTime,
        );
        confirmCoRideCode(
          h.db,
          flow.published.sessionToken,
          id,
          getRide(h.db, id, flow.rider, baseTime).coRideCode!,
          baseTime,
        );
        const tokens = {
          DRIVER: flow.published.sessionToken,
          RIDER: flow.requested.sessionToken,
        };
        const now = new Date(+baseTime + 5000);
        submitLocation(
          h.db,
          tokens[reporter as keyof typeof tokens],
          id,
          {
            ...riderInput.destination,
            accuracyMeters: 10,
            capturedAt: now.toISOString(),
          },
          now,
        );
        const tracking = getRide(h.db, id, flow.driver, now).tracking!;
        assert.equal(tracking.source, reporter);
        assert.equal(tracking.agreement, "SINGLE_DEVICE");
        const result = completeCoRide(
          h.db,
          tokens[finisher as keyof typeof tokens],
          id,
          null,
          now,
        );
        assert.equal(result.status, "COMPLETED");
        assert.equal(result.paymentHandoffMethod, null);
        assert.equal(getRide(h.db, id, flow.rider, now).status, "COMPLETED");
        assert.equal(getRide(h.db, id, flow.driver, now).status, "COMPLETED");
      } finally {
        h.close();
      }
    }
});

test("completion warnings allow explicit override but never authorize outsiders", () => {
  const h = harness();
  try {
    const flow = sessions(h);
    const id = flow.published.ride.rideId;
    decideRequest(
      h.db,
      flow.published.sessionToken,
      id,
      flow.requested.ride.request!.requestId,
      "ACCEPT",
      baseTime,
    );
    assert.throws(
      () =>
        completeCoRide(h.db, flow.published.sessionToken, id, null, baseTime),
      /COMPLETION_PICKUP_UNCONFIRMED/,
    );
    const outsider = createGuestSession(h.db, baseTime);
    for (const token of [
      flow.published.sessionToken,
      flow.requested.sessionToken,
    ]) {
      assert.throws(
        () => completeCoRide(h.db, token, id, null, baseTime, true),
        /COMPLETION_PICKUP_UNCONFIRMED/,
      );
    }
    assert.throws(
      () => completeCoRide(h.db, outsider.token, id, null, baseTime, true),
      /RIDE_ACCESS_DENIED/,
    );
    confirmCoRideCode(
      h.db,
      flow.published.sessionToken,
      id,
      getRide(h.db, id, flow.rider, baseTime).coRideCode!,
      baseTime,
    );
    assert.throws(
      () =>
        completeCoRide(h.db, flow.published.sessionToken, id, null, baseTime),
      /COMPLETION_LOCATION_UNAVAILABLE/,
    );
    submitLocation(
      h.db,
      flow.requested.sessionToken,
      id,
      {
        ...riderInput.destination,
        accuracyMeters: 5,
        capturedAt: baseTime.toISOString(),
      },
      baseTime,
    );
    const later = new Date(+baseTime + 31_000);
    assert.throws(
      () => completeCoRide(h.db, flow.published.sessionToken, id, null, later),
      /COMPLETION_LOCATION_UNAVAILABLE/,
    );
    assert.equal(
      completeCoRide(h.db, flow.published.sessionToken, id, null, later, true)
        .status,
      "COMPLETED",
    );
  } finally {
    h.close();
  }
});

test("either participant may cancel after pickup", () => {
  for (const driver of [true, false]) {
    const h = harness();
    try {
      const flow = sessions(h);
      const id = flow.published.ride.rideId;
      decideRequest(
        h.db,
        flow.published.sessionToken,
        id,
        flow.requested.ride.request!.requestId,
        "ACCEPT",
        baseTime,
      );
      confirmCoRideCode(
        h.db,
        flow.published.sessionToken,
        id,
        getRide(h.db, id, flow.rider, baseTime).coRideCode!,
        baseTime,
      );
      assert.equal(
        cancelRide(
          h.db,
          driver ? flow.published.sessionToken : flow.requested.sessionToken,
          id,
          baseTime,
        ).status,
        "CANCELLED",
      );
    } finally {
      h.close();
    }
  }
});

test("six-hour offers retain expiry and request fit in admin", () => {
  const h = harness();
  try {
    const published = publishRide(h.db, null, driverInput, baseTime);
    requestRide(h.db, null, published.ride.rideId, riderInput, baseTime);
    const report = adminInspector(h.db, published.ride.rideId);
    assert.equal(
      (report.ride as { offer_expires_at: string }).offer_expires_at,
      new Date(baseTime.getTime() + 6 * 3600000).toISOString(),
    );
    assert.ok(["GOOD", "POOR"].includes(report.requests[0].fit));
    assert.equal(report.requests[0].cached_pickup_minutes, null);
    assert.equal(
      availableRides(h.db, new Date(baseTime.getTime() + 2 * 3600000)).length,
      1,
    );
    expireStaleRides(h.db, new Date(baseTime.getTime() + 6 * 3600000 + 1));
    assert.equal(
      availableRides(h.db, new Date(baseTime.getTime() + 6 * 3600000 + 1))
        .length,
      0,
    );
  } finally {
    h.close();
  }
});
test("publishes a fixed-price offer and keeps discovery redacted while allowing a full preview", () => {
  const h = harness();
  try {
    const published = publishRide(h.db, null, driverInput, baseTime);
    const candidates = searchRides(h.db, riderInput, baseTime);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].priceAud, 10);
    assert.equal(candidates[0].driverAlias, published.ride.driverAlias);
    assert.notDeepEqual(candidates[0].redactedCorridor[0], {
      latitude: driverInput.origin.latitude,
      longitude: driverInput.origin.longitude,
    });
    assert.notDeepEqual(candidates[0].redactedCorridor[1], {
      latitude: driverInput.destination.latitude,
      longitude: driverInput.destination.longitude,
    });
    assert.equal("origin" in candidates[0], false);
    assert.equal("payId" in candidates[0], false);
    assert.equal("payIdType" in candidates[0], false);
    assert.equal(
      candidates[0].expiresAt,
      new Date(baseTime.getTime() + 6 * 60 * 60_000).toISOString(),
    );
    const preview = publicRidePreview(h.db, published.ride.rideId, baseTime);
    assert.equal(preview.expiresAt, candidates[0].expiresAt);
    assert.deepEqual(preview.plannedRoute, {
      origin: {
        latitude: driverInput.origin.latitude,
        longitude: driverInput.origin.longitude,
      },
      destination: {
        latitude: driverInput.destination.latitude,
        longitude: driverInput.destination.longitude,
      },
    });
    assert.deepEqual(
      getRide(
        h.db,
        published.ride.rideId,
        findSession(h.db, published.sessionToken, baseTime)!,
        baseTime,
      ).plannedRoute,
      { origin: driverInput.origin, destination: driverInput.destination },
    );
    assert.throws(
      () =>
        publishRide(
          h.db,
          published.sessionToken,
          { ...driverInput, priceAud: 4 },
          baseTime,
        ),
      /INVALID_FIXED_PRICE/,
    );
  } finally {
    h.close();
  }
});

test("published rides always expose a readable location detail to matching results", () => {
  const h = harness();
  try {
    publishRide(
      h.db,
      null,
      {
        ...driverInput,
        origin: { latitude: -33.8688, longitude: 151.2093 },
        destination: { latitude: -33.81, longitude: 151.28 },
      },
      baseTime,
    );
    const [candidate] = searchRides(h.db, riderInput, baseTime);
    assert.equal(candidate.departureLabel, "-33.86880, 151.20930");
    assert.equal(candidate.destinationLabel, "-33.81000, 151.28000");
  } finally {
    h.close();
  }
});

test("a guest may browse every offer but must end one role before switching while keeping its alias", () => {
  const h = harness();
  try {
    const ownOffer = publishRide(h.db, null, driverInput, baseTime);
    const otherOffer = publishRide(
      h.db,
      null,
      {
        ...driverInput,
        origin: { latitude: -33.87, longitude: 151.2 },
        destination: { latitude: -33.8, longitude: 151.29 },
      },
      new Date(baseTime.getTime() + 1_000),
    );
    const ownSearch = searchRides(
      h.db,
      riderInput,
      new Date(baseTime.getTime() + 2_000),
      ownOffer.sessionToken,
    );
    assert.equal(ownSearch.length, 2);
    assert.equal(
      ownSearch.find((candidate) => candidate.rideId === ownOffer.ride.rideId)
        ?.isOwnOffer,
      true,
    );
    assert.equal(
      ownSearch.find((candidate) => candidate.rideId === otherOffer.ride.rideId)
        ?.isOwnOffer,
      false,
    );
    const browse = availableRides(
      h.db,
      new Date(baseTime.getTime() + 2_000),
      ownOffer.sessionToken,
    );
    assert.equal(
      browse.find((offer) => offer.rideId === ownOffer.ride.rideId)?.isOwnOffer,
      true,
    );
    assert.equal(
      browse.find((offer) => offer.rideId === otherOffer.ride.rideId)
        ?.isOwnOffer,
      false,
    );
    assert.throws(
      () =>
        requestRide(
          h.db,
          ownOffer.sessionToken,
          otherOffer.ride.rideId,
          riderInput,
          new Date(baseTime.getTime() + 3_000),
        ),
      /ROLE_CHANGE_REQUIRES_TERMINATION/,
    );
    assert.deepEqual(
      currentOpenRides(
        h.db,
        ownOffer.sessionToken,
        new Date(baseTime.getTime() + 4_000),
      ).map((item) => item.role),
      ["DRIVER"],
    );
    assert.throws(
      () =>
        requestRide(
          h.db,
          ownOffer.sessionToken,
          ownOffer.ride.rideId,
          riderInput,
          new Date(baseTime.getTime() + 5_000),
        ),
      /OWN_RIDE_JOIN_NOT_ALLOWED/,
    );
    cancelRide(
      h.db,
      ownOffer.sessionToken,
      ownOffer.ride.rideId,
      new Date(baseTime.getTime() + 6_000),
    );
    const switched = requestRide(
      h.db,
      ownOffer.sessionToken,
      otherOffer.ride.rideId,
      riderInput,
      new Date(baseTime.getTime() + 7_000),
    );
    assert.equal(switched.ride.request?.riderAlias, ownOffer.ride.driverAlias);
    assert.deepEqual(
      currentOpenRides(
        h.db,
        ownOffer.sessionToken,
        new Date(baseTime.getTime() + 8_000),
      ).map((item) => item.role),
      ["RIDER"],
    );
    assert.throws(
      () =>
        publishRide(
          h.db,
          ownOffer.sessionToken,
          driverInput,
          new Date(baseTime.getTime() + 9_000),
        ),
      /ROLE_CHANGE_REQUIRES_TERMINATION/,
    );
    assert.throws(
      () =>
        requestRide(
          h.db,
          ownOffer.sessionToken,
          otherOffer.ride.rideId,
          riderInput,
          new Date(baseTime.getTime() + 10_000),
        ),
      /OPEN_ITEM_EXISTS/,
    );
  } finally {
    h.close();
  }
});

test("acceptance is atomic, discards competing requests, and prevents a second rider", () => {
  const h = harness();
  try {
    const first = sessions(h);
    const second = requestRide(
      h.db,
      null,
      first.published.ride.rideId,
      { ...riderInput, pickup: { latitude: -33.852, longitude: 151.228 } },
      new Date(baseTime.getTime() + 2_000),
    );
    const pending = getRide(
      h.db,
      first.published.ride.rideId,
      first.driver,
      new Date(baseTime.getTime() + 2_500),
    );
    assert.equal(pending.requests?.length, 2);
    assert.equal(
      pending.requests?.[0].createdAt,
      new Date(baseTime.getTime() + 1_000).toISOString(),
    );
    const riderPending = getRide(
      h.db,
      first.published.ride.rideId,
      first.rider,
      new Date(baseTime.getTime() + 2_500),
    );
    assert.match(riderPending.request?.riderAlias ?? "", /^Anonymous \S+/);
    assert.equal(
      riderPending.request?.createdAt,
      new Date(baseTime.getTime() + 1_000).toISOString(),
    );
    assert.equal(riderPending.request?.directionFit, "GOOD");
    assert.deepEqual(riderPending.plannedRoute, pending.plannedRoute);
    assert.equal(riderPending.payId, undefined);
    const accepted = decideRequest(
      h.db,
      first.published.sessionToken,
      first.published.ride.rideId,
      first.requested.ride.request!.requestId,
      "ACCEPT",
      new Date(baseTime.getTime() + 3_000),
    );
    assert.equal(accepted.status, "ACCEPTED");
    assert.equal(accepted.payId, "driver@example.com");
    assert.equal(accepted.payIdType, "EMAIL");
    assert.equal(
      accepted.acceptedAt,
      new Date(baseTime.getTime() + 3_000).toISOString(),
    );
    const acceptedRider = getRide(
      h.db,
      first.published.ride.rideId,
      first.rider,
      new Date(baseTime.getTime() + 3_100),
    );
    assert.equal(acceptedRider.payId, undefined);
    assert.equal(acceptedRider.payIdType, undefined);
    assert.equal(acceptedRider.paymentMethod, "PAYID");
    assert.match(acceptedRider.coRideCode!, /^\d{4}$/);
    assert.deepEqual(acceptedRider.plannedRoute, accepted.plannedRoute);
    const secondSession = findSession(
      h.db,
      second.sessionToken,
      new Date(baseTime.getTime() + 3_100),
    );
    assert.ok(secondSession);
    const discardedRider = getRide(
      h.db,
      first.published.ride.rideId,
      secondSession,
      new Date(baseTime.getTime() + 3_100),
    );
    assert.equal(discardedRider.payId, undefined);
    assert.equal(discardedRider.payIdType, undefined);
    assert.equal(
      accepted.requests?.find(
        (request) => request.requestId === second.ride.request!.requestId,
      ),
      undefined,
    );
    assert.throws(
      () =>
        decideRequest(
          h.db,
          first.published.sessionToken,
          first.published.ride.rideId,
          second.ride.request!.requestId,
          "ACCEPT",
          new Date(baseTime.getTime() + 4_000),
        ),
      /REQUEST_UNAVAILABLE/,
    );
    const formerOfferExpiry = new Date(
      new Date(departure).getTime() + 30 * 60_000 + 1,
    );
    assert.equal(expireStaleRides(h.db, formerOfferExpiry), 0);
    assert.equal(
      getRide(
        h.db,
        first.published.ride.rideId,
        first.driver,
        formerOfferExpiry,
      ).status,
      "ACCEPTED",
    );
  } finally {
    h.close();
  }
});

test("guest recovery returns only the current item, and completion frees the guest for a new one", () => {
  const h = harness();
  try {
    const flow = sessions(h);
    assert.equal(
      currentOpenRide(h.db, flow.published.sessionToken, baseTime)?.role,
      "DRIVER",
    );
    assert.equal(
      currentOpenRide(h.db, flow.requested.sessionToken, baseTime)?.role,
      "RIDER",
    );
    decideRequest(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      flow.requested.ride.request!.requestId,
      "ACCEPT",
      new Date(baseTime.getTime() + 2_000),
    );
    const capturedAt = new Date(baseTime.getTime() + 4_000).toISOString();
    submitLocation(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      { latitude: -33.868, longitude: 151.209, accuracyMeters: 10, capturedAt },
      new Date(baseTime.getTime() + 4_100),
    );
    submitLocation(
      h.db,
      flow.requested.sessionToken,
      flow.published.ride.rideId,
      { latitude: -33.855, longitude: 151.225, accuracyMeters: 10, capturedAt },
      new Date(baseTime.getTime() + 4_200),
    );
    beginRide(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      new Date(baseTime.getTime() + 5_000),
    );
    const code = getRide(
      h.db,
      flow.published.ride.rideId,
      flow.rider,
      new Date(baseTime.getTime() + 5_100),
    ).coRideCode!;
    confirmCoRideCode(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      code,
      new Date(baseTime.getTime() + 8_000),
    );
    assert.throws(
      () =>
        publishRide(
          h.db,
          flow.published.sessionToken,
          {
            ...driverInput,
            scheduledDepartureAt: new Date(
              baseTime.getTime() + 20 * 60_000,
            ).toISOString(),
          },
          new Date(baseTime.getTime() + 9_000),
        ),
      /OPEN_ITEM_EXISTS/,
    );
    completeCoRide(
      h.db,
      flow.requested.sessionToken,
      flow.published.ride.rideId,
      "CASH",
      new Date(baseTime.getTime() + 10_000),
      true,
    );
    assert.equal(
      currentOpenRide(
        h.db,
        flow.published.sessionToken,
        new Date(baseTime.getTime() + 11_000),
      ),
      null,
    );
    assert.equal(
      publishRide(
        h.db,
        flow.published.sessionToken,
        {
          ...driverInput,
          scheduledDepartureAt: new Date(
            baseTime.getTime() + 20 * 60_000,
          ).toISOString(),
        },
        new Date(baseTime.getTime() + 11_000),
      ).ride.status,
      "PUBLISHED",
    );
  } finally {
    h.close();
  }
});

test("requires fresh locations, confines live coordinates to the accepted pair, and confirms a single-use code", () => {
  const h = harness();
  try {
    const flow = sessions(h);
    const requestId = flow.requested.ride.request!.requestId;
    decideRequest(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      requestId,
      "ACCEPT",
      new Date(baseTime.getTime() + 2_000),
    );
    assert.throws(
      () =>
        beginRide(
          h.db,
          flow.published.sessionToken,
          flow.published.ride.rideId,
          new Date(baseTime.getTime() + 3_000),
        ),
      /FRESH_LOCATIONS_REQUIRED/,
    );
    const locationTime = new Date(baseTime.getTime() + 4_000).toISOString();
    submitLocation(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      {
        latitude: -33.868,
        longitude: 151.209,
        accuracyMeters: 10,
        capturedAt: locationTime,
      },
      new Date(baseTime.getTime() + 4_100),
    );
    submitLocation(
      h.db,
      flow.requested.sessionToken,
      flow.published.ride.rideId,
      {
        latitude: -33.855,
        longitude: 151.225,
        accuracyMeters: 10,
        capturedAt: locationTime,
      },
      new Date(baseTime.getTime() + 4_200),
    );
    const driverStarted = beginRide(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      new Date(baseTime.getTime() + 5_000),
    );
    assert.equal(driverStarted.status, "RIDE_ACTIVE");
    assert.equal(driverStarted.coRideCode, undefined);
    const riderStarted = getRide(
      h.db,
      flow.published.ride.rideId,
      flow.rider,
      new Date(baseTime.getTime() + 5_100),
    );
    assert.match(riderStarted.coRideCode ?? "", /^\d{4}$/);
    assert.ok(riderStarted.driverLocation);
    assert.equal((riderStarted as Record<string, unknown>).origin, undefined);
    assert.throws(
      () =>
        confirmCoRideCode(
          h.db,
          flow.published.sessionToken,
          flow.published.ride.rideId,
          "0000",
          new Date(baseTime.getTime() + 8_000),
        ),
      /CO_RIDE_CODE_INVALID/,
    );
    const active = confirmCoRideCode(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      riderStarted.coRideCode!,
      new Date(baseTime.getTime() + 11_000),
    );
    assert.equal(active.status, "CO_RIDE_ACTIVE");
    const riderActive = getRide(
      h.db,
      flow.published.ride.rideId,
      flow.rider,
      new Date(baseTime.getTime() + 11_100),
    );
    assert.equal(riderActive.payId, "driver@example.com");
    assert.equal(riderActive.payIdType, "EMAIL");
    assert.equal(active.payId, "driver@example.com");
    assert.equal(active.payIdType, "EMAIL");
    assert.throws(
      () =>
        confirmCoRideCode(
          h.db,
          flow.published.sessionToken,
          flow.published.ride.rideId,
          riderStarted.coRideCode!,
          new Date(baseTime.getTime() + 14_000),
        ),
      /CO_RIDE_CODE_EXPIRED/,
    );
    const expiryTime = new Date(
      baseTime.getTime() + 24 * 60 * 60 * 1_000 + 12_000,
    );
    assert.equal(expireStaleRides(h.db, expiryTime), 1);
    const expired = getRide(
      h.db,
      flow.published.ride.rideId,
      flow.driver,
      expiryTime,
    );
    assert.equal(expired.status, "EXPIRED");
    const remainingLocations = h.db
      .prepare("SELECT COUNT(*) AS count FROM live_locations")
      .get() as { count: number };
    assert.equal(remainingLocations.count, 0);
  } finally {
    h.close();
  }
});

test("cancellation ends a pre-co-ride pair, while completion removes live points and creates only private records", () => {
  const h = harness();
  try {
    const flow = sessions(h);
    decideRequest(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      flow.requested.ride.request!.requestId,
      "ACCEPT",
      new Date(baseTime.getTime() + 2_000),
    );
    const locationTime = new Date(baseTime.getTime() + 4_000).toISOString();
    submitLocation(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      {
        latitude: -33.868,
        longitude: 151.209,
        accuracyMeters: 10,
        capturedAt: locationTime,
      },
      new Date(baseTime.getTime() + 4_100),
    );
    submitLocation(
      h.db,
      flow.requested.sessionToken,
      flow.published.ride.rideId,
      {
        latitude: -33.855,
        longitude: 151.225,
        accuracyMeters: 10,
        capturedAt: locationTime,
      },
      new Date(baseTime.getTime() + 4_200),
    );
    beginRide(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      new Date(baseTime.getTime() + 5_000),
    );
    const code = getRide(
      h.db,
      flow.published.ride.rideId,
      flow.rider,
      new Date(baseTime.getTime() + 5_100),
    ).coRideCode!;
    confirmCoRideCode(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      code,
      new Date(baseTime.getTime() + 8_000),
    );
    assert.throws(
      () =>
        completeCoRide(
          h.db,
          flow.requested.sessionToken,
          flow.published.ride.rideId,
          null,
          new Date(baseTime.getTime() + 9_000),
        ),
      /COMPLETION_NOT_AT_DROPOFF/,
    );
    const complete = completeCoRide(
      h.db,
      flow.requested.sessionToken,
      flow.published.ride.rideId,
      "PAYID",
      new Date(baseTime.getTime() + 10_000),
      true,
    );
    assert.equal(complete.status, "COMPLETED");
    assert.deepEqual(
      h.db.prepare("SELECT COUNT(*) AS count FROM live_locations").get() as {
        count: number;
      },
      { count: 0 },
    );
    assert.equal(
      privateHistory(
        h.db,
        flow.published.sessionToken,
        new Date(baseTime.getTime() + 11_000),
      ).driver.length,
      1,
    );
    assert.equal(
      privateHistory(
        h.db,
        flow.requested.sessionToken,
        new Date(baseTime.getTime() + 11_000),
      ).rider.length,
      1,
    );
  } finally {
    h.close();
  }
});

test("private history keeps cancelled rides visible to the accepted pair", () => {
  const h = harness();
  try {
    const flow = sessions(h);
    decideRequest(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      flow.requested.ride.request!.requestId,
      "ACCEPT",
      new Date(baseTime.getTime() + 2_000),
    );
    const cancelledAt = new Date(baseTime.getTime() + 3_000);
    const cancelled = cancelRide(
      h.db,
      flow.published.sessionToken,
      flow.published.ride.rideId,
      cancelledAt,
    );
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.cancelledAt, cancelledAt.toISOString());
    const driverHistory = privateHistory(
      h.db,
      flow.published.sessionToken,
      new Date(baseTime.getTime() + 4_000),
    ).driver;
    const riderHistory = privateHistory(
      h.db,
      flow.requested.sessionToken,
      new Date(baseTime.getTime() + 4_000),
    ).rider;
    assert.equal(driverHistory[0]?.status, "CANCELLED");
    assert.equal(riderHistory[0]?.status, "CANCELLED");
  } finally {
    h.close();
  }
});

test("private history keeps expired rides visible to their driver and requester", () => {
  const h = harness();
  try {
    const flow = sessions(h);
    const expiredAt = new Date(baseTime.getTime() + 6 * 60 * 60_000 + 1);
    const driverHistory = privateHistory(
      h.db,
      flow.published.sessionToken,
      expiredAt,
    ).driver;
    const riderHistory = privateHistory(
      h.db,
      flow.requested.sessionToken,
      expiredAt,
    ).rider;
    assert.equal(driverHistory[0]?.status, "EXPIRED");
    assert.equal(riderHistory[0]?.status, "EXPIRED");
    assert.equal(driverHistory[0]?.expiredAt, expiredAt.toISOString());
  } finally {
    h.close();
  }
});

test("all three samples support late requests, exclusive use, completion and renewal", () => {
  const h = harness();
  try {
    ensureSampleRides(h.db, baseTime);
    const offers = availableRides(h.db, baseTime);
    let later = new Date(baseTime.getTime() + 12 * 60 * 60_000);
    for (const offer of offers) {
      const route = publicRidePreview(h.db, offer.rideId, later).plannedRoute;
      const input = {
        pickup: route.origin,
        destination: route.destination,
        requestedDepartureAt: later.toISOString(),
      };
      const requested = requestRide(h.db, null, offer.rideId, input, later);
      const token = requested.sessionToken!;
      assert.equal(requested.ride.status, "REQUESTED");
      assert.equal(requested.ride.request?.status, "PENDING");
      later = new Date(+later + 5_000);
      advanceSampleSimulations(h.db, later);
      assert.equal(requested.ride.isSample, true);
      assert.equal(
        availableRides(h.db, later).some((row) => row.rideId === offer.rideId),
        false,
      );
      assert.equal(
        ensureSampleRides(h.db, later),
        0,
        "no replacement while occupied",
      );
      assert.throws(
        () => requestRide(h.db, null, offer.rideId, input, later),
        /RIDE_UNAVAILABLE/,
      );
      const outsider = createGuestSession(h.db, later);
      assert.throws(
        () =>
          advanceSampleRide(h.db, outsider.token, offer.rideId, "START", later),
        /RIDE_ACCESS_DENIED/,
      );
      const started = advanceSampleRide(
        h.db,
        token,
        offer.rideId,
        "START",
        later,
      );
      assert.equal(started.status, "RIDE_ACTIVE");
      assert.match(started.coRideCode!, /^\d{4}$/);
      assert.equal(ensureSampleRides(h.db, later), 0);
      assert.equal(
        advanceSampleRide(h.db, token, offer.rideId, "PICKUP", later).status,
        "CO_RIDE_ACTIVE",
      );
      assert.equal(ensureSampleRides(h.db, later), 0);
      assert.equal(
        completeCoRide(h.db, token, offer.rideId, "CASH", later, true).status,
        "COMPLETED",
      );
      assert.equal(ensureSampleRides(h.db, later), 1);
      assert.equal(availableRides(h.db, later).length, 3);
      assert.equal(
        privateHistory(h.db, token, later).rider[0].status,
        "COMPLETED",
      );
    }
    const again = availableRides(h.db, later)[0];
    const route = publicRidePreview(h.db, again.rideId, later).plannedRoute;
    const request = requestRide(
      h.db,
      null,
      again.rideId,
      {
        pickup: route.origin,
        destination: route.destination,
        requestedDepartureAt: later.toISOString(),
      },
      later,
    );
    later = new Date(+later + 5_000);
    advanceSampleSimulations(h.db, later);
    cancelRide(h.db, request.sessionToken, again.rideId, later);
    advanceSampleSimulations(h.db, new Date(+later + 100_000));
    assert.equal(ensureSampleRides(h.db, later), 1);
    assert.equal(availableRides(h.db, later).length, 3);
    const real = publishRide(h.db, null, driverInput, baseTime);
    assert.throws(
      () =>
        advanceSampleRide(
          h.db,
          real.sessionToken,
          real.ride.rideId,
          "START",
          baseTime,
        ),
      /RIDE_ACCESS_DENIED/,
    );
  } finally {
    h.close();
  }
});

test("samples automatically accept at five seconds, approach, verify pickup and finish without rider GPS", () => {
  const h = harness();
  try {
    ensureSampleRides(h.db, baseTime);
    for (const offer of availableRides(h.db, baseTime)) {
      const route = publicRidePreview(
        h.db,
        offer.rideId,
        baseTime,
      ).plannedRoute;
      const pickup = {
        latitude: route.origin.latitude + 0.01,
        longitude: route.origin.longitude + 0.01,
      };
      const requested = requestRide(
        h.db,
        null,
        offer.rideId,
        {
          pickup,
          destination: route.destination,
          requestedDepartureAt: baseTime.toISOString(),
        },
        baseTime,
      );
      const rider = findSession(h.db, requested.sessionToken, baseTime)!;
      const at = (seconds: number) => new Date(+baseTime + seconds * 1000);
      const tick = (seconds: number) => {
        advanceSampleSimulations(h.db, at(seconds));
        return getRide(h.db, offer.rideId, rider, at(seconds));
      };
      assert.equal(tick(4.999).request?.status, "PENDING");
      const accepted = tick(5);
      assert.equal(accepted.status, "ACCEPTED");
      assert.match(accepted.coRideCode!, /^\d{4}$/);
      const halfway = tick(15);
      assert.ok(
        Math.abs(
          halfway.driverLocation!.latitude -
            (route.origin.latitude + pickup.latitude) / 2,
        ) < 0.000001,
      );
      const pickedUp = tick(25);
      assert.equal(pickedUp.status, "CO_RIDE_ACTIVE");
      assert.equal(pickedUp.pickupEstablished, true);
      assert.equal(pickedUp.coRideCode, undefined);
      assert.equal(pickedUp.driverLocation!.latitude, pickup.latitude);
      const travelling = tick(45);
      assert.equal(travelling.tracking?.source, "DRIVER");
      assert.ok(
        Math.abs(
          travelling.driverLocation!.latitude -
            (pickup.latitude + route.destination.latitude) / 2,
        ) < 0.000001,
      );
      assert.equal(tick(65).status, "COMPLETED");
      assert.equal(ensureSampleRides(h.db, at(65)), 1);
      assert.equal(tick(66).status, "COMPLETED");
    }
    const real = publishRide(h.db, null, driverInput, baseTime);
    const request = requestRide(
      h.db,
      null,
      real.ride.rideId,
      riderInput,
      baseTime,
    );
    advanceSampleSimulations(h.db, new Date(+baseTime + 60_000));
    assert.equal(
      getRide(
        h.db,
        real.ride.rideId,
        findSession(h.db, request.sessionToken, baseTime)!,
        baseTime,
      ).request?.status,
      "PENDING",
    );
  } finally {
    h.close();
  }
});

test("withdrawn sample requests are never automatically accepted", () => {
  const h = harness();
  try {
    ensureSampleRides(h.db, baseTime);
    const offer = availableRides(h.db, baseTime)[0];
    const route = publicRidePreview(h.db, offer.rideId, baseTime).plannedRoute;
    const request = requestRide(
      h.db,
      null,
      offer.rideId,
      {
        pickup: route.origin,
        destination: route.destination,
        requestedDepartureAt: baseTime.toISOString(),
      },
      baseTime,
    );
    cancelPendingRequest(
      h.db,
      request.sessionToken,
      offer.rideId,
      new Date(+baseTime + 1_000),
    );
    advanceSampleSimulations(h.db, new Date(+baseTime + 100_000));
    assert.equal(
      privateHistory(h.db, request.sessionToken, new Date(+baseTime + 100_000))
        .rider[0].request?.status,
      "CANCELLED",
    );
    assert.equal(availableRides(h.db, new Date(+baseTime + 100_000)).length, 3);
  } finally {
    h.close();
  }
});

test("cashless publishing rejects an empty PayID", () => {
  const h = harness();
  try {
    for (const payId of [undefined, "", "   "]) {
      assert.throws(
        () => publishRide(h.db, null, { ...driverInput, payId }, baseTime),
        /PAYID_REQUIRED/,
      );
    }
  } finally {
    h.close();
  }
});

test("sample payment fixtures cover mobile, email and ABN without leaking before pickup", () => {
  const h = harness();
  try {
    ensureSampleRides(h.db, baseTime);
    const types = new Set<string>();
    for (const offer of availableRides(h.db, baseTime)) {
      const route = publicRidePreview(h.db, offer.rideId, baseTime);
      assert.equal(route.paymentMethod, "PAYID");
      assert.equal("payId" in route, false);
      const requested = requestRide(
        h.db,
        null,
        offer.rideId,
        {
          pickup: route.plannedRoute.origin,
          destination: route.plannedRoute.destination,
          requestedDepartureAt: baseTime.toISOString(),
        },
        baseTime,
      );
      const rider = findSession(h.db, requested.sessionToken, baseTime)!;
      const acceptedAt = new Date(+baseTime + 5000);
      advanceSampleSimulations(h.db, acceptedAt);
      const accepted = getRide(h.db, offer.rideId, rider, acceptedAt);
      assert.equal(accepted.payId, undefined);
      assert.equal(accepted.payIdType, undefined);
      const pickedUpAt = new Date(+baseTime + 25000);
      advanceSampleSimulations(h.db, pickedUpAt);
      const pickedUp = getRide(h.db, offer.rideId, rider, pickedUpAt);
      types.add(pickedUp.payIdType!);
      assert.equal(
        pickedUp.payId,
        {
          MOBILE: "0491 570 006",
          EMAIL: "driver@example.com",
          OTHER: "00 000 000 000",
        }[pickedUp.payIdType!],
      );
    }
    assert.deepEqual([...types].sort(), ["EMAIL", "MOBILE", "OTHER"]);
  } finally {
    h.close();
  }
});

test("keeps three renewable sample rides available in 24-hour windows", () => {
  const h = harness();
  try {
    assert.equal(ensureSampleRides(h.db, baseTime), 3);
    assert.equal(ensureSampleRides(h.db, baseTime), 0);
    const samples = h.db
      .prepare(
        "SELECT status, sample_key, offer_expires_at FROM rides WHERE is_sample = 1 ORDER BY sample_key",
      )
      .all() as Array<{
      status: string;
      sample_key: string;
      offer_expires_at: string;
    }>;
    assert.equal(samples.length, 3);
    assert.deepEqual(
      samples.map((sample) => sample.sample_key),
      [
        "airport-watsons-bay",
        "newtown-bondi-icebergs",
        "town-hall-south-coogee",
      ],
    );
    assert.ok(
      samples.every(
        (sample) =>
          sample.offer_expires_at ===
          new Date(baseTime.getTime() + 24 * 60 * 60_000).toISOString(),
      ),
    );
    const renewalTime = new Date(baseTime.getTime() + 24 * 60 * 60_000 + 1);
    assert.equal(ensureSampleRides(h.db, renewalTime), 3);
    const openSamples = h.db
      .prepare(
        "SELECT COUNT(*) AS count FROM rides WHERE is_sample = 1 AND status IN ('PUBLISHED', 'REQUESTED')",
      )
      .get() as { count: number };
    assert.equal(openSamples.count, 3);
  } finally {
    h.close();
  }
});

test("withdrawn rider requests remain in history and the rider may request the same ride again", () => {
  const h = harness();
  try {
    const flow = sessions(h);
    const firstRequestId = flow.requested.ride.request!.requestId;
    const withdrawnAt = new Date(baseTime.getTime() + 2_000);
    const withdrawn = cancelPendingRequest(
      h.db,
      flow.requested.sessionToken,
      flow.published.ride.rideId,
      withdrawnAt,
    );
    assert.equal(withdrawn.status, "PUBLISHED");
    assert.equal(withdrawn.request?.status, "CANCELLED");
    assert.equal(withdrawn.request?.decidedAt, withdrawnAt.toISOString());

    const firstHistory = privateHistory(
      h.db,
      flow.requested.sessionToken,
      new Date(baseTime.getTime() + 3_000),
    ).rider;
    assert.equal(firstHistory.length, 1);
    assert.equal(firstHistory[0]?.request?.requestId, firstRequestId);
    assert.equal(firstHistory[0]?.request?.status, "CANCELLED");

    const requestedAgain = requestRide(
      h.db,
      flow.requested.sessionToken,
      flow.published.ride.rideId,
      riderInput,
      new Date(baseTime.getTime() + 4_000),
    );
    assert.equal(requestedAgain.ride.request?.status, "PENDING");
    assert.notEqual(requestedAgain.ride.request?.requestId, firstRequestId);
    assert.equal(
      currentOpenRides(
        h.db,
        flow.requested.sessionToken,
        new Date(baseTime.getTime() + 5_000),
      ).find((item) => item.role === "RIDER")?.ride.request?.requestId,
      requestedAgain.ride.request?.requestId,
    );
    assert.equal(
      privateHistory(
        h.db,
        flow.requested.sessionToken,
        new Date(baseTime.getTime() + 5_000),
      ).rider[0]?.request?.requestId,
      firstRequestId,
    );
  } finally {
    h.close();
  }
});
