import test from "node:test";
import assert from "node:assert/strict";
import { rideUpdates } from "../lib/ride-updates";
import type { Ride } from "../lib/client-types";

const pin = { latitude: 0, longitude: 0 };
const request = {
  requestId: "req",
  riderAlias: "student",
  status: "PENDING" as const,
  pickup: pin,
  destination: pin,
  createdAt: "2026-10-19",
  requestedDepartureAt: "2026-10-19",
  directionFit: "GOOD" as const,
};
const ride: Ride = {
  rideId: "ride",
  driverAlias: "driver1234",
  status: "REQUESTED",
  priceAud: 5,
  scheduledDepartureAt: "",
  expiresAt: "",
  requests: [request],
  request,
};
test("only driver pending requests generate request notifications", () => {
  assert.equal(rideUpdates({ role: "DRIVER", ride }).length, 1);
  assert.equal(rideUpdates({ role: "RIDER", ride }).length, 0);
  assert.equal(
    rideUpdates({
      role: "DRIVER",
      ride: { ...ride, requests: [{ ...request, status: "DECLINED" }] },
    }).length,
    0,
  );
});
test("acceptance names the driver and belongs only to the accepted rider", () => {
  const accepted: Ride = {
    ...ride,
    status: "ACCEPTED",
    request: { ...request, status: "ACCEPTED" },
  };
  assert.equal(
    rideUpdates({ role: "RIDER", ride: accepted })[0].message,
    "driver1234 accepted your request",
  );
  assert.equal(
    rideUpdates({
      role: "RIDER",
      ride: { ...accepted, request: { ...request, status: "DISCARDED" } },
    }).length,
    0,
  );
  assert.equal(
    rideUpdates({
      role: "RIDER",
      ride: { ...accepted, pickupEstablished: true },
    }).length,
    0,
  );
  assert.equal(
    rideUpdates({ role: "RIDER", ride: { ...accepted, status: "COMPLETED" } })
      .length,
    0,
  );
});
test("re-request creates a new unread event without polling duplicates", () => {
  const first = rideUpdates({ role: "DRIVER", ride })[0];
  assert.equal(first.key, rideUpdates({ role: "DRIVER", ride })[0].key);
  assert.notEqual(
    first.key,
    rideUpdates({
      role: "DRIVER",
      ride: { ...ride, requests: [{ ...request, createdAt: "2026-10-20" }] },
    })[0].key,
  );
  assert.deepEqual(rideUpdates(null), []);
});
