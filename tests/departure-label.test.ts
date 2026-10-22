import test from "node:test";
import assert from "node:assert/strict";
import { departureLabel, departureTone, plannedDepartureTime } from "../lib/departure-label";

test("departure colours share exact ten-minute and delayed boundaries", () => {
  const scheduled = "2026-10-22T04:00:00Z";
  const time = Date.parse(scheduled);
  for (const [offset, tone] of [[-600001, "scheduled"], [-600000, "soon"], [-1, "soon"], [0, "soon"], [59999, "soon"], [60000, "delayed"]] as const) {
    assert.equal(departureTone(scheduled, time + offset), tone);
  }
  assert.equal(departureTone("invalid", time), "neutral");
});

test("departure display separates waiting, current minute and overdue schedule", () => {
  const scheduled = "2026-10-22T04:00:00Z";
  const time = Date.parse(scheduled);
  assert.equal(departureLabel(scheduled, time - 3600000), "Departs in 60 min");
  assert.equal(departureLabel(scheduled, time - 1), "Departs in 1 min");
  assert.equal(departureLabel(scheduled, time), "Departing now");
  assert.equal(departureLabel(scheduled, time + 59999), "Departing now");
  assert.equal(departureLabel(scheduled, time + 60000), "Delayed 1 min");
  assert.equal(departureLabel(scheduled, time + 119999), "Delayed 1 min");
  assert.equal(departureLabel(scheduled, time + 900000), "Delayed 15 min");
  assert.equal(departureLabel(scheduled, time + 7200000), "Delayed 120 min");
  assert.equal(departureLabel("invalid", time), "");
});

test("planned departure uses Sydney time including daylight savings", () => {
  assert.equal(plannedDepartureTime("2026-10-22T04:00:00Z"), "3:00 pm");
  assert.equal(plannedDepartureTime("2026-06-22T04:00:00Z"), "2:00 pm");
  assert.equal(plannedDepartureTime("invalid"), "");
});
