import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeAnalyticsEvent } from "../lib/analytics-privacy";

test("analytics keeps only approved page URLs without query or fragment", () => {
  for (const path of ["/", "/help", "/about", "/privacy", "/terms", "/activity", "/usual-route"]) {
    assert.deepEqual(sanitizeAnalyticsEvent({ type: "pageview", url: `https://gumwheel.com${path}?email=private&rideId=secret#private` }), {
      type: "pageview", url: `https://gumwheel.com${path}`,
    });
  }
});

test("analytics drops ride details, admin, APIs and unknown paths", () => {
  for (const path of ["/rides/COCO-secret", "/activity/COCO-secret", "/admin", "/api/health", "/unknown", "/help/private"]) {
    assert.equal(sanitizeAnalyticsEvent({ type: "pageview", url: `https://gumwheel.com${path}` }), null);
  }
});

test("analytics rejects custom events and malformed URLs", () => {
  assert.equal(sanitizeAnalyticsEvent({ type: "event", url: "https://gumwheel.com/" }), null);
  for (const url of ["bad", "/activity", "javascript:alert(1)", "file:///help"]) {
    assert.equal(sanitizeAnalyticsEvent({ type: "pageview", url }), null);
  }
});
