import assert from "node:assert/strict";
import test from "node:test";
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
  assert.equal(
    requested?.searchParams.get("waypoints"),
    "-33.87,151.21|-33.88,151.22",
  );
  assert.deepEqual(points, [
    { latitude: -33.87, longitude: 151.21 },
    { latitude: -33.875, longitude: 151.215 },
    { latitude: -33.88, longitude: 151.22 },
  ]);
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
