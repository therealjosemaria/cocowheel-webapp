import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("recovery checks require explicit opt-in and reject external targets", () => {
  for (const args of [
    [],
    ["--target=https://gumwheel.com"],
    ["--database=data/cocowheels.db"],
    ["--run", "extra"],
    ["--worker"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/recovery-check.mjs", ...args],
      {
        encoding: "utf8",
        timeout: 5000,
        env: { PATH: process.env.PATH, NODE_ENV: "test" },
      },
    );
    assert.equal(result.status, args.length ? 1 : 0);
    assert.doesNotMatch(result.stdout, /Report:|PASS /);
    if (!args.length) assert.match(result.stdout, /no server started/);
  }
});
