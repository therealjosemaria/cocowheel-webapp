import type { Pin } from "./core";

type GeoapifyGeometry = { type?: unknown; coordinates?: unknown };
type GeoapifyRouteResponse = {
  features?: Array<{ geometry?: GeoapifyGeometry }>;
};
const ROUTE_CACHE_TTL_MS = 10 * 60 * 1000;
const ROUTE_CACHE_MAX_ENTRIES = 100;
const routeCache = new Map<string, { points: Pin[]; expiresAt: number }>();

function routeCacheKey(origin: Pin, destination: Pin) {
  return [origin, destination]
    .map((pin) => `${pin.latitude.toFixed(5)}:${pin.longitude.toFixed(5)}`)
    .join("|");
}
function cachedRoute(key: string) {
  const cached = routeCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    routeCache.delete(key);
    return null;
  }
  return cached.points;
}
function cacheRoute(key: string, points: Pin[]) {
  if (routeCache.size >= ROUTE_CACHE_MAX_ENTRIES) {
    const oldest = routeCache.keys().next().value;
    if (oldest) routeCache.delete(oldest);
  }
  routeCache.set(key, { points, expiresAt: Date.now() + ROUTE_CACHE_TTL_MS });
}

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
  const cacheKey = routeCacheKey(origin, destination);
  const cached = cachedRoute(cacheKey);
  if (cached) return cached;
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
  cacheRoute(cacheKey, points);
  return points;
}
