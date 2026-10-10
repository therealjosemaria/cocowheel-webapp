import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { Db } from "./core";

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
  const ride = db
    .prepare(
      `SELECT ${rideFields}, origin_latitude, origin_longitude, destination_latitude, destination_longitude FROM rides WHERE public_id = ?`,
    )
    .get(id);
  if (!ride) throw new Error("RIDE_NOT_FOUND");
  return {
    ride,
    requests: db
      .prepare(
        `SELECT rider_alias, status, pickup_label, destination_label, pickup_latitude, pickup_longitude, destination_latitude, destination_longitude, created_at, decided_at FROM ride_requests WHERE ride_id = (SELECT id FROM rides WHERE public_id = ?) ORDER BY created_at DESC LIMIT 200`,
      )
      .all(id),
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
