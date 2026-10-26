import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Db } from "./core";
import { postDemand, demandActivity, searchDemands, cancelDemand, offerDemand, respondToDemandOffer, pendingDemandOffers, activeDemand } from "./rider-demands";
import { ratingSummary, submitRating } from "./ratings";
import {
  readConversation,
  sendMessage,
  markMessagesRead,
  stopMessages,
} from "./messaging";
import {
  beginRide,
  renewPickupCode,
  advanceSampleRide,
  advanceSampleSimulations,
  availableRides,
  cancelPendingRequest,
  cancelRide,
  completeCoRide,
  confirmCoRideCode,
  currentOpenRides,
  decideRequest,
  expireStaleRides,
  ensureSampleRides,
  retireSampleOffers,
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
  locationSource,
} from "./core";
import db from "./db";
import {
  requestUniversityCode,
  VerificationRateLimitError,
  ADMIN_UNIKEY,
  verifyUniversityCode,
  requireUniversitySession,
  logoutUniversity,
  type CodeSender,
} from "./university-auth";
import { initializeAdmin, adminDashboard, adminInspector } from "./admin";
import { reversePlaceDetails, searchPlaces } from "./place-label";
import { pruneProviderCache } from "./provider-cache";
import { roadRoutePreview } from "./route-preview";
import { readUsualRoute, saveUsualRoute, saveSearchRoute, removeUsualRoute, deliverRouteAlerts, alertsConfigured } from "./usual-routes";
import { readVehicle, saveVehicle } from "./vehicles";
import { acceptWithVehicle } from "./vehicle-acceptance";
import { preparePhoto, readProfile, saveProfile } from "./personal-details";

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
async function readJson(request: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<Json> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const data = Buffer.from(chunk);
    size += data.length;
    if (size > maxBytes) throw new Error("BODY_TOO_LARGE");
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
  if (code === "DEMAND_NOT_FOUND") return 404;
  if (code === "LIFT_REQUEST_WITHDRAWAL_REQUIRED") return 409;
  if (["DEMAND_ALREADY_OPEN", "DEMAND_UNAVAILABLE", "DEMAND_CHANGED"].includes(code)) return 409;
  if (code === "USERNAME_UNAVAILABLE") return 409;
  if (code === "PHOTO_BUSY") return 429;
  if (code === "VEHICLE_PLATE_REQUIRED") return 409;
  if (code === "RATING_WINDOW_CLOSED") return 410;
  if (["RATING_ALREADY_SUBMITTED", "RATING_UNAVAILABLE"].includes(code))
    return 409;
  if (
    ["UNIVERSITY_VERIFICATION_REQUIRED", "VERIFICATION_INVALID"].includes(code)
  )
    return 401;
  if (code === "VERIFICATION_RATE_LIMITED" || code === "MESSAGE_RATE_LIMITED")
    return 429;
  if (
    [
      "CONVERSATION_CLOSED",
      "MESSAGING_STOPPED",
      "MESSAGE_CONFLICT",
      "CONVERSATION_FULL",
    ].includes(code)
  )
    return 409;
  if (["EMAIL_NOT_CONFIGURED", "EMAIL_SEND_FAILED"].includes(code)) return 503;
  if (["ADMIN_SESSION_REQUIRED", "ADMIN_LOGIN_INVALID"].includes(code))
    return 401;
  if (code === "ADMIN_RATE_LIMITED") return 429;
  if (code === "ADMIN_NOT_CONFIGURED") return 503;
  if (code === "GUEST_SESSION_REQUIRED") return 401;
  if (code === "RIDE_ACCESS_DENIED" || code === "LOCATION_SOURCE_OTHER_DEVICE")
    return 403;
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
      "COMPLETION_PICKUP_UNCONFIRMED",
      "COMPLETION_NOT_AT_DROPOFF",
      "COMPLETION_LOCATION_UNAVAILABLE",
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
    ...(body.departureDate !== undefined ? { departureDate: asString(body.departureDate) } : {}),
    ...(body.departureTime !== undefined ? { departureTime: asString(body.departureTime) } : {}),
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
  options: { sampleRides?: boolean; sendUniversityCode?: CodeSender } = {},
) {
  assertRuntimeConfiguration();
  initializeCoreSchema(database);
  initializeAdmin(database);
  pruneProviderCache(database);
  // Production defaults to real offers only. Isolated tests explicitly opt in.
  const sampleRidesEnabled = options.sampleRides ?? false;
  if (!sampleRidesEnabled) retireSampleOffers(database);
  const server = createServer(async (request, response) => {
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
      const adminUrl = new URL(request.url ?? "/", "http://api.local");
      if (adminUrl.pathname.startsWith("/api/admin/")) {
        response.setHeader("Cache-Control", "private, no-store");
        const universitySession = findSession(
          database,
          readGuestCookie(request.headers.cookie),
        );
        if (universitySession?.unikey !== ADMIN_UNIKEY) {
          writeJson(response, 403, { error: "ADMIN_ACCESS_DENIED" }, cors);
          return;
        }
        if (
          request.method !== "GET" &&
          (!origin || request.headers["x-admin-request"] !== "1")
        ) {
          writeJson(response, 403, { error: "ORIGIN_NOT_ALLOWED" }, cors);
          return;
        }
        if (
          adminUrl.pathname === "/api/admin/dashboard" &&
          request.method === "GET"
        ) {
          writeJson(response, 200, adminDashboard(database, adminUrl), cors);
        } else if (
          /^\/api\/admin\/rides\/[^/]+$/.test(adminUrl.pathname) &&
          request.method === "GET"
        ) {
          writeJson(
            response,
            200,
            {
              ...adminInspector(
                database,
                decodeURIComponent(adminUrl.pathname.split("/").pop()!),
              ),
            },
            cors,
          );
        } else writeJson(response, 404, { error: "NOT_FOUND" }, cors);
        return;
      }
      const now = new Date();
      expireStaleRides(database, now);
      advanceSampleSimulations(database, now);
      if (sampleRidesEnabled) {
        ensureSampleRides(database, now);
      }
      const parts = pathParts(request.url);
      const token = requestToken(request);
      if (
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "conversations" &&
        [5, 6].includes(parts.length)
      ) {
        const session = requireUniversitySession(database, token);
        if (request.method === "GET" && parts.length === 5)
          writeJson(
            response,
            200,
            readConversation(database, parts[2], parts[4], session.id),
            cors,
          );
        else if (request.method === "POST") {
          const body = await readJson(request);
          // Recheck after awaiting the body: logout/expiry may have happened.
          requireUniversitySession(database, token);
          if (parts.length === 5)
            writeJson(
              response,
              200,
              sendMessage(
                database,
                parts[2],
                parts[4],
                session.id,
                body.text,
                body.clientId,
              ),
              cors,
            );
          else if (parts[5] === "read") {
            markMessagesRead(
              database,
              parts[2],
              parts[4],
              session.id,
              body.lastId,
            );
            writeJson(response, 200, { ok: true }, cors);
          } else if (parts[5] === "stop") {
            stopMessages(database, parts[2], parts[4], session.id);
            writeJson(response, 200, { ok: true }, cors);
          } else writeJson(response, 404, { error: "NOT_FOUND" }, cors);
        } else writeJson(response, 405, { error: "METHOD_NOT_ALLOWED" }, cors);
        return;
      }
      if (
        request.method === "POST" &&
        parts.length === 4 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "ratings"
      ) {
        response.setHeader("Cache-Control", "private, no-store");
        const session = requireUniversitySession(database, token);
        const body = await readJson(request);
        writeJson(
          response,
          200,
          {
            rating: submitRating(
              database,
              parts[2],
              session.id,
              body.score,
              now,
            ),
          },
          cors,
        );
        return;
      }
      if (parts[0] === "api" && parts[1] === "university") {
        response.setHeader("Cache-Control", "private, no-store");
        if (request.method === "GET" && parts[2] === "session") {
          const session = requireUniversitySession(database, token);
          writeJson(
            response,
            200,
            {
              unikey: session.unikey,
              username: session.alias,
              canAdmin: session.unikey === ADMIN_UNIKEY,
              ratings: {
                driver: ratingSummary(database, session.id, "DRIVER", now),
                rider: ratingSummary(database, session.id, "RIDER", now),
              },
            },
            cors,
          );
          return;
        }
        if (
          request.method !== "POST" ||
          !origin ||
          request.headers["x-cocowheels-auth"] !== "1"
        ) {
          writeJson(response, 403, { error: "ORIGIN_NOT_ALLOWED" }, cors);
          return;
        }
        if (parts[2] === "code") {
          const body = await readJson(request);
          writeJson(
            response,
            200,
            await requestUniversityCode(
              database,
              body.unikey,
              options.sendUniversityCode,
            ),
            cors,
          );
        } else if (parts[2] === "verify") {
          const body = await readJson(request);
          const result = verifyUniversityCode(
            database,
            body.challengeId,
            body.code,
            token,
          );
          writeJson(
            response,
            200,
            { unikey: result.unikey },
            {
              ...cors,
              "Set-Cookie": guestCookie(
                result.token,
                process.env.NODE_ENV === "production",
              ).replace("SameSite=Lax", "SameSite=Strict"),
            },
          );
        } else if (parts[2] === "logout") {
          logoutUniversity(database, token);
          writeJson(
            response,
            200,
            { ok: true },
            {
              ...cors,
              "Set-Cookie": guestCookie(
                "",
                process.env.NODE_ENV === "production",
              ).replace(/Max-Age=\d+/, "Max-Age=0"),
            },
          );
        } else writeJson(response, 404, { error: "NOT_FOUND" }, cors);
        return;
      }
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
        parts.length === 4 &&
        parts[0] === "api" &&
        parts[1] === "rides" &&
        parts[3] === "pickup-code"
      ) {
        writeJson(
          response,
          200,
          { ride: renewPickupCode(database, token, parts[2]) },
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
        const currents = currentOpenRides(database, token).map((current) => ({
          ...current,
          locationSource:
            ["ACCEPTED", "RIDE_ACTIVE", "CO_RIDE_ACTIVE"].includes(
              current.ride.status,
            )
              ? locationSource(database, token, current.ride.rideId)
              : null,
        }));
        writeJson(
          response,
          200,
          {
            current: currents[0] ?? null,
            currents,
            guestAlias: guestAlias(database, token),
            pendingDemandOffers: pendingDemandOffers(database, token),
            activeDemand: activeDemand(database, token),
          },
          cors,
        );
        return;
      }
      if (parts.length === 3 && parts[0] === "api" && parts[1] === "profile-photo" && request.method === "GET") {
        const photo = database.prepare("SELECT photo FROM account_profiles WHERE username=?").get(parts[2]) as { photo: Buffer | null } | undefined;
        if (!photo?.photo) {
          response.writeHead(200, { ...cors, "Content-Type": "image/svg+xml", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
          response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="12" fill="#f8fafc"/><g fill="none" stroke="#64748b" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></g></svg>');
          return;
        }
        response.writeHead(200, { ...cors, "Content-Type": "image/webp", "Content-Length": photo.photo.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        response.end(photo.photo);
        return;
      }
      if (parts.length === 2 && parts[0] === "api" && parts[1] === "profile") {
        const owner = requireUniversitySession(database, token);
        if (request.method === "GET") {
          writeJson(response, 200, readProfile(database, owner.id, owner.unikey!), cors);
          return;
        }
        if (request.method === "POST") {
          const body = await readJson(request, 710_000);
          const photo = await preparePhoto(body.photo);
          const current = requireUniversitySession(database, token);
          if (current.id !== owner.id) throw new Error("RIDE_ACCESS_DENIED");
          saveProfile(database, current.id, body.username, photo);
          writeJson(response, 200, readProfile(database, current.id, current.unikey!), cors);
          return;
        }
      }
      if (parts.length === 2 && parts[0] === "api" && parts[1] === "vehicle") {
        const owner = requireUniversitySession(database, token);
        if (request.method === "GET") {
          writeJson(response, 200, { vehicle: readVehicle(database, owner.id) }, cors);
          return;
        }
        if (request.method === "POST") {
          const body = await readJson(request);
          const current = requireUniversitySession(database, token);
          writeJson(response, 200, { vehicle: saveVehicle(database, current.id, body) }, cors);
          return;
        }
      }
      if (parts[0] === "api" && parts[1] === "rider-demands") {
        const owner = requireUniversitySession(database, token);
        if (parts.length === 2 && request.method === "GET") {
          writeJson(response, 200, demandActivity(database, token), cors);
          return;
        }
        if (request.method === "POST") {
          const body = await readJson(request);
          if (requireUniversitySession(database, token).id !== owner.id) throw new Error("RIDE_ACCESS_DENIED");
          if (parts.length === 2) {
            writeJson(response, 201, { request: postDemand(database, token, body) }, cors);
            return;
          }
          if (parts.length === 3 && parts[2] === "search") {
            writeJson(response, 200, { requests: searchDemands(database, token, body) }, cors);
            return;
          }
          if (parts.length === 4 && parts[3] === "cancel") {
            cancelDemand(database, token, parts[2]);
            writeJson(response, 200, { ok: true }, cors);
            return;
          }
          if (parts.length === 4 && parts[3] === "offer") {
            writeJson(response, 201, { offer: offerDemand(database, token, parts[2], body) }, cors);
            return;
          }
          if (parts.length === 5 && parts[2] === "offers" && parts[4] === "respond") {
            writeJson(response, 200, { ride: respondToDemandOffer(database, token, parts[3], body.decision) }, cors);
            return;
          }
        }
        writeJson(response, 404, { error: "NOT_FOUND" }, cors);
        return;
      }
      if (parts[0] === "api" && parts[1] === "usual-route") {
        const session = requireUniversitySession(database, token);
        if (parts.length === 2 && request.method === "GET") {
          writeJson(response, 200, { route: readUsualRoute(database, session.id), alertsAvailable: alertsConfigured() }, cors);
          return;
        }
        if (request.method === "POST") {
          const body = await readJson(request);
          const owner = requireUniversitySession(database, token);
          if (parts.length === 3 && parts[2] === "from-search") {
            try {
              writeJson(response, 200, { route: saveSearchRoute(database, owner.id, body) }, cors);
            } catch (error) {
              if (error instanceof Error && error.message === "USUAL_ROUTE_CHANGED") {
                writeJson(response, 409, { error: "USUAL_ROUTE_CHANGED" }, cors);
              } else if (error instanceof Error && error.message === "ALERTS_UNAVAILABLE") {
                writeJson(response, 503, { error: "ALERTS_UNAVAILABLE" }, cors);
              } else throw error;
            }
            return;
          }
          if (parts.length === 2) {
            writeJson(response, 200, { route: saveUsualRoute(database, owner.id, body) }, cors);
            return;
          }
          if (parts.length === 3 && parts[2] === "remove") {
            removeUsualRoute(database, owner.id);
            writeJson(response, 200, { ok: true }, cors);
            return;
          }
          if (parts.length === 3 && parts[2] === "offer") {
            const saved = readUsualRoute(database, owner.id);
            if (!saved) throw new Error("USUAL_ROUTE_REQUIRED");
            if (!Number.isInteger(body.departureMinutes) || (body.departureMinutes as number) < 0 || (body.departureMinutes as number) > 1440 || (body.departureMinutes as number) % 30 !== 0) throw new Error("INVALID_DEPARTURE_TIME");
            // The browser must obtain a fresh GPS fix; never silently reuse the saved origin.
            const captured = Date.parse(asString(body.capturedAt));
            if (!Number.isFinite(captured) || Math.abs(Date.now() - captured) > 30000 ||
                !Number.isFinite(body.accuracyMeters) || asNumber(body.accuracyMeters) < 0)
              throw new Error("LOCATION_UNAVAILABLE");
            const origin = await pinWithPublishedLabel(body.origin, database);
            requireUniversitySession(database, token);
            const result = publishRide(database, token, {
              origin, destination: saved.destination,
              scheduledDepartureAt: new Date(Date.now() + (body.departureMinutes as number)*60000).toISOString(),
              priceAud: saved.priceAud, payId: saved.payId, payIdType: saved.payIdType,
            });
            writeJson(response, 201, { ride: result.ride }, cors);
            return;
          }
        }
        writeJson(response, 404, { error: "NOT_FOUND" }, cors);
        return;
      }
      if (request.method === "POST" && parts.join("/") === "api/rides") {
        requireUniversitySession(database, token);
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
        requireUniversitySession(database, token);
        const result = publishRide(database, token, {
          withdrawLiftRequestId: typeof body.withdrawLiftRequestId === "string" ? body.withdrawLiftRequestId : undefined,
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
        requireUniversitySession(database, token);
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
            ride: body.decision === "ACCEPT" ? acceptWithVehicle(database, token, parts[2], parts[4], body.plate) : decideRequest(
              database,
              token,
              parts[2],
              parts[4],
              "DECLINE",
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
        parts[3] === "location-source"
      ) {
        requireUniversitySession(database, token);
        writeJson(
          response,
          200,
          locationSource(database, token, parts[2], true),
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
              body.method === "PAYID"
                ? "PAYID"
                : body.method === "CASH"
                  ? "CASH"
                  : null,
              new Date(),
              body.confirmAnyway === true,
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
      if (error instanceof VerificationRateLimitError) {
        response.setHeader("Retry-After", String(error.retryAfterSeconds));
        writeJson(
          response,
          errorStatus(error),
          { error: code, retryAfterSeconds: error.retryAfterSeconds },
          cors,
        );
      } else writeJson(response, errorStatus(error), { error: code }, cors);
    }
  });
  let sampleTimer: ReturnType<typeof setInterval> | undefined;
  let alertTimer: ReturnType<typeof setInterval> | undefined;
  let delivering = false;
  server.on("listening", () => {
    alertTimer = setInterval(() => {
      if (delivering || !alertsConfigured()) return;
      delivering = true;
      void deliverRouteAlerts(database).catch(() => {
        console.error("Route alert worker failed");
      }).finally(() => { delivering = false; });
    }, 15000);
    alertTimer.unref();
  });
  server.on("close", () => clearInterval(alertTimer));
  server.on("listening", () => {
    // Let any previously accepted sample finish, without replenishing it.
    if (
      !sampleRidesEnabled &&
      !database
        .prepare(
          "SELECT 1 FROM rides WHERE is_sample = 1 AND status IN ('ACCEPTED', 'RIDE_ACTIVE', 'CO_RIDE_ACTIVE') LIMIT 1",
        )
        .get()
    )
      return;
    sampleTimer = setInterval(() => {
      try {
        const now = new Date();
        expireStaleRides(database, now);
        advanceSampleSimulations(database, now);
        if (sampleRidesEnabled) ensureSampleRides(database, now);
      } catch {
        console.error("Sample simulation tick failed");
      }
    }, 1_000);
    sampleTimer.unref();
  });
  server.on("close", () => clearInterval(sampleTimer));
  return server;
}

if (process.argv[1]?.endsWith("server/index.ts")) {
  const port = Number(process.env.PORT ?? 5060);
  const api = createApiServer(db);
  api.listen(port, "127.0.0.1", () =>
    console.info(`Cocowheels API listening on ${port}`),
  );
}
