import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Db } from "./core";
import {
  beginRide,
  advanceSampleRide,
  availableRides,
  cancelPendingRequest,
  cancelRide,
  completeCoRide,
  confirmCoRideCode,
  currentOpenRides,
  decideRequest,
  expireStaleRides,
  ensureSampleRides,
  findSession,
  getRide,
  guestAlias,
  guestCookie,
  initializeCoreSchema,
  privateHistory,
  publicRidePreview,
  publishRide,
  readGuestCookie,
  requestRide,
  searchRides,
  submitLocation,
} from "./core";
import db from "./db";
import { reversePlaceDetails, searchPlaces } from "./place-label";
import { pruneProviderCache } from "./provider-cache";
import { roadRoutePreview } from "./route-preview";

const MAX_BODY_BYTES = 32_768;
const PLACE_LOOKUP_WINDOW_MS = 60_000;
const MAX_PLACE_LOOKUPS_PER_WINDOW = 8;
const ROUTE_PREVIEW_WINDOW_MS = 60_000;
const MAX_ROUTE_PREVIEWS_PER_WINDOW = 30;
type Json = Record<string, unknown>;
const placeLookupBuckets = new Map<
  string,
  { count: number; resetAt: number }
>();
const routePreviewBuckets = new Map<
  string,
  { count: number; resetAt: number }
>();

export function assertRuntimeConfiguration(environment = process.env) {
  if (environment.NODE_ENV !== "production") return;
  const encryptionKey = environment.COCOWHEELS_CODE_ENCRYPTION_KEY;
  if (!encryptionKey)
    throw new Error("COCOWHEELS_CODE_ENCRYPTION_KEY_REQUIRED");
  if (Buffer.from(encryptionKey, "base64").length !== 32)
    throw new Error("INVALID_CODE_ENCRYPTION_KEY");
  if (!environment.COCOWHEELS_DB_PATH)
    throw new Error("COCOWHEELS_DB_PATH_REQUIRED");
  if (
    !environment.COCOWHEELS_FRONTEND_ORIGINS &&
    !environment.COCOWHEELS_FRONTEND_ORIGIN
  )
    throw new Error("COCOWHEELS_FRONTEND_ORIGINS_REQUIRED");
  if (!environment.COCOWHEELS_PUBLIC_ORIGIN)
    throw new Error("COCOWHEELS_PUBLIC_ORIGIN_REQUIRED");
}

