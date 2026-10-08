import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openDatabase } from "../server/db";
import {
  beginRide,
  cancelRide,
  completeCoRide,
  confirmCoRideCode,
  currentOpenRide,
  currentOpenRides,
  decideRequest,
  findSession,
  getRide,
  initializeCoreSchema,
  privateHistory,
  publicRidePreview,
  publishRide,
  requestRide,
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
};
const riderInput = {
  pickup: { latitude: -33.855, longitude: 151.225, label: "Rider pickup" },
  destination: {
    latitude: -33.82,
    longitude: 151.265,
    label: "Rider destination",
  },
  requestedDepartureAt: departure,
};

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

test("publishes a fixed-price offer and returns only a redacted direction corridor to discovery", () => {
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
    const preview = publicRidePreview(h.db, published.ride.rideId, baseTime);
    assert.equal("plannedRoute" in preview, false);
    assert.notDeepEqual(preview.redactedCorridor[0], driverInput.origin);
    assert.notDeepEqual(preview.redactedCorridor[1], driverInput.destination);
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

test("a guest may hold one driver offer and one unrelated rider request, but never match itself", () => {
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
    requestRide(
      h.db,
      ownOffer.sessionToken,
      otherOffer.ride.rideId,
      riderInput,
      new Date(baseTime.getTime() + 3_000),
    );
    assert.deepEqual(
      currentOpenRides(h.db, ownOffer.sessionToken, new Date(baseTime.getTime() + 4_000)).map(
        (item) => item.role,
      ),
      ["DRIVER", "RIDER"],
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
      /ROLE_CHANGE_REQUIRES_TERMINATION/,
    );
    assert.throws(
      () =>
        publishRide(
          h.db,
          ownOffer.sessionToken,
          driverInput,
          new Date(baseTime.getTime() + 6_000),
        ),
      /OPEN_ITEM_EXISTS/,
    );
    assert.throws(
      () =>
        requestRide(
          h.db,
          ownOffer.sessionToken,
          otherOffer.ride.rideId,
          riderInput,
          new Date(baseTime.getTime() + 7_000),
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
    const accepted = decideRequest(
      h.db,
      first.published.sessionToken,
      first.published.ride.rideId,
      first.requested.ride.request!.requestId,
      "ACCEPT",
      new Date(baseTime.getTime() + 3_000),
    );
    assert.equal(accepted.status, "ACCEPTED");
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
    assert.equal(active.payId, undefined);
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
        cancelRide(
          h.db,
          flow.requested.sessionToken,
          flow.published.ride.rideId,
          new Date(baseTime.getTime() + 9_000),
        ),
      /CANCELLATION_NOT_ALLOWED/,
    );
    const complete = completeCoRide(
      h.db,
      flow.requested.sessionToken,
      flow.published.ride.rideId,
      "PAYID",
      new Date(baseTime.getTime() + 10_000),
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
