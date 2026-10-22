import test from "node:test";
import assert from "node:assert/strict";
import {
  cachedDurationLookup,
  extraDrivingLabel,
  extraDrivingSeconds,
} from "../lib/extra-driving";

const pins = [0, 1, 2, 3].map((latitude) => ({ latitude, longitude: 0 }));
test("compares ordered pickup/drop-off legs with the original drive", async () => {
  const calls: number[][] = [];
  const value = await extraDrivingSeconds(
    pins[0],
    pins[3],
    pins[1],
    pins[2],
    async (a, b) => {
      calls.push([a.latitude, b.latitude]);
      return a === pins[0] && b === pins[3] ? 1500 : 660;
    },
  );
  assert.deepEqual(calls, [
    [0, 3],
    [0, 1],
    [1, 2],
    [2, 3],
  ]);
  assert.equal(value, 480);
  assert.equal(extraDrivingLabel(value), "About 8 min");
});
test("invalid or failed legs never become zero extra", async () => {
  for (const invalid of [null, NaN, Infinity, -1]) {
    await assert.rejects(
      extraDrivingSeconds(
        pins[0],
        pins[3],
        pins[1],
        pins[2],
        async () => invalid,
      ),
    );
  }
  await assert.rejects(
    extraDrivingSeconds(pins[0], pins[3], pins[1], pins[2], async () => {
      throw Error("offline");
    }),
  );
  assert.equal(
    await extraDrivingSeconds(
      pins[0],
      pins[3],
      pins[1],
      pins[2],
      async (a, b) => (a === pins[0] && b === pins[3] ? 3000 : 600),
    ),
    0,
  );
});
test("duration labels handle small and hour-long detours", () => {
  assert.equal(extraDrivingLabel(0), "Less than 1 min");
  assert.equal(extraDrivingLabel(61), "About 2 min");
  assert.equal(extraDrivingLabel(3600), "About 1 hr");
  assert.equal(extraDrivingLabel(6540), "About 1 hr 49 min");
});
test("cache deduplicates, expires, bounds memory and does not retain failures", async () => {
  let calls = 0,
    time = 0;
  const lookup = cachedDurationLookup(
    async () => {
      calls++;
      return 60;
    },
    () => time,
  );
  await Promise.all([lookup(pins[0], pins[1]), lookup(pins[0], pins[1])]);
  assert.equal(calls, 1);
  await lookup(pins[0], pins[0]);
  assert.equal(calls, 1);
  time = 300001;
  await lookup(pins[0], pins[1]);
  assert.equal(calls, 2);
  for (let i = 2; i < 103; i++)
    await lookup(pins[0], { latitude: i, longitude: 0 });
  await lookup(pins[0], pins[1]);
  assert.equal(calls, 104);
  let failures = 0;
  const failing = cachedDurationLookup(async () => {
    failures++;
    return null;
  });
  await assert.rejects(failing(pins[0], pins[1]));
  await assert.rejects(failing(pins[0], pins[1]));
  assert.equal(failures, 2);
});