function configuredOrigins() {
  const configured =
    process.env.COCOWHEELS_FRONTEND_ORIGINS ??
    process.env.COCOWHEELS_FRONTEND_ORIGIN ??
    "http://localhost:3000";
  return new Set(
    configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}
function originAllowed(origin: string | undefined) {
  return !origin || configuredOrigins().has(origin);
}
function requestToken(request: IncomingMessage) {
  const cookie = readGuestCookie(request.headers.cookie);
  if (cookie) return cookie;
  const authorization = request.headers.authorization;
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}
async function readJson(request: IncomingMessage): Promise<Json> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const data = Buffer.from(chunk);
    size += data.length;
    if (size > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
    chunks.push(data);
  }
  if (size === 0) return {};
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
      throw new Error();
    return parsed as Json;
  } catch {
    throw new Error("INVALID_JSON");
  }
}
function errorStatus(error: unknown) {
  const code = error instanceof Error ? error.message : "REQUEST_FAILED";
  if (code === "GUEST_SESSION_REQUIRED") return 401;
  if (code === "RIDE_ACCESS_DENIED") return 403;
  if (code === "RIDE_NOT_FOUND") return 404;
  if (
    [
      "RIDE_UNAVAILABLE",
      "REQUEST_UNAVAILABLE",
      "OPEN_ITEM_EXISTS",
      "ROLE_CHANGE_REQUIRES_TERMINATION",
      "OWN_RIDE_JOIN_NOT_ALLOWED",
      "RIDE_CANNOT_BEGIN",
      "CANCELLATION_NOT_ALLOWED",
      "CO_RIDE_NOT_ACTIVE",
      "REQUEST_CANCELLATION_NOT_ALLOWED",
      "LOCATION_NOT_ALLOWED",
    ].includes(code)
  )
    return 409;
  if (code === "BODY_TOO_LARGE") return 413;
  if (code === "PLACE_LOOKUP_RATE_LIMITED") return 429;
  if (code === "ROUTE_PREVIEW_RATE_LIMITED") return 429;
  return 400;
}
function writeJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}
function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}
function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number.NaN;
}
function pin(value: unknown) {
  const raw = value as Json;
  return {
    latitude: asNumber(raw?.latitude),
    longitude: asNumber(raw?.longitude),
    label: typeof raw?.label === "string" ? raw.label : undefined,
  };
}
function validPlacePin(value: unknown) {
  const place = pin(value);
  if (
    !Number.isFinite(place.latitude) ||
    place.latitude < -90 ||
    place.latitude > 90 ||
    !Number.isFinite(place.longitude) ||
    place.longitude < -180 ||
    place.longitude > 180
  )
    throw new Error("INVALID_PLACE_PIN");
  return { latitude: place.latitude, longitude: place.longitude };
}
function coordinateLabel(pin: { latitude: number; longitude: number }) {
  return `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`;
}
async function pinWithPublishedLabel(value: unknown, database: Db) {
  const place = pin(value);
  if (place.label?.trim()) return place;
  const coordinates = validPlacePin(value);
  try {
    const resolved = await reversePlaceDetails(
      coordinates,
      undefined,
      fetch,
      database,
    );
    return { ...place, label: resolved.label ?? coordinateLabel(coordinates) };
  } catch {
    return { ...place, label: coordinateLabel(coordinates) };
  }
}
function isCoordinateLabel(value: string | null) {
  return value != null && /^-?\d{1,2}\.\d{5}, -?\d{1,3}\.\d{5}$/.test(value);
}
async function hydratePublishedPlaceLabels(database: Db) {
  const rides = database
    .prepare(
      "SELECT id, origin_latitude, origin_longitude, origin_label, destination_latitude, destination_longitude, destination_label FROM rides WHERE status IN ('PUBLISHED', 'REQUESTED') LIMIT 20",
    )
    .all() as Array<{
    id: string;
    origin_latitude: number;
    origin_longitude: number;
    origin_label: string | null;
    destination_latitude: number;
    destination_longitude: number;
    destination_label: string | null;
  }>;
  await Promise.all(
    rides
      .filter(
        (ride) =>
          ride.origin_label == null ||
          ride.destination_label == null ||
          isCoordinateLabel(ride.origin_label) ||
          isCoordinateLabel(ride.destination_label),
      )
      .flatMap((ride) => {
        const updates: Array<Promise<void>> = [];
        if (ride.origin_label == null || isCoordinateLabel(ride.origin_label)) {
          updates.push(
            reversePlaceDetails(
              {
                latitude: ride.origin_latitude,
                longitude: ride.origin_longitude,
              },
              undefined,
              fetch,
              database,
            )
              .then((place) => {
                if (!place.label) return;
                database
                  .prepare("UPDATE rides SET origin_label = ? WHERE id = ?")
                  .run(place.label, ride.id);
              })
              .catch(() => undefined),
          );
        }
        if (
          ride.destination_label == null ||
          isCoordinateLabel(ride.destination_label)
        ) {
          updates.push(
            reversePlaceDetails(
              {
                latitude: ride.destination_latitude,
                longitude: ride.destination_longitude,
              },
              undefined,
              fetch,
              database,
            )
              .then((place) => {
                if (!place.label) return;
                database
                  .prepare(
                    "UPDATE rides SET destination_label = ? WHERE id = ?",
                  )
                  .run(place.label, ride.id);
              })
              .catch(() => undefined),
          );
        }
        return updates;
      }),
  );
}

