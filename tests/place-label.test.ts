import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { initializeCoreSchema } from "../server/core";
import { reversePlaceLabel, reversePlaceDetails, searchPlaces } from "../server/place-label";

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

test("reverse place lookup returns the selected pickup country", async () => {
  const place = await reversePlaceDetails(
    { latitude: -33.8688, longitude: 151.2093 },
    "private-test-key",
    async () =>
      new Response(
        JSON.stringify({ results: [{ formatted: "Sydney NSW, Australia", country_code: "AU" }] }),
        { status: 200 },
      ),
  );
  assert.equal(place.countryCode, "au");
});

test("reverse place results are reused from SQLite for seven days", async () => {
  const database = new Database(":memory:");
  initializeCoreSchema(database);
  let requests = 0;
  const fetcher: typeof fetch = async () => {
    requests += 1;
    return new Response(
      JSON.stringify({ results: [{ formatted: "Bondi Beach NSW, Australia", country_code: "AU" }] }),
      { status: 200 },
    );
  };
  const pin = { latitude: -33.8915, longitude: 151.2767 };
  const first = await reversePlaceDetails(pin, "private-test-key", fetcher, database);
  const second = await reversePlaceDetails(pin, "private-test-key", fetcher, database);
  assert.equal(first.label, "Bondi Beach NSW, Australia");
  assert.deepEqual(second, first);
  assert.equal(requests, 1);
  const expiry = database
    .prepare("SELECT expires_at FROM place_lookup_cache")
    .get() as { expires_at: string };
  assert.ok(new Date(expiry.expires_at).getTime() > Date.now() + 6 * 24 * 60 * 60 * 1_000);
  database.close();
});

test("destination search biases place suggestions toward pickup", async () => {
  let requested: URL | null = null;
  await searchPlaces(
    "Miami",
    { latitude: -33.8688, longitude: 151.2093 },
    "au",
    "private-test-key",
    async (input) => {
      requested = new URL(input);
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    },
  );
  assert.ok(requested);
  assert.equal(requested.searchParams.get("bias"), "proximity:151.2093,-33.8688");
  assert.equal(requested.searchParams.get("filter"), "countrycode:au");
});
