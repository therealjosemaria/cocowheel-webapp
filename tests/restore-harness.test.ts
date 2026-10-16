import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("restore drill requires explicit opt-in and rejects production targets", () => {
  for (const args of [
    [],
    ["--database=data/cocowheels.db"],
    ["--run", "extra"],
    ["--target=https://gumwheel.com"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/restore-check.mjs", ...args],
      {
        encoding: "utf8",
        timeout: 5000,
        env: { PATH: process.env.PATH },
      },
    );
    assert.equal(result.status, args.length ? 1 : 0);
    assert.match(result.stdout, /synthetic data only/);
    assert.doesNotMatch(result.stdout, /Sanitized report:|PASS /);
  }
});
