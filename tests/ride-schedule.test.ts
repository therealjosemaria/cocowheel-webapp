import assert from "node:assert/strict";
import test from "node:test";
import { calendarDay, initialDeparture, lastDepartureDate, scheduleDayBounds, sydneyDateTime, sydneyInstant } from "../lib/ride-schedule";

test("Sydney date ranges use calendar months, clamp month ends and span years", () => {
  assert.equal(lastDepartureDate(new Date("2026-10-25T00:00Z")), "2027-01-25");
  assert.equal(lastDepartureDate(new Date("2026-01-31T00:00Z")), "2026-04-30");
  assert.equal(lastDepartureDate(new Date("2027-11-30T00:00Z")), "2028-02-29");
  assert.equal(calendarDay("2026-12-31", 1), "2027-01-01");
});
test("Sydney conversion rejects invalid and missing times, defines repeated time", () => {
  assert.equal(sydneyInstant("2026-10-04", "02:30"), null);
  assert.equal(sydneyInstant("2026-04-05", "02:30"), "2026-04-04T15:30:00.000Z");
  assert.equal(sydneyInstant("2026-02-30", "12:00"), null);
  assert.equal(sydneyInstant("2026-10-25", "24:00"), null);
  assert.equal(sydneyInstant("2026-10-25", "09:00"), "2026-10-24T22:00:00.000Z");
  assert.equal(sydneyDateTime("2026-10-24T22:00Z").time, "09:00");
});
test("DST search dates have 23/25 hours, defaults round to a future half hour", () => {
  for (const [date, hours] of [["2026-10-04", 23], ["2026-04-05", 25]] as const) {
    const [start, end] = scheduleDayBounds(date)!;
    assert.equal(Date.parse(end) - Date.parse(start), hours * 3600000);
  }
  assert.deepEqual(initialDeparture(Date.parse("2026-10-25T12:45Z")), { date: "2026-10-26", time: "00:30" });
});
