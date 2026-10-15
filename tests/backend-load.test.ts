import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const run = (...args: string[]) =>
  spawnSync(process.execPath, ["scripts/backend-load.mjs", ...args], {
    encoding: "utf8",
    timeout: 5000,
    env: { PATH: process.env.PATH },
  });

test("load harness defaults to instructions, not a running load test", () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.match(result.stdout, /no server started/);
});

test("load harness refuses unsafe or ambiguous arguments before startup", () => {
  for (const args of [
    ["--run"],
    ["--run", "--maintenance-confirmed", "--trips=251"],
    ["--run", "--maintenance-confirmed", "--seconds=601"],
    ["--run", "--maintenance-confirmed", "--seconds=1"],
    ["--smoke", "--trips=2"],
    ["--smoke", "--run"],
    ["--run", "--maintenance-confirmed", "--trips=1", "--trips=5"],
    ["--target=https://gumwheel.com"],
    ["--database=data/cocowheels.db"],
    ["--run", "--maintenance-confirmed", "--gps=unknown"],
    ["--run", "--maintenance-confirmed", "--workload=history", "--history=101"],
    ["--run", "--maintenance-confirmed", "--workload=history", "--history=0"],
    ["--run", "--maintenance-confirmed", "--history=20"],
    ["--run", "--maintenance-confirmed", "--profile", "--profile"],
  ]) {
    const result = run(...args);
    assert.equal(result.status, 1, args.join(" "));
    assert.doesNotMatch(result.stdout, /report.json/);
  }
});
