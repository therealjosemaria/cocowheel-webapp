import assert from "node:assert/strict";
import test from "node:test";
import { participantStatusLabel, rideStatusLabel } from "../lib/ride-status";

test("requests do not change the published ride label", () => {
  assert.equal(rideStatusLabel("PUBLISHED"), "Published");
  assert.equal(rideStatusLabel("REQUESTED"), "Published");
  assert.equal(
    participantStatusLabel("REQUESTED", "PENDING"),
    "Request pending",
  );
});

test("acceptance awaits pickup until the pickup code is verified", () => {
  for (const status of ["ACCEPTED", "RIDE_ACTIVE"] as const) {
    assert.equal(rideStatusLabel(status), "Awaiting pickup");
    assert.equal(participantStatusLabel(status), "Awaiting pickup");
    assert.equal(participantStatusLabel(status, "ACCEPTED"), "Awaiting pickup");
  }
  assert.equal(rideStatusLabel("CO_RIDE_ACTIVE"), "Ride in progress");
  assert.equal(participantStatusLabel("CO_RIDE_ACTIVE"), "Ride in progress");
  assert.equal(
    participantStatusLabel("CO_RIDE_ACTIVE", "ACCEPTED"),
    "Ride in progress",
  );
});

test("ride and individual request outcomes stay distinct", () => {
  assert.equal(participantStatusLabel("COMPLETED", "ACCEPTED"), "Completed");
  assert.equal(participantStatusLabel("EXPIRED", "PENDING"), "Expired");
  assert.equal(participantStatusLabel("CANCELLED", "CANCELLED"), "Cancelled");
  assert.equal(participantStatusLabel("PUBLISHED", "CANCELLED"), "Withdrawn");
  assert.equal(participantStatusLabel("ACCEPTED", "DECLINED"), "Declined");
  assert.equal(
    participantStatusLabel("CO_RIDE_ACTIVE", "DISCARDED"),
    "Unavailable",
  );
  assert.equal(participantStatusLabel("COMPLETED", "CANCELLED"), "Withdrawn");
});
