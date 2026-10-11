import assert from "node:assert/strict";
import test from "node:test";
import {
  atDropoff,
  journeyEvidence,
  nextCaptureAt,
} from "../lib/journey-location";

test("server schedules alternating 20-second devices or 10-second single-device fallback", () => {
  assert.equal(nextCaptureAt(1, 0, "RIDER", true), 20000);
  assert.equal(nextCaptureAt(1, 0, "DRIVER", true), 10000);
  assert.equal(nextCaptureAt(10001, 0, "DRIVER", true), 30000);
  assert.equal(nextCaptureAt(10001, 0, "RIDER", true), 20000);
  assert.equal(nextCaptureAt(20001, 0, "RIDER", false), 30000);
});
test("arrival checks capture time and accuracy, while cross-check reports divergence", () => {
  const now = Date.now();
  const fix = {
    latitude: -33.88,
    longitude: 151.21,
    accuracyMeters: 10,
    capturedAt: new Date(now).toISOString(),
    stale: false,
  };
  assert.equal(atDropoff(fix, fix, now), true);
  assert.equal(atDropoff(fix, fix, now + 31000), false);
  assert.equal(atDropoff({ ...fix, accuracyMeters: 101 }, fix, now), false);
  assert.equal(journeyEvidence(fix, { ...fix }, now).agreement, "ALIGNED");
  assert.equal(
    journeyEvidence(fix, { ...fix, latitude: -34 }, now).agreement,
    "DIVERGED",
  );
  assert.equal(journeyEvidence(undefined, fix, now).source, "RIDER");
  assert.equal(journeyEvidence(fix, undefined, now + 31000).agreement, "STALE");
});
