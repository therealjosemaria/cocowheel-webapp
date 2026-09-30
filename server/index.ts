import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Db } from "./core";
import {
  beginRide,
  cancelPendingRequest,
  cancelRide,
  completeCoRide,
  confirmCoRideCode,
  currentOpenRide,
  decideRequest,
  expireStaleRides,
  findSession,
  getRide,
  guestCookie,
  initializeCoreSchema,
  privateHistory,
  publishRide,
  readGuestCookie,
  requestRide,
  searchRides,
  submitLocation,
} from "./core";
import db from "./db";

const MAX_BODY_BYTES = 32_768;
type Json = Record<string, unknown>;

function originAllowed(origin: string | undefined) {
  if (!origin) return true;
  const configured =
    process.env.COCOWHEELS_FRONTEND_ORIGIN ?? "http://localhost:3000";
  return origin === configured;
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
      "RIDE_CANNOT_BEGIN",
      "CANCELLATION_NOT_ALLOWED",
      "CO_RIDE_NOT_ACTIVE",
      "REQUEST_CANCELLATION_NOT_ALLOWED",
      "LOCATION_NOT_ALLOWED",
    ].includes(code)
  )
    return 409;
  if (code === "BODY_TOO_LARGE") return 413;
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

export function createApiServer(database: Db) {
  initializeCoreSchema(database);
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
      expireStaleRides(database);
      const parts = pathParts(request.url);
      const token = requestToken(request);
      if (
        request.method === "GET" &&
        (parts.join("/") === "health" || parts.join("/") === "api/health")
      ) {
        writeJson(response, 200, { status: "ok" }, cors);
        return;
      }
      if (request.method === "POST" && parts.join("/") === "api/search") {
        writeJson(
          response,
          200,
          {
            candidates: searchRides(
              database,
              inputSearch(await readJson(request)),
            ),
          },
          cors,
        );
        return;
      }
      if (request.method === "GET" && parts.join("/") === "api/current") {
        writeJson(
          response,
          200,
          { current: currentOpenRide(database, token) },
          cors,
        );
        return;
      }
      if (request.method === "POST" && parts.join("/") === "api/rides") {
        const body = await readJson(request);
        const result = publishRide(database, token, {
          origin: pin(body.origin),
          destination: pin(body.destination),
          scheduledDepartureAt: asString(body.scheduledDepartureAt),
          priceAud: asNumber(body.priceAud),
          payId: typeof body.payId === "string" ? body.payId : undefined,
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
        parts.length === 3 &&
        parts[0] === "api" &&
        parts[1] === "rides"
      ) {
        const session = findSession(database, token);
        if (!session) throw new Error("GUEST_SESSION_REQUIRED");
        writeJson(
          response,
          200,
          { ride: getRide(database, parts[2], session) },
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
        const result = requestRide(
          database,
          token,
          parts[2],
          inputSearch(await readJson(request)),
        );
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
