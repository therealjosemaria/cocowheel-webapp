import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { initializeCoreSchema } from "../server/core";
import { roadRoutePreview } from "../server/route-preview";

test("road route previews convert Geoapify GeoJSON into Leaflet pins", async () => {
  let requested: URL | null = null;
  const points = await roadRoutePreview(
    { latitude: -33.87, longitude: 151.21 },
    { latitude: -33.88, longitude: 151.22 },
    "private-test-key",
    async (input) => {
      requested = new URL(input);
      return new Response(
        JSON.stringify({
          features: [
            {
              properties: { distance: 2350, time: 420 },
              geometry: {
                type: "MultiLineString",
                coordinates: [
                  [
                    [151.21, -33.87],
                    [151.215, -33.875],
                  ],
                  [[151.22, -33.88]],
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    },
  );
  assert.equal(requested?.searchParams.get("mode"), "drive");
  assert.equal(requested?.searchParams.get("traffic"), "approximated");
  assert.equal(
    requested?.searchParams.get("waypoints"),
    "-33.87,151.21|-33.88,151.22",
  );
  assert.deepEqual(points, {
    points: [
      { latitude: -33.87, longitude: 151.21 },
      { latitude: -33.875, longitude: 151.215 },
      { latitude: -33.88, longitude: 151.22 },
    ],
    distanceMeters: 2350,
    durationSeconds: 420,
  });
});

test("road route previews fail closed for unusable provider geometry", async () => {
  await assert.rejects(
    roadRoutePreview(
      { latitude: -33.89, longitude: 151.23 },
      { latitude: -33.9, longitude: 151.24 },
      "private-test-key",
      async () =>
        new Response(
          JSON.stringify({
            features: [{ geometry: { type: "LineString", coordinates: [] } }],
          }),
          { status: 200 },
        ),
    ),
    /ROUTE_PREVIEW_UNAVAILABLE/,
  );
});

test("road routes are reused from SQLite for seven days", async () => {
  const database = new Database(":memory:");
  initializeCoreSchema(database);
  let requests = 0;
  const origin = { latitude: -33.87, longitude: 151.21 };
  const destination = { latitude: -33.88, longitude: 151.22 };
  const fetcher: typeof fetch = async () => {
    requests += 1;
    return new Response(
      JSON.stringify({
        features: [
          {
            properties: { distance: 1800, time: 300 },
            geometry: {
              type: "LineString",
              coordinates: [
                [151.21, -33.87],
                [151.22, -33.88],
              ],
            },
          },
        ],
      }),
      { status: 200 },
    );
  };
  const first = await roadRoutePreview(
    origin,
    destination,
    "private-test-key",
    fetcher,
    database,
  );
  const second = await roadRoutePreview(
    origin,
    destination,
    "private-test-key",
    fetcher,
    database,
  );
  assert.deepEqual(second, first);
  assert.equal(requests, 1);
  const expiry = database
    .prepare("SELECT expires_at FROM route_preview_cache")
    .get() as { expires_at: string };
  assert.ok(
    new Date(expiry.expires_at).getTime() >
      Date.now() + 6 * 24 * 60 * 60 * 1_000,
  );
  database.close();
});