async function hydrateRequestPlaceLabels(
  database: Db,
  requestView: {
    requestId: string;
    pickup: { latitude: number; longitude: number; label?: string };
    destination: { latitude: number; longitude: number; label?: string };
  },
) {
  const updates = [
    {
      column: "pickup_label",
      pin: requestView.pickup,
    },
    {
      column: "destination_label",
      pin: requestView.destination,
    },
  ].filter(({ pin }) => !pin.label || isCoordinateLabel(pin.label));

  await Promise.all(
    updates.map(async ({ column, pin }) => {
      try {
        const place = await reversePlaceDetails(
          pin,
          undefined,
          fetch,
          database,
        );
        if (!place.label) return;
        const statement =
          column === "pickup_label"
            ? "UPDATE ride_requests SET pickup_label = ? WHERE id = ?"
            : "UPDATE ride_requests SET destination_label = ? WHERE id = ?";
        database.prepare(statement).run(place.label, requestView.requestId);
      } catch {
        // Coordinates remain the final display fallback when lookup is unavailable.
      }
    }),
  );
}
function placeLookupKey(request: IncomingMessage) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0)
    return forwarded.split(",")[0].trim();
  return request.socket.remoteAddress ?? "unknown";
}
function allowPlaceLookup(request: IncomingMessage) {
  const now = Date.now();
  const key = placeLookupKey(request);
  const existing = placeLookupBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    placeLookupBuckets.set(key, {
      count: 1,
      resetAt: now + PLACE_LOOKUP_WINDOW_MS,
    });
    return true;
  }
  if (existing.count >= MAX_PLACE_LOOKUPS_PER_WINDOW) return false;
  existing.count += 1;
  return true;
}
function allowRoutePreview(request: IncomingMessage) {
  const now = Date.now();
  const key = placeLookupKey(request);
  const existing = routePreviewBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    routePreviewBuckets.set(key, {
      count: 1,
      resetAt: now + ROUTE_PREVIEW_WINDOW_MS,
    });
    return true;
  }
  if (existing.count >= MAX_ROUTE_PREVIEWS_PER_WINDOW) return false;
  existing.count += 1;
  return true;
}
function inputSearch(body: Json) {
  return {
    pickup: pin(body.pickup),
    destination: pin(body.destination),
    requestedDepartureAt: asString(body.requestedDepartureAt),
  };
}
function pathParts(url: string | undefined) {
  return new URL(url ?? "/", "http://api.local").pathname
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
}

