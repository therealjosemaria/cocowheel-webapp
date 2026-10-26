import test from "node:test";
import assert from "node:assert/strict";
import { demandStatusLabel } from "../lib/rider-demand";

test("requested journey status uses consistent user-facing labels", () => {
  assert.equal(demandStatusLabel("OPEN"), "Open");
  assert.equal(demandStatusLabel("CANCELLED"), "Withdrawn");
  assert.equal(demandStatusLabel("FULFILLED"), "Fulfilled");
  assert.equal(demandStatusLabel("EXPIRED"), "Expired");
});
