import test from "node:test";
import assert from "node:assert/strict";
import { secondsRemaining } from "../lib/use-code-cooldown";
test("cooldown uses elapsed wall time, rounds up and never goes negative", () => {
  assert.equal(secondsRemaining(60000, 0), 60);
  assert.equal(secondsRemaining(60000, 15000), 45);
  assert.equal(secondsRemaining(60000, 59999), 1);
  assert.equal(secondsRemaining(60000, 60000), 0);
  assert.equal(secondsRemaining(60000, 90000), 0);
});
