import type { Pin } from "./core";

type GeoapifyGeometry = { type?: unknown; coordinates?: unknown };
type GeoapifyRouteResponse = {
  features?: Array<{ geometry?: GeoapifyGeometry }>;
};

function validPoint(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function routePoints(geometry: GeoapifyGeometry | undefined) {
  if (!geometry) return [];
  const coordinates = geometry.coordinates;
  const rawPoints =
    geometry.type === "LineString" && Array.isArray(coordinates)
      ? coordinates
      : geometry.type === "MultiLineString" && Array.isArray(coordinates)
        ? coordinates.flat()
        : [];
  return rawPoints
    .filter(validPoint)
    .slice(0, 2_000)
    .map(([longitude, latitude]) => ({ latitude, longitude }));
}

export async function roadRoutePreview(
  origin: Pin,
  destination: Pin,
  apiKey = process.env.COCOWHEELS_GEOAPIFY_KEY,
  fetcher: typeof fetch = fetch,
) {
  if (!apiKey) throw new Error("ROUTE_PREVIEW_UNAVAILABLE");
  const url = new URL("https://api.geoapify.com/v1/routing");
  url.searchParams.set(
    "waypoints",
    `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`,
  );
  url.searchParams.set("mode", "drive");
  url.searchParams.set("apiKey", apiKey);
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error("ROUTE_PREVIEW_UNAVAILABLE");
  }
  if (!response.ok) throw new Error("ROUTE_PREVIEW_UNAVAILABLE");
  const payload = (await response.json()) as GeoapifyRouteResponse;
  const points = routePoints(payload.features?.[0]?.geometry);
  if (points.length < 2) throw new Error("ROUTE_PREVIEW_UNAVAILABLE");
  return points;
}
