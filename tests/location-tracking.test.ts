import assert from "node:assert/strict";
import test from "node:test";
import { movementTracker } from "../lib/location-tracking";

test("GPS drift does not trigger moving mode; repeated displacement does", () => {
  const track = movementTracker();
  const origin = { latitude: -33.87, longitude: 151.2, accuracyMeters: 20 };
  assert.equal(track(origin), false);
  assert.equal(track({ ...origin, latitude: -33.8699 }), false);
  const away = { ...origin, latitude: -33.868 };
  assert.equal(track(away), false);
  assert.equal(track(away), true);
  assert.equal(track(away), true);
  assert.equal(track(away), true);
  assert.equal(track(away), false);
});
