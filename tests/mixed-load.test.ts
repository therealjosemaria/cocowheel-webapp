import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
test("mixed load is opt-in, bounded and rejects external targets", () => {
  const valid = [
    "--run",
    "--maintenance-confirmed",
    "--users=25",
    "--seconds=120",
  ];
  for (const args of [
    [],
    ["--run"],
    [...valid, "--target=https://gumwheel.com"],
    [...valid, "--users=100"],
    ["--run", "--maintenance-confirmed", "--users=101", "--seconds=120"],
    ["--run", "--maintenance-confirmed", "--users=100", "--seconds=601"],
    ["--database=data/cocowheels.db"],
  ]) {
    const r = spawnSync(process.execPath, ["scripts/mixed-load.mjs", ...args], {
      encoding: "utf8",
      timeout: 5000,
      env: { PATH: process.env.PATH },
    });
    assert.equal(r.status, args.length ? 1 : 0);
    assert.doesNotMatch(r.stdout, /report.json/);
  }
});
