import assert from "node:assert/strict";
import test from "node:test";
import { requestedRideUrl, MESSAGE_STARTER, DRIVER_MESSAGE_STARTER } from "../lib/messaging-types";

test("successful request targets its own conversation without a scroll anchor", () => {
  const url = new URL(
    requestedRideUrl("ride/a", "request&1"),
    "https://example.com",
  );
  assert.equal(url.pathname, "/activity/ride%2Fa");
  assert.equal(url.searchParams.get("request"), "request&1");
  assert.equal(url.searchParams.has("compose"), false);
  assert.equal(url.hash, "");
  assert.equal(url.searchParams.has("text"), false);
  assert.equal(MESSAGE_STARTER, "Hi! Where should we meet?");
  assert.equal(DRIVER_MESSAGE_STARTER, "Hi! Where would you like me to pick you up?");
});
