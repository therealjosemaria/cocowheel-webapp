import test from "node:test";
import assert from "node:assert/strict";
import { sortActivity } from "../lib/activity-order";

test("Activity mixes roles and item kinds, active first then creation newest first", () => {
  const items = [
    { id: "driver", active: true, createdAt: "2026-10-28T01:00:00Z" },
    { id: "closed-offer", active: false, createdAt: "2026-10-28T05:00:00Z" },
    { id: "request", active: true, createdAt: "2026-10-28T02:00:00Z" },
    { id: "pending-offer", active: true, createdAt: "2026-10-28T03:00:00Z" },
    { id: "old-history", active: false, createdAt: "2026-10-27T00:00:00Z" },
  ];
  assert.deepEqual(sortActivity(items).map(x => x.id), ["pending-offer", "request", "driver", "closed-offer", "old-history"]);
  assert.equal(items[0].id, "driver");
  assert.equal(sortActivity(items.map(x => x.id === "pending-offer" ? { ...x, active: false } : x))[0].id, "request");
});
test("missing or invalid legacy creation dates stay deterministic without hiding active items", () => {
  assert.deepEqual(sortActivity([
    { id: "b", active: true }, { id: "a", active: true, createdAt: "invalid" },
    { id: "new", active: false, createdAt: "2026-10-28T05:00:00Z" },
  ]).map(x => x.id), ["a", "b", "new"]);
});
