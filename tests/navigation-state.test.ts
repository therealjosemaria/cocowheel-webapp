import assert from "node:assert/strict";
import test from "node:test";
import { activeRideTabForPath } from "../lib/navigation-state";

test("remembered ride tabs cannot remain highlighted after navigating to Activity", () => {
  for (const role of ["driver", "rider"] as const) {
    for (const path of ["/help", "/privacy", "/terms", "/activity", "/activity/TEST", "/admin", "/rides/TEST"]) {
      assert.equal(activeRideTabForPath(path, role), null);
    }
    assert.equal(activeRideTabForPath("/", role), role);
  }
  assert.equal(activeRideTabForPath("/", null), null);
});
