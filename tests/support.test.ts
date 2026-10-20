import assert from "node:assert/strict";
import test from "node:test";
import { supportWhatsAppUrl } from "../lib/support";

test("support uses international Australian number and an encoded editable reference", () => {
  const rideId = "ride/a?x=1&other=2#fragment";
  const url = new URL(supportWhatsAppUrl(rideId));
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/61452340432");
  assert.deepEqual([...url.searchParams.keys()], ["text"]);
  assert.equal(url.searchParams.get("text"), `Hi José, I’d like to report a concern about my GUMWHEEL ride. Reference: ${rideId}`);
  assert.equal(url.hash, "");
});
