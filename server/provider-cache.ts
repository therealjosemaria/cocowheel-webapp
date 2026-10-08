import { createHash } from "node:crypto";
import type { Db, Pin } from "./core";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const PLACE_CACHE_LIMIT = 2_000;
const ROUTE_CACHE_LIMIT = 250;

type CachedPlace = { label: string | null; countryCode: string | null };

function now() {
  return new Date().toISOString();
}
function expiresAt() {
  return new Date(Date.now() + CACHE_TTL_MS).toISOString();
}
function coordinateKey(pin: Pin) {
  return `${pin.latitude.toFixed(5)}:${pin.longitude.toFixed(5)}`;
}
function routeKey(origin: Pin, destination: Pin) {
  return createHash("sha256")
    .update(
      `cocowheels-route-v1:${coordinateKey(origin)}|${coordinateKey(destination)}`,
    )
    .digest("hex");
}
function validPoints(value: unknown): value is Pin[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every(
      (point) =>
        point &&
        typeof point === "object" &&
        typeof point.latitude === "number" &&
        Number.isFinite(point.latitude) &&
        typeof point.longitude === "number" &&
        Number.isFinite(point.longitude),
    )
  );
}
function trimTable(
  database: Db,
  table: "place_lookup_cache" | "route_preview_cache",
  limit: number,
) {
  database
    .prepare(
      `DELETE FROM ${table} WHERE cache_key IN (
        SELECT cache_key FROM ${table}
        ORDER BY last_used_at DESC
        LIMIT -1 OFFSET ?
      )`,
    )
    .run(limit);
}

export function pruneProviderCache(database: Db) {
  const timestamp = now();
  database
    .prepare("DELETE FROM place_lookup_cache WHERE expires_at <= ?")
    .run(timestamp);
  database
    .prepare("DELETE FROM route_preview_cache WHERE expires_at <= ?")
    .run(timestamp);
  trimTable(database, "place_lookup_cache", PLACE_CACHE_LIMIT);
  trimTable(database, "route_preview_cache", ROUTE_CACHE_LIMIT);
}

export function cachedPlaceLookup(
  database: Db | undefined,
  pin: Pin,
): CachedPlace | null {
  if (!database) return null;
  const timestamp = now();
  const cacheKey = coordinateKey(pin);
  const row = database
    .prepare(
      "SELECT label, country_code FROM place_lookup_cache WHERE cache_key = ? AND expires_at > ?",
    )
    .get(cacheKey, timestamp) as
    { label: string | null; country_code: string | null } | undefined;
  if (!row) return null;
  database
    .prepare(
      "UPDATE place_lookup_cache SET last_used_at = ? WHERE cache_key = ?",
    )
    .run(timestamp, cacheKey);
  return { label: row.label, countryCode: row.country_code };
}

export function cachePlaceLookup(
  database: Db | undefined,
  pin: Pin,
  place: CachedPlace,
) {
  if (!database) return;
  const timestamp = now();
  database
    .prepare(
      `INSERT INTO place_lookup_cache (cache_key, label, country_code, expires_at, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         label = excluded.label,
         country_code = excluded.country_code,
         expires_at = excluded.expires_at,
         last_used_at = excluded.last_used_at`,
    )
    .run(
      coordinateKey(pin),
      place.label,
      place.countryCode,
      expiresAt(),
      timestamp,
      timestamp,
    );
  pruneProviderCache(database);
}

export function cachedRoutePreview(
  database: Db | undefined,
  origin: Pin,
  destination: Pin,
) {
  if (!database) return null;
  const timestamp = now();
  const cacheKey = routeKey(origin, destination);
  const row = database
    .prepare(
      "SELECT points_json FROM route_preview_cache WHERE cache_key = ? AND expires_at > ?",
    )
    .get(cacheKey, timestamp) as { points_json: string } | undefined;
  if (!row) return null;
  try {
    const points: unknown = JSON.parse(row.points_json);
    if (!validPoints(points)) return null;
    database
      .prepare(
        "UPDATE route_preview_cache SET last_used_at = ? WHERE cache_key = ?",
      )
      .run(timestamp, cacheKey);
    return points;
  } catch {
    return null;
  }
}

export function cacheRoutePreview(
  database: Db | undefined,
  origin: Pin,
  destination: Pin,
  points: Pin[],
) {
  if (!database) return;
  const timestamp = now();
  database
    .prepare(
      `INSERT INTO route_preview_cache (cache_key, points_json, expires_at, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         points_json = excluded.points_json,
         expires_at = excluded.expires_at,
         last_used_at = excluded.last_used_at`,
    )
    .run(
      routeKey(origin, destination),
      JSON.stringify(points),
      expiresAt(),
      timestamp,
      timestamp,
    );
  pruneProviderCache(database);
}
