import test from "node:test";
import assert from "node:assert/strict";
import { secondsRemaining } from "../lib/use-code-cooldown";
import { codeCooldownLabel } from "../lib/verification-message";
test("button wait uses rounded-up minutes and seconds below one minute", () => {
  for (const [seconds, label] of [
    [500, "9 min"],
    [780, "13 min"],
    [61, "2 min"],
    [60, "1 min"],
    [59, "59s"],
    [1, "1s"],
  ] as const)
    assert.equal(codeCooldownLabel(seconds), label);
});
test("cooldown uses elapsed wall time, rounds up and never goes negative", () => {
  assert.equal(secondsRemaining(60000, 0), 60);
  assert.equal(secondsRemaining(60000, 15000), 45);
  assert.equal(secondsRemaining(60000, 59999), 1);
  assert.equal(secondsRemaining(60000, 60000), 0);
  assert.equal(secondsRemaining(60000, 90000), 0);
});
