import { sendTransactionalEmail } from "./email-transport";
import { randomUUID } from "node:crypto";
import type { Db } from "./core";
import type { Pin } from "../lib/client-types";
import { payIdInputError } from "../lib/input-validation";
import { validFare } from "../lib/fare";
import { sameRoute, type UsualRoute } from "../lib/usual-route";
import { routeAlertContent } from "./route-alert-email";

export function initializeUsualRoutes(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usual_routes (
      principal_id TEXT PRIMARY KEY REFERENCES guest_sessions(id),
      version TEXT NOT NULL, body TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS route_alerts (
      id TEXT PRIMARY KEY, ride_id TEXT NOT NULL REFERENCES rides(id),
      principal_id TEXT NOT NULL REFERENCES guest_sessions(id),
      version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL, deadline TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0,
      last_attempt INTEGER, payload TEXT,
      UNIQUE(ride_id, principal_id)
    );
    CREATE INDEX IF NOT EXISTS route_alerts_pending ON route_alerts(status, next_at);
    CREATE TABLE IF NOT EXISTS route_alert_attempts (
      id INTEGER PRIMARY KEY, alert_id TEXT NOT NULL REFERENCES route_alerts(id), attempted_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS route_alert_attempt_time ON route_alert_attempts(attempted_at);
  `);
}
function checkedPin(value: unknown): Pin {
  if (!value || typeof value !== "object")
    throw new Error("INVALID_USUAL_ROUTE");
  const p = value as Pin;
  if (
    !Number.isFinite(p.latitude) ||
    !Number.isFinite(p.longitude) ||
    Math.abs(p.latitude) > 90 ||
    Math.abs(p.longitude) > 180 ||
    typeof p.label !== "string" ||
    !p.label.trim() ||
    p.label.length > 160 ||
    /[\u0000-\u001f]/.test(p.label)
  )
    throw new Error("INVALID_USUAL_ROUTE");
  return {
    latitude: p.latitude,
    longitude: p.longitude,
    label: p.label.trim(),
  };
}
export function validateUsualRoute(value: unknown): UsualRoute {
  if (!value || typeof value !== "object")
    throw new Error("INVALID_USUAL_ROUTE");
  const r = value as UsualRoute;
  const origin = checkedPin(r.origin),
    destination = checkedPin(r.destination);
  if (
    !Array.isArray(r.days) ||
    r.days.length > 7 ||
    r.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7) ||
    new Set(r.days).size !== r.days.length ||
    (r.minute !== null &&
      (!Number.isInteger(r.minute) || r.minute < 0 || r.minute > 1439)) ||
    typeof r.alerts !== "boolean" ||
    (r.anyTime !== undefined && typeof r.anyTime !== "boolean") ||
    (r.anyTime === true && (r.days.length > 0 || r.minute !== null)) ||
    (r.alerts && !r.anyTime && (!r.days.length || r.minute === null)) ||
    r.days.length > 0 !== (r.minute !== null) ||
    !validFare(r.priceAud) ||
    !["MOBILE", "EMAIL", "OTHER"].includes(r.payIdType) ||
    typeof r.payId !== "string" ||
    r.payId.length > 254 ||
    (r.priceAud > 0 && r.payId && payIdInputError(r.payId, r.payIdType))
  )
    throw new Error("INVALID_USUAL_ROUTE");
  return {
    origin,
    destination,
    days: [...r.days].sort(),
    minute: r.minute,
    ...(r.anyTime !== undefined ? { anyTime: r.anyTime } : {}),
    alerts: r.alerts,
    priceAud: r.priceAud,
    payId: r.priceAud === 0 ? "" : r.payId.trim(),
    payIdType: r.payIdType,
  };
}
export function readUsualRoute(db: Db, principal: string) {
  const row = db
    .prepare(
      "SELECT body FROM usual_routes WHERE principal_id = ? AND active = 1",
    )
    .get(principal) as { body: string } | undefined;
  return row ? (JSON.parse(row.body) as UsualRoute) : null;
}
export function saveUsualRoute(
  db: Db,
  principal: string,
  body: unknown,
  now = new Date(),
) {
  const route = validateUsualRoute(body);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO usual_routes VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(principal_id) DO UPDATE SET version=excluded.version, body=excluded.body,
      active=1, updated_at=excluded.updated_at`,
    ).run(principal, randomUUID(), JSON.stringify(route), now.toISOString());
    db.prepare(
      "UPDATE route_alerts SET status = 'SKIPPED' WHERE principal_id = ? AND status = 'PENDING'",
    ).run(principal);
  })();
  return route;
}
export function removeUsualRoute(db: Db, principal: string) {
  db.transaction(() => {
    db.prepare("UPDATE usual_routes SET active = 0 WHERE principal_id = ?").run(
      principal,
    );
    db.prepare(
      "UPDATE route_alerts SET status = 'SKIPPED' WHERE principal_id = ? AND status = 'PENDING'",
    ).run(principal);
  })();
}
export function scheduleMatches(route: UsualRoute, departure: Date) {
  if (route.anyTime === true) return Number.isFinite(departure.getTime());
  if (route.minute === null || !route.days.length) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(departure);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    part("weekday"),
  );
  const current =
    day * 1440 + Number(part("hour")) * 60 + Number(part("minute"));
  return route.days.some((d) => {
    const distance = Math.abs(current - ((d - 1) * 1440 + route.minute!));
    return Math.min(distance, 10080 - distance) <= 60;
  });
}
// Atomic compare-and-save: a stale tab cannot overwrite a newer mute or schedule.
export function saveSearchRoute(db: Db, principal: string, body: Record<string, unknown>) {
  return db.transaction(() => {
    const current = readUsualRoute(db, principal);
    const expected = body.expected === null ? null : validateUsualRoute(body.expected);
    if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error("USUAL_ROUTE_CHANGED");
    if (body.notify !== undefined && typeof body.notify !== "boolean") throw new Error("INVALID_USUAL_ROUTE");
    if (body.notify === true && !alertsConfigured()) throw new Error("ALERTS_UNAVAILABLE");
    const addresses = { origin: checkedPin(body.origin), destination: checkedPin(body.destination) };
    const route: UsualRoute = current ? { ...current, ...addresses } : {
      ...addresses, anyTime: true, days: [], minute: null, alerts: false,
      priceAud: 0, payId: "", payIdType: "MOBILE",
    };
    if (body.notify === true) {
      route.alerts = true;
      // Legacy driver-only routes have no rider schedule. Explicit consent enables any time.
      if (!route.days.length && route.minute === null) route.anyTime = true;
    }
    if (current && sameRoute(current, route) && JSON.stringify(current) === JSON.stringify(route)) return current;
    return saveUsualRoute(db, principal, route);
  })();
}
// Conservative straight-line corridor, with pickup-before-drop-off order.
// Suggestions are advisory, not a road-detour guarantee.
export function corridorMatches(
  origin: Pin,
  destination: Pin,
  route: Pick<UsualRoute, "origin" | "destination">,
) {
  const scale = Math.cos((origin.latitude * Math.PI) / 180);
  const point = (p: Pin) => [
    (p.longitude - origin.longitude) * 111320 * scale,
    (p.latitude - origin.latitude) * 111320,
  ];
  const [x, y] = point(destination),
    length = x * x + y * y;
  if (length < 10000) return false;
  const project = (p: Pin) => {
    const [px, py] = point(p),
      t = (px * x + py * y) / length;
    return {
      t,
      distance: Math.hypot(
        px - Math.max(0, Math.min(1, t)) * x,
        py - Math.max(0, Math.min(1, t)) * y,
      ),
    };
  };
  const a = project(route.origin),
    b = project(route.destination);
  return (
    a.t >= -0.20 &&
    b.t <= 1.05 &&
    b.t > a.t &&
    a.distance <= 1500 &&
    b.distance <= 2500
  );
}
export function queueRouteAlerts(
  db: Db,
  rideId: string,
  driver: string,
  origin: Pin,
  destination: Pin,
  departure: string,
  now: Date,
) {
  const deadline = new Date(
    Math.min(now.getTime() + 6 * 3600000, Date.parse(departure) + 3600000),
  );
  if (deadline <= now) return;
  const routes = db
    .prepare(
      "SELECT principal_id, version, body FROM usual_routes WHERE active = 1 AND principal_id != ?",
    )
    .all(driver) as { principal_id: string; version: string; body: string }[];
  const insert = db.prepare(
    "INSERT OR IGNORE INTO route_alerts (id,ride_id,principal_id,version,created_at,deadline) VALUES (?,?,?,?,?,?)",
  );
  for (const row of routes) {
    const r: UsualRoute = JSON.parse(row.body);
    if (
      r.alerts &&
      scheduleMatches(r, new Date(departure)) &&
      corridorMatches(origin, destination, r)
    )
      insert.run(
        randomUUID(),
        rideId,
        row.principal_id,
        row.version,
        now.toISOString(),
        deadline.toISOString(),
      );
  }
}
type Email = { from: string; to: string[]; subject: string; text: string; html?: string };
export type AlertSender = (email: Email, id: string) => Promise<void>;
export const sendRouteAlert: AlertSender = (email, id) => sendTransactionalEmail(email, `usual-route/${id}`);
export function alertsConfigured() {
  return Boolean(
    process.env.COCOWHEELS_ROUTE_ALERTS_ENABLED === "1" &&
    process.env.COCOWHEELS_RESEND_API_KEY &&
    process.env.COCOWHEELS_EMAIL_FROM &&
    process.env.COCOWHEELS_PUBLIC_ORIGIN,
  );
}
export async function deliverRouteAlerts(
  db: Db,
  send: AlertSender = sendRouteAlert,
  now = new Date(),
) {
  if (send === sendRouteAlert && !alertsConfigured()) return;
  // No app-wide alert volume cap. Keep attempt auditing and per-job safeguards;
  // provider quotas still apply, and OTP rate limits are independent.
  const job = db
    .prepare(
      `SELECT a.*, r.public_id, r.status AS ride_status, COALESCE(p.username, CASE WHEN instr(r.driver_alias,'@') > 0 THEN 'rider' ELSE r.driver_alias END) AS driver_alias,
    r.scheduled_departure_at, r.offer_expires_at, r.price_aud,
    u.active, u.version AS current_version, u.body, v.unikey
    FROM route_alerts a JOIN rides r ON r.id=a.ride_id
    LEFT JOIN account_profiles p ON p.principal_id=r.driver_session_id
    JOIN usual_routes u ON u.principal_id=a.principal_id
    JOIN university_accounts v ON v.principal_id=a.principal_id
    WHERE a.status='PENDING' AND a.next_at <= ? ORDER BY a.created_at, a.id LIMIT 1`,
    )
    .get(now.getTime()) as
    | {
        id: string;
        principal_id: string;
        version: string;
        current_version: string;
        active: number;
        body: string;
        deadline: string;
        ride_status: string;
        offer_expires_at: string;
        public_id: string;
        driver_alias: string;
        unikey: string;
        scheduled_departure_at: string;
        price_aud: number;
        attempts: number;
        payload: string | null;
      }
    | undefined;
  if (!job) return;
  if (job.attempts >= 3) {
    db.prepare("UPDATE route_alerts SET status='FAILED' WHERE id=?").run(
      job.id,
    );
    return;
  }
  const route: UsualRoute = JSON.parse(job.body);
  const busy = db
    .prepare(
      `SELECT 1 FROM rides WHERE driver_session_id=? AND status IN ('PUBLISHED','REQUESTED','ACCEPTED','RIDE_ACTIVE','CO_RIDE_ACTIVE')
    UNION ALL SELECT 1 FROM ride_requests q JOIN rides r ON r.id=q.ride_id WHERE q.rider_session_id=? AND q.status IN ('PENDING','ACCEPTED')
    AND r.status NOT IN ('CANCELLED','COMPLETED','EXPIRED') LIMIT 1`,
    )
    .get(job.principal_id, job.principal_id);
  if (
    !job.active ||
    !route.alerts ||
    job.version !== job.current_version ||
    !["PUBLISHED", "REQUESTED"].includes(job.ride_status) ||
    job.deadline <= now.toISOString() ||
    job.offer_expires_at <= now.toISOString() ||
    busy
  ) {
    db.prepare("UPDATE route_alerts SET status='SKIPPED' WHERE id=?").run(
      job.id,
    );
    return;
  }
  const origin =
    process.env.COCOWHEELS_PUBLIC_ORIGIN ?? "http://localhost:3000";
  const email: Email = job.payload
    ? JSON.parse(job.payload)
    : {
        from: (process.env.COCOWHEELS_EMAIL_FROM ?? "test@example.com").replace(
          /^"?Coco\s?Wheels?"?(?=\s*<)/i,
          "GUMWHEEL",
        ),
        to: [
          job.unikey === "guest"
            ? "mosciarobusiness@gmail.com"
            : job.unikey.includes("@")
              ? job.unikey
              : `${job.unikey}@uni.sydney.edu.au`,
        ],
        subject: "A ride matches your usual route",
        ...routeAlertContent(origin, job.public_id, job.driver_alias, job.scheduled_departure_at, job.price_aud),
      };
  // Persist the exact payload for provider idempotency across retry/restart.
  const claimed = db.transaction(() => {
    const changed = db
      .prepare(
        "UPDATE route_alerts SET attempts=attempts+1, last_attempt=?, next_at=?, payload=? WHERE id=? AND status='PENDING' AND next_at<=?",
      )
      .run(
        now.getTime(),
        now.getTime() + 60000,
        JSON.stringify(email),
        job.id,
        now.getTime(),
      ).changes;
    if (changed)
      db.prepare(
        "INSERT INTO route_alert_attempts (alert_id, attempted_at) VALUES (?,?)",
      ).run(job.id, now.getTime());
    return changed;
  })();
  if (!claimed) return;
  try {
    await send(email, job.id);
    db.prepare("UPDATE route_alerts SET status='SENT' WHERE id=?").run(job.id);
  } catch {
    if (job.attempts >= 2)
      db.prepare("UPDATE route_alerts SET status='FAILED' WHERE id=?").run(
        job.id,
      );
    // No sensitive provider response, recipient or route information in logs.
  }
}
