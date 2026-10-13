import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { Db } from "./core";
import { requestFitForRide } from "./core";
import { cachedRoutePreview } from "./provider-cache";

export const ADMIN_IDLE_MS = 60 * 60 * 1000;
export const ADMIN_MAX_MS = 8 * ADMIN_IDLE_MS;
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function initializeAdmin(db: Db) {
  db.exec(`CREATE TABLE IF NOT EXISTS admin_account (username TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_attempts (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);`);
}
// Provision explicitly on the server; no default password exists in source code.
export function provisionAdmin(db: Db, username: string, password: string) {
  if (
    !username ||
    username.length > 80 ||
    password.length < 8 ||
    password.length > 256
  )
    throw new Error("INVALID_ADMIN_CREDENTIALS");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  db.transaction(() => {
    db.prepare("INSERT OR REPLACE INTO admin_account VALUES (?, ?, ?)").run(
      username,
      salt,
      hash,
    );
    db.prepare("DELETE FROM admin_sessions").run();
  })();
}
export function loginAdmin(
  db: Db,
  username: unknown,
  password: unknown,
  now = Date.now(),
) {
  // A persisted account-wide limit cannot be bypassed by spoofing proxy/IP headers.
  const bucket = db
    .prepare(
      "SELECT count, reset_at FROM admin_attempts WHERE bucket = 'login'",
    )
    .get() as { count: number; reset_at: number } | undefined;
  if (bucket && bucket.reset_at > now && bucket.count >= 10)
    throw new Error("ADMIN_RATE_LIMITED");
  db.prepare(
    "INSERT OR REPLACE INTO admin_attempts VALUES ('login', ?, ?)",
  ).run(
    bucket && bucket.reset_at > now ? bucket.count + 1 : 1,
    bucket && bucket.reset_at > now ? bucket.reset_at : now + 15 * 60_000,
  );
  const account = db
    .prepare("SELECT username, salt, password_hash FROM admin_account LIMIT 1")
    .get() as
    { username: string; salt: string; password_hash: string } | undefined;
  if (!account) throw new Error("ADMIN_NOT_CONFIGURED");
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length > 80 ||
    password.length > 256
  )
    throw new Error("ADMIN_LOGIN_INVALID");
  const actual = scryptSync(password, account.salt, 64);
  if (
    !timingSafeEqual(actual, Buffer.from(account.password_hash, "hex")) ||
    username !== account.username
  )
    throw new Error("ADMIN_LOGIN_INVALID");
  const token = randomBytes(32).toString("hex");
  db.prepare(
    "DELETE FROM admin_sessions WHERE created_at <= ? OR last_seen_at <= ?",
  ).run(now - ADMIN_MAX_MS, now - ADMIN_IDLE_MS);
  db.prepare("INSERT INTO admin_sessions VALUES (?, ?, ?)").run(
    digest(token),
    now,
    now,
  );
  return token;
}
export function requireAdmin(
  db: Db,
  token: string | null,
  touch = false,
  now = Date.now(),
) {
  const session = token
    ? (db
        .prepare(
          "SELECT created_at, last_seen_at FROM admin_sessions WHERE token_hash = ?",
        )
        .get(digest(token)) as
        { created_at: number; last_seen_at: number } | undefined)
    : undefined;
  if (
    !session ||
    session.created_at + ADMIN_MAX_MS <= now ||
    session.last_seen_at + ADMIN_IDLE_MS <= now
  )
    throw new Error("ADMIN_SESSION_REQUIRED");
  if (touch)
    db.prepare(
      "UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?",
    ).run(now, digest(token!));
  return {
    expiresAt: Math.min(
      session.created_at + ADMIN_MAX_MS,
      (touch ? now : session.last_seen_at) + ADMIN_IDLE_MS,
    ),
  };
}
export function logoutAdmin(db: Db, token: string | null) {
  if (token)
    db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(
      digest(token),
    );
}
export function adminCookie(token: string, secure: boolean) {
  return `cocowheels_admin=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${token ? 28800 : 0}${secure ? "; Secure" : ""}`;
}
export function readAdminCookie(value = "") {
  return (
    value
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("cocowheels_admin="))
      ?.slice(17) ?? null
  );
}
const rideFields = `public_id, status, driver_alias, origin_label, destination_label, price_aud, is_sample, created_at, scheduled_departure_at, offer_expires_at, accepted_at, ride_started_at, co_ride_started_at, completed_at, cancelled_at, expired_at, cancellation_reason, payment_handoff_method`;
export function adminDashboard(db: Db, url: URL) {
  const page = Math.max(
    0,
    Math.min(100000, Number(url.searchParams.get("page")) || 0),
  );
  const status = url.searchParams.get("status") ?? "";
  const filter = "(? = '' OR status = ?)";
  return {
    counts: db
      .prepare("SELECT status, COUNT(*) AS count FROM rides GROUP BY status")
      .all(),
    total: (
      db
        .prepare(`SELECT COUNT(*) AS count FROM rides WHERE ${filter}`)
        .get(status, status) as { count: number }
    ).count,
    rides: db
      .prepare(
        `SELECT ${rideFields} FROM rides WHERE ${filter} ORDER BY created_at DESC, public_id LIMIT 25 OFFSET ?`,
      )
      .all(status, status, Math.floor(page) * 25),
    page: Math.floor(page),
    serverNow: new Date().toISOString(),
  };
}
export function adminInspector(db: Db, id: string) {
  const fitRide = db
    .prepare("SELECT * FROM rides WHERE public_id = ?")
    .get(id) as Parameters<typeof requestFitForRide>[0] | undefined;
  const ride = db
    .prepare(
      `SELECT ${rideFields}, origin_latitude, origin_longitude, destination_latitude, destination_longitude FROM rides WHERE public_id = ?`,
    )
    .get(id);
  if (!ride || !fitRide) throw new Error("RIDE_NOT_FOUND");
  const evidence = db.prepare("SELECT * FROM pickup_evidence WHERE ride_id = ?").get(fitRide.id) as {
    verified_at: string; within_250_metres: number | null; separation_metres: number | null;
    driver_fix: string | null; rider_fix: string | null;
  } | undefined;
  const pickupEvidence: Record<string, string | number | null> | null = evidence ? {
    verified_at: evidence.verified_at,
    within_250_metres: evidence.within_250_metres === null ? "Unknown" : evidence.within_250_metres ? "Yes" : "No",
    separation_metres: evidence.separation_metres === null ? null : Math.round(evidence.separation_metres),
  } : null;
  if (evidence && pickupEvidence) {
    for (const role of ["driver", "rider"] as const) {
      const raw = evidence[`${role}_fix`];
      if (!raw) { pickupEvidence[`${role}_gps`] = "Not available"; continue; }
      const fix = JSON.parse(raw) as { latitude: number; longitude: number; accuracy_meters: number; captured_at: string; received_at: string };
      for (const [key, value] of Object.entries(fix)) pickupEvidence[`${role}_${key}`] = value;
      pickupEvidence[`${role}_gps_age_seconds`] = Math.max(0, Math.round((Date.parse(evidence.verified_at) - Date.parse(fix.captured_at)) / 1000));
    }
  }
  const driverLocation = db
    .prepare(
      "SELECT latitude, longitude FROM live_locations WHERE ride_id = ? AND participant = 'DRIVER'",
    )
    .get(fitRide.id) as { latitude: number; longitude: number } | undefined;
  return {
    ride,
    pickupEvidence,
    requests: db
      .prepare(
        `SELECT rider_alias, status, pickup_label, destination_label, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude, requested_departure_at, created_at, decided_at FROM ride_requests WHERE ride_id = (SELECT id FROM rides WHERE public_id = ?) ORDER BY created_at DESC LIMIT 200`,
      )
      .all(id)
      .map((request) => {
        const row = request as Parameters<typeof requestFitForRide>[1];
        const estimate = [
          "PUBLISHED",
          "REQUESTED",
          "ACCEPTED",
          "RIDE_ACTIVE",
          "CO_RIDE_ACTIVE",
        ].includes(fitRide.status)
          ? cachedRoutePreview(
              db,
              driverLocation ?? {
                latitude: fitRide.origin_latitude,
                longitude: fitRide.origin_longitude,
              },
              {
                latitude: row.pickup_latitude,
                longitude: row.pickup_longitude,
              },
              false,
            )
          : null;
        return {
          ...(request as Record<string, unknown>),
          fit: requestFitForRide(fitRide, row),
          cached_pickup_minutes: estimate
            ? Math.max(1, Math.round(estimate.durationSeconds / 60))
            : null,
        };
      }),
    locations: db
      .prepare(
        `SELECT participant, latitude, longitude, accuracy_meters, captured_at, received_at FROM live_locations WHERE ride_id = (SELECT id FROM rides WHERE public_id = ?)`,
      )
      .all(id),
    events: db
      .prepare(
        `SELECT event, actor, created_at FROM ride_events WHERE ride_id = (SELECT id FROM rides WHERE public_id = ?) ORDER BY created_at DESC, id DESC LIMIT 200`,
      )
      .all(id),
  };
}
