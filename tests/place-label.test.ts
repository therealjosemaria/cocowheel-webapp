import assert from "node:assert/strict";
import test from "node:test";
import { reversePlaceLabel } from "../server/place-label";

test("reverse place labels use the server key and prefer a nearby named place", async () => {
  let requested: URL | null = null;
  const label = await reversePlaceLabel(
    { latitude: -33.8688, longitude: 151.2093 },
    "private-test-key",
    async (input) => {
      requested = new URL(input);
      return new Response(
        JSON.stringify({
          results: [
            {
              name: "State Library of New South Wales",
              address_line1: "Macquarie Street",
            },
          ],
        }),
        { status: 200 },
      );
    },
  );
  assert.equal(label, "State Library of New South Wales");
  assert.ok(requested);
  assert.equal(requested.searchParams.get("lat"), "-33.8688");
  assert.equal(requested.searchParams.get("lon"), "151.2093");
  assert.equal(requested.searchParams.get("apiKey"), "private-test-key");
});

test("reverse place labels fail closed when the provider cannot respond", async () => {
  await assert.rejects(
    reversePlaceLabel(
      { latitude: -33.8688, longitude: 151.2093 },
      "private-test-key",
      async () => new Response("unavailable", { status: 503 }),
    ),
    /PLACE_LOOKUP_UNAVAILABLE/,
  );
});
