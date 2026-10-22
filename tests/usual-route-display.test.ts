import assert from "node:assert/strict";
import test from "node:test";
import { scheduleWindow } from "../lib/usual-route";

test("Profile schedule omits timezone prose but retains its window and midnight context", () => {
  assert.equal(scheduleWindow(600), "9:00 am–11:00 am");
  assert.equal(scheduleWindow(0), "11:00 pm–1:00 am (crosses midnight)");
  assert.equal(scheduleWindow(1380), "10:00 pm–12:00 am (crosses midnight)");
});
