import assert from "node:assert/strict";
import test from "node:test";
import { routeAlertContent } from "../server/route-alert-email";

test("matching email escapes untrusted text and links, retains plain text and no reservation copy", () => {
  const email = routeAlertContent("https://gumwheel.com/", 'ride&"x', '<img src=x onerror="bad">', "2026-10-23T01:00:00Z", 0);
  assert.ok(email.html.includes('&lt;img src=x onerror=&quot;bad&quot;&gt;'));
  assert.ok(!email.html.includes('<img'));
  assert.ok(email.html.includes('?start=rider&amp;match=ride%26%22x'));
  assert.ok(email.html.includes('Free'));
  assert.ok(email.text.startsWith('A matching ride from '));
  assert.ok(email.text.includes('Coordinate pickup in messages.'));
  assert.ok(!email.text.includes('Times are flexible'));
  assert.ok(!email.html.includes('Sydney time'));
  assert.ok(email.text.includes('View matching ride: https://gumwheel.com/?start=rider&match=ride%26%22x'));
  assert.ok(email.text.includes('Mute matching emails: https://gumwheel.com/usual-route?alerts=1'));
  assert.ok(!email.text.includes('reservation'));
});
