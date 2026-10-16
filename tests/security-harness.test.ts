import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("security campaign requires opt-in and rejects live targets", () => {
  for (const args of [
    [],
    ["--run", "extra"],
    ["--target=https://gumwheel.com"],
    ["--database=data/cocowheels.db"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/security-check.mjs", ...args],
      { encoding: "utf8", timeout: 5000, env: { PATH: process.env.PATH } },
    );
    assert.equal(result.status, args.length ? 1 : 0);
    assert.match(result.stdout, /synthetic only/);
    assert.doesNotMatch(result.stdout, /Sanitized report:|PASS /);
  }
});