export function createApiServer(
  database: Db,
  options: { sampleRides?: boolean } = {},
) {
  assertRuntimeConfiguration();
  initializeCoreSchema(database);
  pruneProviderCache(database);
  const sampleRidesEnabled = options.sampleRides ?? true;
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (!originAllowed(origin)) {
      writeJson(response, 403, { error: "ORIGIN_NOT_ALLOWED" });
      return;
    }
    const cors: Record<string, string> = origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          Vary: "Origin",
        }
      : {};
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        ...cors,
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, X-Cocowheels-Session-Fallback",
        "Access-Control-Max-Age": "600",
      });
      response.end();
      return;
    }
    try {
      const now = new Date();
      expireStaleRides(database, now);
      if (sampleRidesEnabled) ensureSampleRides(database, now);
      const parts = pathParts(request.url);
      const token = requestToken(request);
      if (
        request.method === "GET" &&
        (parts.join("/") === "health" || parts.join("/") === "api/health")
      ) {
        writeJson(response, 200, { status: "ok" }, cors);
        return;
      }
      if (request.method === "POST" && parts.join("/") === "api/place-label") {
        if (!allowPlaceLookup(request))
          throw new Error("PLACE_LOOKUP_RATE_LIMITED");
        const body = await readJson(request);
        const place = await reversePlaceDetails(
          validPlacePin(body.pin),
          undefined,
          fetch,
          database,
        );
        writeJson(response, 200, place, cors);
        return;
      }
      if (request.method === "POST" && parts.join("/") === "api/place-search") {
        const body = await readJson(request);
        if (typeof body.text !== "string")
          throw new Error("INVALID_SEARCH_TEXT");
        const text = typeof body.text === "string" ? body.text : "";
        const bias = body.bias ? validPlacePin(body.bias) : undefined;
        const countryCode =
          typeof body.countryCode === "string" &&
          /^[a-z]{2}$/i.test(body.countryCode)
            ? body.countryCode.toLowerCase()
            : undefined;
        writeJson(
          response,
          200,
          { places: await searchPlaces(text, bias, countryCode) },
          cors,
        );
        return;
      }
      if (
        request.method === "POST" &&
        parts.join("/") === "api/route-preview"
      ) {
        if (!allowRoutePreview(request))
          throw new Error("ROUTE_PREVIEW_RATE_LIMITED");
        const body = await readJson(request);
        const route = await roadRoutePreview(
          validPlacePin(body.origin),
          validPlacePin(body.destination),
          undefined,
          fetch,
          database,
        );
        writeJson(response, 200, route, cors);
        return;
      }
      if (request.method === "POST" && parts.join("/") === "api/search") {
        await hydratePublishedPlaceLabels(database);
        const now = new Date();
        writeJson(
          response,
          200,
          {
            candidates: searchRides(
              database,
              inputSearch(await readJson(request)),
              now,
              token,
            ),
            serverNow: now.toISOString(),
          },
          cors,
        );
        return;
      }
      if (request.method === "GET" && parts.join("/") === "api/availability") {
        await hydratePublishedPlaceLabels(database);
        const now = new Date();
        writeJson(
          response,
          200,
          {
            rides: availableRides(database, now, token),
            serverNow: now.toISOString(),
          },
          cors,
        );
        return;
      }
      if (request.method === "GET" && parts.join("/") === "api/current") {
        const currents = currentOpenRides(database, token);
        writeJson(
          response,
          200,
          {
            current: currents[0] ?? null,
            currents,
            guestAlias: guestAlias(database, token),
          },
          cors,
        );
        return;
      }
      if (request.method === "POST" && parts.join("/") === "api/rides") {
        const body = await readJson(request);
        if (body.payId != null && typeof body.payId !== "string")
          throw new Error("INVALID_PAYID");
        if (
          body.payIdType != null &&
          !["MOBILE", "EMAIL", "OTHER"].includes(String(body.payIdType))
        )
          throw new Error("INVALID_PAYID_TYPE");
        const [rideOrigin, rideDestination] = await Promise.all([
          pinWithPublishedLabel(body.origin, database),
          pinWithPublishedLabel(body.destination, database),
        ]);
        const result = publishRide(database, token, {
          origin: rideOrigin,
          destination: rideDestination,
          scheduledDepartureAt: asString(body.scheduledDepartureAt),
          priceAud: asNumber(body.priceAud),
          payId: typeof body.payId === "string" ? body.payId : undefined,
          payIdType:
            body.payIdType === "MOBILE" ||
            body.payIdType === "EMAIL" ||
            body.payIdType === "OTHER"
              ? body.payIdType
              : undefined,
        });
        const headers = result.sessionToken
          ? {
              ...cors,
              "Set-Cookie": guestCookie(
                result.sessionToken,
                process.env.NODE_ENV === "production",
                Boolean(
                  origin &&
                  origin !==
                    (process.env.COCOWHEELS_PUBLIC_ORIGIN ??
                      "http://localhost:3000"),
                ),
              ),
            }
          : cors;
        const fallback =
          request.headers["x-cocowheels-session-fallback"] === "1"
            ? { sessionToken: result.sessionToken }
            : {};
        writeJson(response, 201, { ride: result.ride, ...fallback }, headers);
        return;
      }
      if (
        request.method === "GET" &&
        parts.length === 4 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "preview"
      ) {
        const now = new Date();
        writeJson(
          response,
          200,
          {
            ride: publicRidePreview(database, parts[2], now),
            serverNow: now.toISOString(),
          },
          cors,
        );
        return;
      }
      if (
        request.method === "GET" &&
        parts.length === 3 &&
        parts[0] === "api" &&
        parts[1] === "rides"
      ) {
        const session = findSession(database, token);
        if (!session) throw new Error("GUEST_SESSION_REQUIRED");
        const requestId =
          new URL(request.url ?? "/", "http://api.local").searchParams.get(
            "request",
          ) ?? undefined;
        const authorizedRide = getRide(
          database,
          parts[2],
          session,
          new Date(),
          requestId,
        );
        if (authorizedRide.request) {
          await hydrateRequestPlaceLabels(database, authorizedRide.request);
        }
        writeJson(
          response,
          200,
          {
            ride: getRide(database, parts[2], session, new Date(), requestId),
          },
          cors,
        );
        return;
      }
      if (
        request.method === "POST" &&
        parts.length === 4 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "requests"
      ) {
        const search = inputSearch(await readJson(request));
        const [pickup, destination] = await Promise.all([
          pinWithPublishedLabel(search.pickup, database),
          pinWithPublishedLabel(search.destination, database),
        ]);
        const result = requestRide(database, token, parts[2], {
          ...search,
          pickup,
          destination,
        });
        const headers = result.sessionToken
          ? {
              ...cors,
              "Set-Cookie": guestCookie(
                result.sessionToken,
                process.env.NODE_ENV === "production",
                Boolean(
                  origin &&
                  origin !==
                    (process.env.COCOWHEELS_PUBLIC_ORIGIN ??
                      "http://localhost:3000"),
                ),
              ),
            }
          : cors;
        const fallback =
          request.headers["x-cocowheels-session-fallback"] === "1"
            ? { sessionToken: result.sessionToken }
            : {};
        writeJson(response, 201, { ride: result.ride, ...fallback }, headers);
        return;
      }
      if (
        request.method === "PATCH" &&
        parts.length === 5 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "requests"
      ) {
        const body = await readJson(request);
        writeJson(
          response,
          200,
          {
            ride: decideRequest(
              database,
              token,
              parts[2],
              parts[4],
              body.decision === "ACCEPT" ? "ACCEPT" : "DECLINE",
            ),
          },
          cors,
        );
        return;
      }
      if (
        request.method === "POST" &&
        parts.length === 4 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "location"
      ) {
        const body = await readJson(request);
        writeJson(
          response,
          200,
          {
            ride: submitLocation(database, token, parts[2], {
              latitude: asNumber(body.latitude),
              longitude: asNumber(body.longitude),
              accuracyMeters: asNumber(body.accuracyMeters),
              capturedAt: asString(body.capturedAt),
              moving: body.moving === true,
            }),
          },
          cors,
        );
        return;
      }
      if (
        request.method === "POST" &&
        parts.length === 4 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "sample"
      ) {
        const body = await readJson(request);
        writeJson(
          response,
          200,
          {
            ride: advanceSampleRide(
              database,
              token,
              parts[2],
              asString(body.action),
            ),
          },
          cors,
        );
        return;
      }
      if (
        request.method === "POST" &&
        parts.length === 4 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "begin"
      ) {
        writeJson(
          response,
          200,
          { ride: beginRide(database, token, parts[2]) },
          cors,
        );
        return;
      }
      if (
        request.method === "POST" &&
        parts.length === 5 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "co-ride" &&
        parts[4] === "confirm"
      ) {
        const body = await readJson(request);
        writeJson(
          response,
          200,
          {
            ride: confirmCoRideCode(
              database,
              token,
              parts[2],
              asString(body.code),
            ),
          },
          cors,
        );
        return;
      }
      if (
        request.method === "POST" &&
        parts.length === 4 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "cancel"
      ) {
        writeJson(
          response,
          200,
          { ride: cancelRide(database, token, parts[2]) },
          cors,
        );
        return;
      }
      if (
        request.method === "POST" &&
        parts.length === 5 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "request" &&
        parts[4] === "cancel"
      ) {
        writeJson(
          response,
          200,
          { ride: cancelPendingRequest(database, token, parts[2]) },
          cors,
        );
        return;
      }
      if (
        request.method === "POST" &&
        parts.length === 4 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "complete"
      ) {
        const body = await readJson(request);
        writeJson(
          response,
          200,
          {
            ride: completeCoRide(
              database,
              token,
              parts[2],
              body.method === "PAYID" ? "PAYID" : "CASH",
            ),
          },
          cors,
        );
        return;
      }
      if (request.method === "GET" && parts.join("/") === "api/history") {
        writeJson(response, 200, privateHistory(database, token), cors);
        return;
      }
      writeJson(response, 404, { error: "NOT_FOUND" }, cors);
    } catch (error) {
      const code = error instanceof Error ? error.message : "REQUEST_FAILED";
      if (
        request.method === "POST" &&
        /^\/api\/rides\/[^/?]+\/requests(?:\?|$)/.test(request.url ?? "")
      ) {
        // Log only a bounded error identifier, never request bodies or guest tokens.
        console.warn("Ride join rejected", {
          status: errorStatus(error),
          code: /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : "INTERNAL_ERROR",
        });
      }
      writeJson(response, errorStatus(error), { error: code }, cors);
    }
  });
}

if (process.argv[1]?.endsWith("server/index.ts")) {
  const port = Number(process.env.PORT ?? 5060);
  const api = createApiServer(db);
  api.listen(port, "127.0.0.1", () =>
    console.info(`Cocowheels API listening on ${port}`),
  );
}
