import test from "node:test";
import assert from "node:assert/strict";
import { departureLabel } from "../lib/departure-label";

test("departure display separates waiting, current minute and overdue schedule", () => {
  const scheduled = "2026-10-22T04:00:00Z";
  const time = Date.parse(scheduled);
  assert.equal(departureLabel(scheduled, time - 3600000), "Departs in 60 min");
  assert.equal(departureLabel(scheduled, time - 1), "Departs in 1 min");
  assert.equal(departureLabel(scheduled, time), "Departing now");
  assert.equal(departureLabel(scheduled, time + 59999), "Departing now");
  assert.equal(departureLabel(scheduled, time + 60000), "Delayed");
  assert.equal(departureLabel("invalid", time), "");
});
