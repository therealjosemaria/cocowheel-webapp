import assert from "node:assert/strict";
import test from "node:test";
import { directionsUrl } from "../lib/directions";

test("directions use the saved coordinates and let Maps determine current origin", () => {
  const url = new URL(
    directionsUrl({
      latitude: -33.88,
      longitude: 151.21,
      label: "Pickup & drop-off",
    }),
  );
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.pathname, "/maps/dir/");
  assert.equal(url.searchParams.get("destination"), "-33.88,151.21");
  assert.equal(url.searchParams.get("api"), "1");
  assert.equal(url.searchParams.get("travelmode"), "driving");
  assert.equal(url.searchParams.has("origin"), false);
});
