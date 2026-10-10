import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { payIdInputError } from "../lib/input-validation";

export type Db = Database.Database;
export type RideStatus =
  | "PUBLISHED"
  | "REQUESTED"
  | "ACCEPTED"
  | "RIDE_ACTIVE"
  | "CO_RIDE_ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";
export type RequestStatus =
  "PENDING" | "ACCEPTED" | "DECLINED" | "DISCARDED" | "CANCELLED";
export type Participant = "DRIVER" | "RIDER";
export type Session = { id: string; alias: string };
export type Pin = { latitude: number; longitude: number; label?: string };
export type DirectionFit = "GOOD" | "POOR";

const SESSION_COOKIE = "cocowheels_guest";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OFFER_STALE_MS = 60 * 60 * 1000;
const SAMPLE_OFFER_STALE_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STALE_MS = 24 * 60 * 60 * 1000;
const LOCATION_FRESH_MS = 2 * 60 * 1000;
const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const CODE_ATTEMPT_INTERVAL_MS = 2_000;
export const ANONYMOUS_ANIMALS = [
  "Ibex",
  "Wombat",
  "Kookaburra",
  "Quokka",
  "Bilby",
  "Echidna",
  "Rosella",
  "Dingo",
  "Numbat",
  "Wallaby",
  "Koala",
  "Platypus",
  "Kangaroo",
  "Emu",
  "Cockatoo",
  "Possum",
  "Bandicoot",
  "Cassowary",
  "Galah",
  "Lorikeet",
  "Dolphin",
  "Otter",
  "Penguin",
  "Puffin",
  "Badger",
  "Fox",
  "Lynx",
  "Panda",
  "Tiger",
  "Leopard",
  "Jaguar",
  "Cheetah",
  "Zebra",
  "Giraffe",
  "Elephant",
  "Rhino",
  "Hippo",
  "Moose",
  "Bison",
  "Beaver",
  "Falcon",
  "Owl",
  "Raven",
  "Robin",
  "Sparrow",
  "Turtle",
  "Gecko",
  "Axolotl",
  "Alpaca",
  "Capybara",
] as const;
const ALIAS_COOLDOWN = 10;
const publicAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export type PayIdType = "MOBILE" | "EMAIL" | "OTHER";

type RideRow = {
  id: string;
  public_id: string;
  status: RideStatus;
  driver_session_id: string;
  driver_alias: string;
  origin_latitude: number;
  origin_longitude: number;
  origin_label: string | null;
  destination_latitude: number;
  destination_longitude: number;
  destination_label: string | null;
  scheduled_departure_at: string;
  offer_expires_at: string | null;
  is_sample: 0 | 1;
  sample_key: string | null;
  price_aud: number;
  driver_payid: string | null;
  driver_payid_type: PayIdType | null;
  accepted_request_id: string | null;
  co_ride_code_hash: string | null;
  co_ride_code_ciphertext: string | null;
  co_ride_code_expires_at: string | null;
  co_ride_code_attempts: number;
  co_ride_code_last_attempt_at: string | null;
  created_at: string;
  accepted_at: string | null;
  ride_started_at: string | null;
  co_ride_started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  cancellation_reason: string | null;
  payment_handoff_method: "PAYID" | "CASH" | null;
  last_activity_at: string;
};
type RequestRow = {
  id: string;
  ride_id: string;
  rider_session_id: string;
  rider_alias: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_label: string | null;
  destination_latitude: number;
  destination_longitude: number;
  destination_label: string | null;
  requested_departure_at: string;
  status: RequestStatus;
  created_at: string;
  decided_at: string | null;
};
type LocationRow = {
  moving: number;
  participant: Participant;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  captured_at: string;
  received_at: string;
};

export type Candidate = {
  driverLocation?: PublicLocation;
  rideId: string;
  driverAlias: string;
  priceAud: number;
  scheduledDepartureAt: string;
  expiresAt: string;
  directionFit: DirectionFit;
  redactedCorridor: [Pin, Pin];
  pickupDistanceMeters: number;
  destinationDistanceMeters: number;
  isOwnOffer: boolean;
  departureLabel: string | null;
  destinationLabel: string | null;
};
export type AvailabilityOffer = {
  rideId: string;
  driverAlias: string;
  priceAud: number;
  scheduledDepartureAt: string;
  expiresAt: string;
  departureLabel: string | null;
  destinationLabel: string | null;
  status: "PUBLISHED" | "REQUESTED";
  isOwnOffer: boolean;
};
export type PublicRidePreview = {
  driverLocation?: PublicLocation;
  rideId: string;
  driverAlias: string;
  priceAud: number;
  scheduledDepartureAt: string;
  expiresAt: string;
  status: "PUBLISHED" | "REQUESTED";
  departureLabel: string;
  destinationLabel: string;
  plannedRoute: { origin: Pin; destination: Pin };
};
export type RideView = {
  rideId: string;
  status: RideStatus;
  driverAlias: string;
  priceAud: number;
  scheduledDepartureAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  request?: RiderRequestView;
  plannedRoute?: { origin: Pin; destination: Pin };
  rider?: {
    alias: string;
    pickup: Pin;
    destination: Pin;
    requestedDepartureAt: string;
    directionFit: DirectionFit;
  };
  requests?: Array<{
    requestId: string;
    riderAlias: string;
    pickup: Pin;
    destination: Pin;
    createdAt: string;
    requestedDepartureAt: string;
    directionFit: DirectionFit;
    status: RequestStatus;
  }>;
  driverLocation?: PublicLocation;
  riderLocation?: PublicLocation;
  coRideCode?: string;
  payId?: string | null;
  payIdType?: PayIdType | null;
  paymentHandoffMethod?: "PAYID" | "CASH" | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  expiredAt?: string | null;
  cancellationReason?: string | null;
};
export type RiderRequestView = {
  requestId: string;
  riderAlias: string;
  status: RequestStatus;
  pickup: Pin;
  destination: Pin;
  createdAt: string;
  requestedDepartureAt: string;
  directionFit: DirectionFit;
  decidedAt?: string | null;
};
export type PublicLocation = {
  moving: boolean;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  stale: boolean;
};
export type CreateRideInput = {
  origin: Pin;
  destination: Pin;
  scheduledDepartureAt: string;
  priceAud: number;
  payId?: string;
  payIdType?: PayIdType;
};
export type SearchInput = {
  pickup: Pin;
  destination: Pin;
  requestedDepartureAt: string;
};

const iso = (value = new Date()) => value.toISOString();
const offerExpiryAt = (scheduledDepartureAt: string) =>
  iso(new Date(new Date(scheduledDepartureAt).getTime() + OFFER_STALE_MS));
const rideOfferExpiryAt = (
  ride: Pick<RideRow, "offer_expires_at" | "scheduled_departure_at">,
) => ride.offer_expires_at ?? offerExpiryAt(ride.scheduled_departure_at);
const uuid = () => {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const opaqueToken = () => randomBytes(32).toString("base64url");
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const sameSecret = (value: string, stored: string) => {
  const actual = Buffer.from(hash(value), "hex");
  const expected = Buffer.from(stored, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
const alias = (db: Db) => {
  const recent = new Set(
    (
      db
        .prepare(
          "SELECT anonymous_alias FROM guest_sessions WHERE anonymous_alias IS NOT NULL ORDER BY created_at DESC, rowid DESC LIMIT ?",
        )
        .all(ALIAS_COOLDOWN) as Array<{ anonymous_alias: string }>
    ).map((row) => row.anonymous_alias),
  );
  const available = ANONYMOUS_ANIMALS.filter(
    (animal) => !recent.has(`Anonymous ${animal}`),
  );
  const pool = available.length > 0 ? available : ANONYMOUS_ANIMALS;
  const animal = pool[randomInt(pool.length)];
  return `Anonymous ${animal}`;
};
const terminal = (status: RideStatus) =>
  ["COMPLETED", "CANCELLED", "EXPIRED"].includes(status);

export function initializeCoreSchema(db: Db) {
  db.exec(
    readFileSync(path.join(process.cwd(), "server", "schema.sql"), "utf8"),
  );
  const locationColumns = db
    .prepare("PRAGMA table_info(live_locations)")
    .all() as Array<{ name: string }>;
  if (!locationColumns.some((column) => column.name === "moving"))
    db.exec(
      "ALTER TABLE live_locations ADD COLUMN moving INTEGER NOT NULL DEFAULT 0",
    );
  const sessionColumns = db
    .prepare("PRAGMA table_info(guest_sessions)")
    .all() as Array<{ name: string }>;
  if (!sessionColumns.some((column) => column.name === "anonymous_alias"))
    db.exec("ALTER TABLE guest_sessions ADD COLUMN anonymous_alias TEXT");
  const sessionsWithoutAlias = db
    .prepare("SELECT id FROM guest_sessions WHERE anonymous_alias IS NULL")
    .all() as Array<{ id: string }>;
  const latestAlias = db.prepare(`
    SELECT guest_alias
    FROM (
      SELECT driver_alias AS guest_alias, created_at
      FROM rides
      WHERE driver_session_id = ?
      UNION ALL
      SELECT rider_alias AS guest_alias, created_at
      FROM ride_requests
      WHERE rider_session_id = ?
    )
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const saveAlias = db.prepare(
    "UPDATE guest_sessions SET anonymous_alias = ? WHERE id = ?",
  );
  const alignOpenDriverAlias = db.prepare(
    "UPDATE rides SET driver_alias = ? WHERE driver_session_id = ? AND status IN ('PUBLISHED', 'REQUESTED', 'ACCEPTED', 'RIDE_ACTIVE', 'CO_RIDE_ACTIVE')",
  );
  const alignOpenRiderAlias = db.prepare(
    "UPDATE ride_requests SET rider_alias = ? WHERE rider_session_id = ? AND status IN ('PENDING', 'ACCEPTED')",
  );
  db.transaction(() => {
    for (const session of sessionsWithoutAlias) {
      const historical = latestAlias.get(session.id, session.id) as
        { guest_alias: string } | undefined;
      const guestAlias = historical?.guest_alias ?? alias(db);
      saveAlias.run(guestAlias, session.id);
      alignOpenDriverAlias.run(guestAlias, session.id);
      alignOpenRiderAlias.run(guestAlias, session.id);
    }
  })();
  const rideColumns = db.prepare("PRAGMA table_info(rides)").all() as Array<{
    name: string;
  }>;
  if (!rideColumns.some((column) => column.name === "driver_payid_type")) {
    db.exec(
      "ALTER TABLE rides ADD COLUMN driver_payid_type TEXT CHECK (driver_payid_type IN ('MOBILE', 'EMAIL', 'OTHER'))",
    );
  }
  if (!rideColumns.some((column) => column.name === "offer_expires_at"))
    db.exec("ALTER TABLE rides ADD COLUMN offer_expires_at TEXT");
  if (!rideColumns.some((column) => column.name === "is_sample"))
    db.exec(
      "ALTER TABLE rides ADD COLUMN is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1))",
    );
  if (!rideColumns.some((column) => column.name === "sample_key"))
    db.exec("ALTER TABLE rides ADD COLUMN sample_key TEXT");
  const routeCacheColumns = db
    .prepare("PRAGMA table_info(route_preview_cache)")
    .all() as Array<{ name: string }>;
  if (!routeCacheColumns.some((column) => column.name === "distance_meters"))
    db.exec("ALTER TABLE route_preview_cache ADD COLUMN distance_meters REAL");
  if (!routeCacheColumns.some((column) => column.name === "duration_seconds"))
    db.exec("ALTER TABLE route_preview_cache ADD COLUMN duration_seconds REAL");
  const requestTable = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ride_requests'",
    )
    .get() as { sql: string } | undefined;
  if (
    !requestTable?.sql.match(
      /UNIQUE\s*\(\s*ride_id\s*,\s*rider_session_id\s*\)/i,
    )
  )
    return;

  db.pragma("foreign_keys = OFF");
  try {
    db.exec(`
      BEGIN IMMEDIATE;
      ALTER TABLE ride_requests RENAME TO ride_requests_legacy_unique;
      CREATE TABLE ride_requests (
        id TEXT PRIMARY KEY,
        ride_id TEXT NOT NULL REFERENCES rides(id),
        rider_session_id TEXT NOT NULL REFERENCES guest_sessions(id),
        rider_alias TEXT NOT NULL,
        pickup_latitude REAL NOT NULL,
        pickup_longitude REAL NOT NULL,
        pickup_label TEXT,
        destination_latitude REAL NOT NULL,
        destination_longitude REAL NOT NULL,
        destination_label TEXT,
        requested_departure_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'DISCARDED', 'CANCELLED')),
        created_at TEXT NOT NULL,
        decided_at TEXT
      );
      INSERT INTO ride_requests (
        id, ride_id, rider_session_id, rider_alias,
        pickup_latitude, pickup_longitude, pickup_label,
        destination_latitude, destination_longitude, destination_label,
        requested_departure_at, status, created_at, decided_at
      )
      SELECT
        id, ride_id, rider_session_id, rider_alias,
        pickup_latitude, pickup_longitude, pickup_label,
        destination_latitude, destination_longitude, destination_label,
        requested_departure_at, status, created_at, decided_at
      FROM ride_requests_legacy_unique;
      DROP TABLE ride_requests_legacy_unique;
      CREATE INDEX ride_requests_rider_index ON ride_requests(rider_session_id, status);
      CREATE INDEX ride_requests_ride_index ON ride_requests(ride_id, status);
      COMMIT;
    `);
  } catch (error) {
    if (db.inTransaction) db.exec("ROLLBACK");
    throw error;
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

export function guestCookie(
  token: string,
  secure = process.env.NODE_ENV === "production",
  crossSite = false,
) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${crossSite ? "None" : "Lax"}`,
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readGuestCookie(header: string | undefined) {
  if (!header) return null;
  const value = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return value
    ? decodeURIComponent(value.slice(SESSION_COOKIE.length + 1))
    : null;
}

export function findSession(
  db: Db,
  token: string | null,
  now = new Date(),
): Session | null {
  if (!token) return null;
  const row = db
    .prepare(
      "SELECT id, anonymous_alias FROM guest_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?",
    )
    .get(hash(token), iso(now)) as
    { id: string; anonymous_alias: string | null } | undefined;
  if (!row) return null;
  const guestAlias = row.anonymous_alias ?? alias(db);
  if (!row.anonymous_alias)
    db.prepare(
      "UPDATE guest_sessions SET anonymous_alias = ? WHERE id = ?",
    ).run(guestAlias, row.id);
  db.prepare("UPDATE guest_sessions SET last_seen_at = ? WHERE id = ?").run(
    iso(now),
    row.id,
  );
  return { id: row.id, alias: guestAlias };
}

export function createGuestSession(db: Db, now = new Date()) {
  const token = opaqueToken();
  const id = uuid();
  const createdAt = iso(now);
  return db.transaction(() => {
    const guestAlias = alias(db);
    db.prepare(
      "INSERT INTO guest_sessions (id, token_hash, anonymous_alias, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      id,
      hash(token),
      guestAlias,
      createdAt,
      createdAt,
      iso(new Date(now.getTime() + SESSION_TTL_MS)),
    );
    return { session: { id, alias: guestAlias }, token };
  })();
}

export function guestAlias(
  db: Db,
  rawSessionToken: string | null,
  now = new Date(),
) {
  return requireSession(db, rawSessionToken, now).alias;
}

function requireSession(db: Db, token: string | null, now?: Date) {
  const session = findSession(db, token, now);
  if (!session) throw new Error("GUEST_SESSION_REQUIRED");
  return session;
}
function validDate(value: string, message = "INVALID_TIME") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(message);
  return date;
}
function validPin(pin: Pin, field: string) {
  if (
    !pin ||
    !Number.isFinite(pin.latitude) ||
    pin.latitude < -90 ||
    pin.latitude > 90 ||
    !Number.isFinite(pin.longitude) ||
    pin.longitude < -180 ||
    pin.longitude > 180
  )
    throw new Error(`INVALID_${field}_PIN`);
  if (
    pin.label != null &&
    (typeof pin.label !== "string" || pin.label.trim().length > 160)
  )
    throw new Error(`INVALID_${field}_LABEL`);
}
function cleanOptional(
  value: string | undefined,
  maximum: number,
  error: string,
) {
  if (value == null || value.trim() === "") return null;
  const cleaned = value.trim();
  if (cleaned.length > maximum) throw new Error(error);
  return cleaned;
}
function fallbackLocationLabel(pin: Pick<Pin, "latitude" | "longitude">) {
  return `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`;
}
function rideRow(db: Db, rideId: string) {
  return db.prepare("SELECT * FROM rides WHERE public_id = ?").get(rideId) as
    RideRow | undefined;
}
function requestRow(db: Db, requestId: string) {
  return db
    .prepare("SELECT * FROM ride_requests WHERE id = ?")
    .get(requestId) as RequestRow | undefined;
}
function requestForSession(
  db: Db,
  rideId: string,
  sessionId: string,
  requestId?: string,
) {
  if (requestId)
    return db
      .prepare(
        "SELECT * FROM ride_requests WHERE id = ? AND ride_id = ? AND rider_session_id = ?",
      )
      .get(requestId, rideId, sessionId) as RequestRow | undefined;
  return db
    .prepare(
      `SELECT * FROM ride_requests
       WHERE ride_id = ? AND rider_session_id = ?
       ORDER BY CASE WHEN status IN ('PENDING', 'ACCEPTED') THEN 0 ELSE 1 END, created_at DESC
       LIMIT 1`,
    )
    .get(rideId, sessionId) as RequestRow | undefined;
}
function acceptedRequest(db: Db, row: RideRow) {
  return row.accepted_request_id
    ? requestRow(db, row.accepted_request_id)
    : undefined;
}
function event(
  db: Db,
  rideId: string,
  action: string,
  actor: Participant | "SYSTEM",
  now: Date,
) {
  db.prepare(
    "INSERT INTO ride_events (ride_id, event, actor, created_at) VALUES (?, ?, ?, ?)",
  ).run(rideId, action, actor, iso(now));
}

function publicId(db: Db) {
  for (;;) {
    const suffix = Array.from(
      { length: 7 },
      () => publicAlphabet[randomInt(publicAlphabet.length)],
    ).join("");
    const value = `COCO-${suffix}`;
    if (!db.prepare("SELECT 1 FROM rides WHERE public_id = ?").get(value))
      return value;
  }
}

function hasOpenDriverRide(db: Db, sessionId: string) {
  return Boolean(
    db
      .prepare(
        "SELECT 1 FROM rides WHERE driver_session_id = ? AND status IN ('PUBLISHED', 'REQUESTED', 'ACCEPTED', 'RIDE_ACTIVE', 'CO_RIDE_ACTIVE') LIMIT 1",
      )
      .get(sessionId),
  );
}
function hasOpenRiderRequest(db: Db, sessionId: string) {
  return Boolean(
    db
      .prepare(
        "SELECT 1 FROM ride_requests q JOIN rides r ON r.id = q.ride_id WHERE q.rider_session_id = ? AND q.status IN ('PENDING', 'ACCEPTED') AND r.status IN ('PUBLISHED', 'REQUESTED', 'ACCEPTED', 'RIDE_ACTIVE', 'CO_RIDE_ACTIVE') LIMIT 1",
      )
      .get(sessionId),
  );
}

function metersBetween(a: Pin, b: Pin) {
  const radius = 6_371_000;
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLng = (b.longitude - a.longitude) * radians;
  const q =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * radians) *
      Math.cos(b.latitude * radians) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(q));
}
function distanceToSegmentMeters(point: Pin, start: Pin, end: Pin) {
  const latitudeScale = 111_320;
  const longitudeScale =
    latitudeScale *
    Math.cos(
      (((start.latitude + end.latitude + point.latitude) / 3) * Math.PI) / 180,
    );
  const x = (end.longitude - start.longitude) * longitudeScale;
  const y = (end.latitude - start.latitude) * latitudeScale;
  const px = (point.longitude - start.longitude) * longitudeScale;
  const py = (point.latitude - start.latitude) * latitudeScale;
  const lengthSquared = x * x + y * y;
  if (lengthSquared < 1) return metersBetween(point, start);
  const t = Math.max(0, Math.min(1, (px * x + py * y) / lengthSquared));
  return Math.hypot(px - t * x, py - t * y);
}
function interpolate(start: Pin, end: Pin, fraction: number): Pin {
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * fraction,
    longitude: start.longitude + (end.longitude - start.longitude) * fraction,
  };
}
function redactedCorridor(origin: Pin, destination: Pin): [Pin, Pin] {
  const distance = metersBetween(origin, destination);
  if (distance <= 1_000)
    return [
      interpolate(origin, destination, 0.25),
      interpolate(origin, destination, 0.75),
    ];
  const inset = Math.min(0.45, 500 / distance);
  return [
    interpolate(origin, destination, inset),
    interpolate(origin, destination, 1 - inset),
  ];
}
function directionFit(row: RideRow, input: SearchInput) {
  const origin = {
    latitude: row.origin_latitude,
    longitude: row.origin_longitude,
  };
  const destination = {
    latitude: row.destination_latitude,
    longitude: row.destination_longitude,
  };
  const pickupDistanceMeters = distanceToSegmentMeters(
    input.pickup,
    origin,
    destination,
  );
  const destinationDistanceMeters = distanceToSegmentMeters(
    input.destination,
    origin,
    destination,
  );
  const scheduled = validDate(row.scheduled_departure_at).getTime();
  const requested = validDate(input.requestedDepartureAt).getTime();
  const timingCompatible =
    requested >= scheduled && requested - scheduled <= 2 * 60 * 60 * 1000;
  return {
    pickupDistanceMeters,
    destinationDistanceMeters,
    fit:
      pickupDistanceMeters <= 1_500 &&
      destinationDistanceMeters <= 2_500 &&
      timingCompatible
        ? ("GOOD" as const)
        : ("POOR" as const),
    timingCompatible,
  };
}

function encryptionKey() {
  const configured = process.env.COCOWHEELS_CODE_ENCRYPTION_KEY;
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) return decoded;
    throw new Error("INVALID_CODE_ENCRYPTION_KEY");
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("COCOWHEELS_CODE_ENCRYPTION_KEY_REQUIRED");
  return createHash("sha256")
    .update("cocowheels-development-code-key")
    .digest();
}
function encryptCode(code: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(code, "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
function decryptCode(payload: string) {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = payload.split(".");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded)
    throw new Error("CODE_UNAVAILABLE");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function expireStaleRides(db: Db, now = new Date()) {
  const staleScheduled = iso(new Date(now.getTime() - OFFER_STALE_MS));
  const staleActive = iso(new Date(now.getTime() - ACTIVE_STALE_MS));
  const scheduled = db
    .prepare(
      "UPDATE rides SET status = 'EXPIRED', expired_at = ?, last_activity_at = ? WHERE status IN ('PUBLISHED', 'REQUESTED') AND ((offer_expires_at IS NOT NULL AND offer_expires_at < ?) OR (offer_expires_at IS NULL AND scheduled_departure_at < ?))",
    )
    .run(iso(now), iso(now), iso(now), staleScheduled).changes;
  const active = db
    .prepare(
      "UPDATE rides SET status = 'EXPIRED', expired_at = ?, last_activity_at = ? WHERE status IN ('ACCEPTED', 'RIDE_ACTIVE', 'CO_RIDE_ACTIVE') AND last_activity_at < ?",
    )
    .run(iso(now), iso(now), staleActive).changes;
  if (scheduled || active)
    db.prepare(
      "DELETE FROM live_locations WHERE ride_id IN (SELECT id FROM rides WHERE status = 'EXPIRED')",
    ).run();
  return scheduled + active;
}

const sampleRides = [
  {
    key: "town-hall-south-coogee",
    origin: {
      latitude: -33.8732,
      longitude: 151.2065,
      label: "Sydney Town Hall",
    },
    destination: {
      latitude: -33.9315,
      longitude: 151.2552,
      label: "South Coogee",
    },
    priceAud: 12,
  },
  {
    key: "airport-watsons-bay",
    origin: {
      latitude: -33.9399,
      longitude: 151.1753,
      label: "Sydney Airport",
    },
    destination: {
      latitude: -33.8434,
      longitude: 151.2829,
      label: "Watsons Bay",
    },
    priceAud: 18,
  },
  {
    key: "newtown-bondi-icebergs",
    origin: {
      latitude: -33.8981,
      longitude: 151.178,
      label: "Newtown",
    },
    destination: {
      latitude: -33.8915,
      longitude: 151.2767,
      label: "Bondi Icebergs",
    },
    priceAud: 14,
  },
] as const;

export function ensureSampleRides(db: Db, now = new Date()) {
  expireStaleRides(db, now);
  const timestamp = iso(now);
  const expiresAt = iso(new Date(now.getTime() + SAMPLE_OFFER_STALE_MS));
  const hasOpenSample = db.prepare(
    "SELECT 1 FROM rides WHERE sample_key = ? AND status IN ('PUBLISHED', 'REQUESTED') LIMIT 1",
  );
  const insertSession = db.prepare(
    "INSERT INTO guest_sessions (id, token_hash, anonymous_alias, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertRide = db.prepare(
    `INSERT INTO rides (id, public_id, status, driver_session_id, driver_alias, origin_latitude, origin_longitude, origin_label, destination_latitude, destination_longitude, destination_label, scheduled_departure_at, offer_expires_at, is_sample, sample_key, price_aud, created_at, last_activity_at)
     VALUES (?, ?, 'PUBLISHED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
  );
  let created = 0;
  db.transaction(() => {
    for (const sample of sampleRides) {
      if (hasOpenSample.get(sample.key)) continue;
      const sessionId = uuid();
      const rideId = uuid();
      const sampleAlias = alias(db);
      insertSession.run(
        sessionId,
        hash(opaqueToken()),
        sampleAlias,
        timestamp,
        timestamp,
        iso(new Date(now.getTime() + SESSION_TTL_MS)),
      );
      insertRide.run(
        rideId,
        publicId(db),
        sessionId,
        sampleAlias,
        sample.origin.latitude,
        sample.origin.longitude,
        sample.origin.label,
        sample.destination.latitude,
        sample.destination.longitude,
        sample.destination.label,
        timestamp,
        expiresAt,
        sample.key,
        sample.priceAud,
        timestamp,
        timestamp,
      );
      event(db, rideId, "RIDE_PUBLISHED", "SYSTEM", now);
      created += 1;
    }
  })();
  return created;
}

export function publishRide(
  db: Db,
  rawSessionToken: string | null,
  input: CreateRideInput,
  now = new Date(),
) {
  expireStaleRides(db, now);
  validPin(input.origin, "ORIGIN");
  validPin(input.destination, "DESTINATION");
  const departure = validDate(input.scheduledDepartureAt);
  if (
    departure.getTime() < now.getTime() - 5 * 60 * 1000 ||
    departure.getTime() > now.getTime() + 90 * 24 * 60 * 60 * 1000
  )
    throw new Error("INVALID_DEPARTURE_TIME");
  if (
    !Number.isInteger(input.priceAud) ||
    input.priceAud < 5 ||
    input.priceAud > 10_000
  )
    throw new Error("INVALID_FIXED_PRICE");
  const payId = cleanOptional(input.payId, 254, "INVALID_PAYID");
  const payIdType = payId
    ? (input.payIdType ?? (payId.includes("@") ? "EMAIL" : "OTHER"))
    : null;
  if (payIdType && !["MOBILE", "EMAIL", "OTHER"].includes(payIdType))
    throw new Error("INVALID_PAYID_TYPE");
  if (payId && payIdType && payIdInputError(input.payId ?? payId, payIdType))
    throw new Error("INVALID_PAYID");
  const existing = findSession(db, rawSessionToken, now);
  const created = existing ? null : createGuestSession(db, now);
  const session = existing ?? created!.session;
  if (hasOpenDriverRide(db, session.id)) throw new Error("OPEN_ITEM_EXISTS");
  if (hasOpenRiderRequest(db, session.id))
    throw new Error("ROLE_CHANGE_REQUIRES_TERMINATION");
  const rideId = uuid();
  const publicIdValue = publicId(db);
  const timestamp = iso(now);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO rides (id, public_id, status, driver_session_id, driver_alias, origin_latitude, origin_longitude, origin_label, destination_latitude, destination_longitude, destination_label, scheduled_departure_at, offer_expires_at, price_aud, driver_payid, driver_payid_type, created_at, last_activity_at)
      VALUES (?, ?, 'PUBLISHED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      rideId,
      publicIdValue,
      session.id,
      session.alias,
      input.origin.latitude,
      input.origin.longitude,
      cleanOptional(input.origin.label, 160, "INVALID_ORIGIN_LABEL") ??
        fallbackLocationLabel(input.origin),
      input.destination.latitude,
      input.destination.longitude,
      cleanOptional(
        input.destination.label,
        160,
        "INVALID_DESTINATION_LABEL",
      ) ?? fallbackLocationLabel(input.destination),
      departure.toISOString(),
      iso(new Date(now.getTime() + OFFER_STALE_MS)),
      input.priceAud,
      payId,
      payIdType,
      timestamp,
      timestamp,
    );
    event(db, rideId, "RIDE_PUBLISHED", "DRIVER", now);
  })();
  return {
    sessionToken: created?.token ?? null,
    ride: getRide(db, publicIdValue, session, now),
  };
}

export function searchRides(
  db: Db,
  input: SearchInput,
  now = new Date(),
  rawSessionToken: string | null = null,
): Candidate[] {
  expireStaleRides(db, now);
  validPin(input.pickup, "PICKUP");
  validPin(input.destination, "DESTINATION");
  const requested = validDate(input.requestedDepartureAt);
  if (
    requested.getTime() < now.getTime() - 5 * 60 * 1000 ||
    requested.getTime() > now.getTime() + 90 * 24 * 60 * 60 * 1000
  )
    throw new Error("INVALID_REQUEST_TIME");
  const rows = db
    .prepare(
      "SELECT * FROM rides WHERE status IN ('PUBLISHED', 'REQUESTED') AND scheduled_departure_at <= ? ORDER BY scheduled_departure_at ASC LIMIT 50",
    )
    .all(iso(new Date(requested.getTime() + 1))) as RideRow[];
  const session = rawSessionToken
    ? findSession(db, rawSessionToken, now)
    : null;
  return rows
    .map((row) => {
      const fit = directionFit(row, input);
      const corridor = redactedCorridor(
        { latitude: row.origin_latitude, longitude: row.origin_longitude },
        {
          latitude: row.destination_latitude,
          longitude: row.destination_longitude,
        },
      );
      return {
        rideId: row.public_id,
        driverLocation: locationFor(db, row.id, "DRIVER", now),
        driverAlias: row.driver_alias,
        priceAud: row.price_aud,
        scheduledDepartureAt: row.scheduled_departure_at,
        expiresAt: rideOfferExpiryAt(row),
        directionFit: fit.fit,
        redactedCorridor: corridor,
        pickupDistanceMeters: Math.round(fit.pickupDistanceMeters),
        destinationDistanceMeters: Math.round(fit.destinationDistanceMeters),
        isOwnOffer: row.driver_session_id === session?.id,
        departureLabel:
          row.origin_label ??
          fallbackLocationLabel({
            latitude: row.origin_latitude,
            longitude: row.origin_longitude,
          }),
        destinationLabel:
          row.destination_label ??
          fallbackLocationLabel({
            latitude: row.destination_latitude,
            longitude: row.destination_longitude,
          }),
      };
    })
    .sort(
      (a, b) =>
        Number(b.directionFit === "GOOD") - Number(a.directionFit === "GOOD") ||
        a.pickupDistanceMeters - b.pickupDistanceMeters ||
        a.priceAud - b.priceAud,
    );
}

export function availableRides(
  db: Db,
  now = new Date(),
  rawSessionToken: string | null = null,
): AvailabilityOffer[] {
  expireStaleRides(db, now);
  const session = rawSessionToken
    ? findSession(db, rawSessionToken, now)
    : null;
  return (
    db
      .prepare(
        "SELECT public_id, driver_session_id, driver_alias, price_aud, scheduled_departure_at, offer_expires_at, origin_latitude, origin_longitude, origin_label, destination_latitude, destination_longitude, destination_label, status FROM rides WHERE status IN ('PUBLISHED', 'REQUESTED') ORDER BY scheduled_departure_at ASC LIMIT 20",
      )
      .all() as Array<{
      public_id: string;
      driver_session_id: string;
      driver_alias: string;
      price_aud: number;
      scheduled_departure_at: string;
      offer_expires_at: string | null;
      origin_latitude: number;
      origin_longitude: number;
      origin_label: string | null;
      destination_latitude: number;
      destination_longitude: number;
      destination_label: string | null;
      status: "PUBLISHED" | "REQUESTED";
    }>
  ).map((ride) => ({
    rideId: ride.public_id,
    driverAlias: ride.driver_alias,
    priceAud: ride.price_aud,
    scheduledDepartureAt: ride.scheduled_departure_at,
    expiresAt: rideOfferExpiryAt(ride),
    departureLabel:
      ride.origin_label ??
      fallbackLocationLabel({
        latitude: ride.origin_latitude,
        longitude: ride.origin_longitude,
      }),
    destinationLabel:
      ride.destination_label ??
      fallbackLocationLabel({
        latitude: ride.destination_latitude,
        longitude: ride.destination_longitude,
      }),
    status: ride.status,
    isOwnOffer: ride.driver_session_id === session?.id,
  }));
}

export function publicRidePreview(
  db: Db,
  rideId: string,
  now = new Date(),
): PublicRidePreview {
  expireStaleRides(db, now);
  const ride = rideRow(db, rideId);
  if (!ride) throw new Error("RIDE_UNAVAILABLE");
  const status = ride.status;
  if (status !== "PUBLISHED" && status !== "REQUESTED")
    throw new Error("RIDE_UNAVAILABLE");
  const origin = {
    latitude: ride.origin_latitude,
    longitude: ride.origin_longitude,
  };
  const destination = {
    latitude: ride.destination_latitude,
    longitude: ride.destination_longitude,
  };
  return {
    rideId: ride.public_id,
    driverAlias: ride.driver_alias,
    priceAud: ride.price_aud,
    scheduledDepartureAt: ride.scheduled_departure_at,
    expiresAt: rideOfferExpiryAt(ride),
    status,
    departureLabel: ride.origin_label ?? fallbackLocationLabel(origin),
    destinationLabel:
      ride.destination_label ?? fallbackLocationLabel(destination),
    plannedRoute: { origin, destination },
    driverLocation: locationFor(db, ride.id, "DRIVER", now),
  };
}

export function requestRide(
  db: Db,
  rawSessionToken: string | null,
  rideId: string,
  input: SearchInput,
  now = new Date(),
) {
  expireStaleRides(db, now);
  validPin(input.pickup, "PICKUP");
  validPin(input.destination, "DESTINATION");
  const requestedAt = validDate(input.requestedDepartureAt);
  const ride = rideRow(db, rideId);
  if (!ride || !["PUBLISHED", "REQUESTED"].includes(ride.status))
    throw new Error("RIDE_UNAVAILABLE");
  const fit = directionFit(ride, input);
  if (!fit.timingCompatible) throw new Error("REQUEST_TIME_INCOMPATIBLE");
  const existing = findSession(db, rawSessionToken, now);
  const created = existing ? null : createGuestSession(db, now);
  const session = existing ?? created!.session;
  if (session.id === ride.driver_session_id)
    throw new Error("OWN_RIDE_JOIN_NOT_ALLOWED");
  if (hasOpenDriverRide(db, session.id))
    throw new Error("ROLE_CHANGE_REQUIRES_TERMINATION");
  if (hasOpenRiderRequest(db, session.id)) throw new Error("OPEN_ITEM_EXISTS");
  const requestId = uuid();
  const timestamp = iso(now);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO ride_requests (id, ride_id, rider_session_id, rider_alias, pickup_latitude, pickup_longitude, pickup_label, destination_latitude, destination_longitude, destination_label, requested_departure_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    ).run(
      requestId,
      ride.id,
      session.id,
      session.alias,
      input.pickup.latitude,
      input.pickup.longitude,
      cleanOptional(input.pickup.label, 160, "INVALID_PICKUP_LABEL"),
      input.destination.latitude,
      input.destination.longitude,
      cleanOptional(input.destination.label, 160, "INVALID_DESTINATION_LABEL"),
      requestedAt.toISOString(),
      timestamp,
    );
    db.prepare(
      "UPDATE rides SET status = 'REQUESTED', last_activity_at = ? WHERE id = ? AND status = 'PUBLISHED'",
    ).run(timestamp, ride.id);
    event(db, ride.id, "RIDER_REQUESTED", "RIDER", now);
  })();
  return {
    sessionToken: created?.token ?? null,
    ride: getRide(db, rideId, session, now),
  };
}

function requireDriver(row: RideRow, session: Session) {
  if (row.driver_session_id !== session.id)
    throw new Error("RIDE_ACCESS_DENIED");
}
function requireRider(db: Db, row: RideRow, session: Session) {
  const request = requestForSession(db, row.id, session.id);
  if (!request) throw new Error("RIDE_ACCESS_DENIED");
  return request;
}
function requestFitForRide(row: RideRow, request: RequestRow) {
  return directionFit(row, {
    pickup: {
      latitude: request.pickup_latitude,
      longitude: request.pickup_longitude,
    },
    destination: {
      latitude: request.destination_latitude,
      longitude: request.destination_longitude,
    },
    requestedDepartureAt: request.requested_departure_at,
  }).fit;
}

export function decideRequest(
  db: Db,
  rawSessionToken: string | null,
  rideId: string,
  requestId: string,
  decision: "ACCEPT" | "DECLINE",
  now = new Date(),
) {
  expireStaleRides(db, now);
  const session = requireSession(db, rawSessionToken, now);
  const ride = rideRow(db, rideId);
  if (!ride) throw new Error("RIDE_NOT_FOUND");
  requireDriver(ride, session);
  const request = requestRow(db, requestId);
  if (!request || request.ride_id !== ride.id || request.status !== "PENDING")
    throw new Error("REQUEST_UNAVAILABLE");
  const timestamp = iso(now);
  if (decision === "DECLINE") {
    db.transaction(() => {
      db.prepare(
        "UPDATE ride_requests SET status = 'DECLINED', decided_at = ? WHERE id = ?",
      ).run(timestamp, request.id);
      const remaining = db
        .prepare(
          "SELECT 1 FROM ride_requests WHERE ride_id = ? AND status = 'PENDING' LIMIT 1",
        )
        .get(ride.id);
      if (!remaining)
        db.prepare(
          "UPDATE rides SET status = 'PUBLISHED', last_activity_at = ? WHERE id = ? AND status = 'REQUESTED'",
        ).run(timestamp, ride.id);
      event(db, ride.id, "RIDER_DECLINED", "DRIVER", now);
    })();
  } else {
    if (!["PUBLISHED", "REQUESTED"].includes(ride.status))
      throw new Error("RIDE_UNAVAILABLE");
    db.transaction(() => {
      db.prepare(
        "UPDATE ride_requests SET status = 'ACCEPTED', decided_at = ? WHERE id = ? AND status = 'PENDING'",
      ).run(timestamp, request.id);
      db.prepare(
        "UPDATE ride_requests SET status = 'DISCARDED', decided_at = ? WHERE ride_id = ? AND id <> ? AND status = 'PENDING'",
      ).run(timestamp, ride.id, request.id);
      db.prepare(
        "UPDATE rides SET status = 'ACCEPTED', accepted_request_id = ?, accepted_at = ?, last_activity_at = ? WHERE id = ?",
      ).run(request.id, timestamp, timestamp, ride.id);
      event(db, ride.id, "RIDER_ACCEPTED", "DRIVER", now);
    })();
  }
  return getRide(db, rideId, session, now);
}

function locationFor(
  db: Db,
  rideId: string,
  participant: Participant,
  now: Date,
): PublicLocation | undefined {
  const row = db
    .prepare(
      "SELECT participant, latitude, longitude, accuracy_meters, captured_at, received_at, moving FROM live_locations WHERE ride_id = ? AND participant = ?",
    )
    .get(rideId, participant) as LocationRow | undefined;
  if (!row) return undefined;
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyMeters: row.accuracy_meters,
    capturedAt: row.captured_at,
    moving: Boolean(row.moving),
    stale:
      now.getTime() - new Date(row.captured_at).getTime() >
      (row.moving ? 30_000 : 60_000),
  };
}
function isAcceptedRider(db: Db, row: RideRow, session: Session) {
  const request = acceptedRequest(db, row);
  return Boolean(request && request.rider_session_id === session.id);
}

export function submitLocation(
  db: Db,
  rawSessionToken: string | null,
  rideId: string,
  location: {
    moving?: boolean;
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    capturedAt: string;
  },
  now = new Date(),
) {
  expireStaleRides(db, now);
  const session = requireSession(db, rawSessionToken, now);
  const ride = rideRow(db, rideId);
  if (
    !ride ||
    ![
      "PUBLISHED",
      "REQUESTED",
      "ACCEPTED",
      "RIDE_ACTIVE",
      "CO_RIDE_ACTIVE",
    ].includes(ride.status)
  )
    throw new Error("LOCATION_NOT_ALLOWED");
  const participant: Participant =
    ride.driver_session_id === session.id
      ? "DRIVER"
      : ["ACCEPTED", "RIDE_ACTIVE", "CO_RIDE_ACTIVE"].includes(ride.status) &&
          isAcceptedRider(db, ride, session)
        ? "RIDER"
        : (() => {
            throw new Error("RIDE_ACCESS_DENIED");
          })();
  validPin(
    { latitude: location.latitude, longitude: location.longitude },
    "LOCATION",
  );
  const captured = validDate(location.capturedAt, "INVALID_LOCATION_TIME");
  if (
    !Number.isFinite(location.accuracyMeters) ||
    location.accuracyMeters < 0 ||
    location.accuracyMeters > 100
  )
    throw new Error("LOCATION_ACCURACY_REJECTED");
  if (Math.abs(now.getTime() - captured.getTime()) > LOCATION_FRESH_MS)
    throw new Error("LOCATION_STALE");
  db.transaction(() => {
    const previous = locationFor(db, ride.id, participant, now);
    if (
      previous &&
      new Date(previous.capturedAt).getTime() >= captured.getTime()
    )
      return;
    db.prepare(
      `INSERT INTO live_locations (ride_id, participant, latitude, longitude, accuracy_meters, captured_at, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ride_id, participant) DO UPDATE SET latitude = excluded.latitude, longitude = excluded.longitude, accuracy_meters = excluded.accuracy_meters, captured_at = excluded.captured_at, received_at = excluded.received_at`,
    ).run(
      ride.id,
      participant,
      location.latitude,
      location.longitude,
      location.accuracyMeters,
      captured.toISOString(),
      iso(now),
    );
    db.prepare(
      "UPDATE live_locations SET moving = ? WHERE ride_id = ? AND participant = ?",
    ).run(location.moving === true ? 1 : 0, ride.id, participant);
    db.prepare("UPDATE rides SET last_activity_at = ? WHERE id = ?").run(
      iso(now),
      ride.id,
    );
  })();
  return getRide(db, rideId, session, now);
}

function freshLocation(
  db: Db,
  rideId: string,
  participant: Participant,
  now: Date,
) {
  const row = db
    .prepare(
      "SELECT received_at FROM live_locations WHERE ride_id = ? AND participant = ?",
    )
    .get(rideId, participant) as { received_at: string } | undefined;
  return Boolean(
    row &&
    now.getTime() - new Date(row.received_at).getTime() <= LOCATION_FRESH_MS,
  );
}

export function beginRide(
  db: Db,
  rawSessionToken: string | null,
  rideId: string,
  now = new Date(),
) {
  const session = requireSession(db, rawSessionToken, now);
  const ride = rideRow(db, rideId);
  if (!ride) throw new Error("RIDE_NOT_FOUND");
  requireDriver(ride, session);
  if (ride.status !== "ACCEPTED") throw new Error("RIDE_CANNOT_BEGIN");
  if (
    !freshLocation(db, ride.id, "DRIVER", now) ||
    !freshLocation(db, ride.id, "RIDER", now)
  )
    throw new Error("FRESH_LOCATIONS_REQUIRED");
  const code = randomInt(1000, 10_000).toString();
  const timestamp = iso(now);
  db.transaction(() => {
    db.prepare(
      "UPDATE rides SET status = 'RIDE_ACTIVE', ride_started_at = ?, co_ride_code_hash = ?, co_ride_code_ciphertext = ?, co_ride_code_expires_at = ?, co_ride_code_attempts = 0, co_ride_code_last_attempt_at = NULL, last_activity_at = ? WHERE id = ?",
    ).run(
      timestamp,
      hash(code),
      encryptCode(code),
      iso(new Date(now.getTime() + CODE_TTL_MS)),
      timestamp,
      ride.id,
    );
    event(db, ride.id, "RIDE_BEGUN", "DRIVER", now);
  })();
  return getRide(db, rideId, session, now);
}

export function confirmCoRideCode(
  db: Db,
  rawSessionToken: string | null,
  rideId: string,
  code: string,
  now = new Date(),
) {
  const session = requireSession(db, rawSessionToken, now);
  const ride = rideRow(db, rideId);
  if (!ride) throw new Error("RIDE_NOT_FOUND");
  requireDriver(ride, session);
  if (
    ride.status !== "RIDE_ACTIVE" ||
    !ride.co_ride_code_hash ||
    !ride.co_ride_code_expires_at ||
    new Date(ride.co_ride_code_expires_at).getTime() <= now.getTime()
  )
    throw new Error("CO_RIDE_CODE_EXPIRED");
  if (!/^\d{4}$/.test(code)) throw new Error("CO_RIDE_CODE_INVALID");
  if (ride.co_ride_code_attempts >= MAX_CODE_ATTEMPTS)
    throw new Error("CO_RIDE_CODE_LOCKED");
  if (
    ride.co_ride_code_last_attempt_at &&
    now.getTime() - new Date(ride.co_ride_code_last_attempt_at).getTime() <
      CODE_ATTEMPT_INTERVAL_MS
  )
    throw new Error("CO_RIDE_CODE_RATE_LIMITED");
  if (!sameSecret(code, ride.co_ride_code_hash)) {
    db.prepare(
      "UPDATE rides SET co_ride_code_attempts = co_ride_code_attempts + 1, co_ride_code_last_attempt_at = ? WHERE id = ?",
    ).run(iso(now), ride.id);
    throw new Error("CO_RIDE_CODE_INVALID");
  }
  db.transaction(() => {
    db.prepare(
      "UPDATE rides SET status = 'CO_RIDE_ACTIVE', co_ride_started_at = ?, co_ride_code_ciphertext = NULL, co_ride_code_expires_at = NULL, last_activity_at = ? WHERE id = ?",
    ).run(iso(now), iso(now), ride.id);
    event(db, ride.id, "CO_RIDE_BEGUN", "DRIVER", now);
  })();
  return getRide(db, rideId, session, now);
}

export function cancelRide(
  db: Db,
  rawSessionToken: string | null,
  rideId: string,
  now = new Date(),
) {
  const session = requireSession(db, rawSessionToken, now);
  const ride = rideRow(db, rideId);
  if (!ride) throw new Error("RIDE_NOT_FOUND");
  const driver = ride.driver_session_id === session.id;
  const rider = isAcceptedRider(db, ride, session);
  if (!driver && !rider) throw new Error("RIDE_ACCESS_DENIED");
  if (terminal(ride.status) || ride.status === "CO_RIDE_ACTIVE")
    throw new Error("CANCELLATION_NOT_ALLOWED");
  const actor: Participant = driver ? "DRIVER" : "RIDER";
  db.transaction(() => {
    db.prepare(
      "UPDATE rides SET status = 'CANCELLED', cancelled_at = ?, cancellation_reason = ?, last_activity_at = ? WHERE id = ?",
    ).run(iso(now), `${actor}_CANCELLED`, iso(now), ride.id);
    db.prepare(
      "UPDATE ride_requests SET status = 'CANCELLED', decided_at = ? WHERE id = ? AND status = 'ACCEPTED'",
    ).run(iso(now), ride.accepted_request_id);
    db.prepare(
      "UPDATE ride_requests SET status = 'DISCARDED', decided_at = ? WHERE ride_id = ? AND status = 'PENDING'",
    ).run(iso(now), ride.id);
    db.prepare("DELETE FROM live_locations WHERE ride_id = ?").run(ride.id);
    event(db, ride.id, "RIDE_CANCELLED", actor, now);
  })();
  return getRide(db, rideId, session, now);
}

export function cancelPendingRequest(
  db: Db,
  rawSessionToken: string | null,
  rideId: string,
  now = new Date(),
) {
  const session = requireSession(db, rawSessionToken, now);
  const ride = rideRow(db, rideId);
  if (!ride) throw new Error("RIDE_NOT_FOUND");
  const request = requireRider(db, ride, session);
  if (request.status !== "PENDING")
    throw new Error("REQUEST_CANCELLATION_NOT_ALLOWED");
  db.transaction(() => {
    db.prepare(
      "UPDATE ride_requests SET status = 'CANCELLED', decided_at = ? WHERE id = ?",
    ).run(iso(now), request.id);
    const remaining = db
      .prepare(
        "SELECT 1 FROM ride_requests WHERE ride_id = ? AND status = 'PENDING' LIMIT 1",
      )
      .get(ride.id);
    if (!remaining)
      db.prepare(
        "UPDATE rides SET status = 'PUBLISHED', last_activity_at = ? WHERE id = ? AND status = 'REQUESTED'",
      ).run(iso(now), ride.id);
    event(db, ride.id, "REQUEST_CANCELLED", "RIDER", now);
  })();
  return getRide(db, rideId, session, now);
}

export function completeCoRide(
  db: Db,
  rawSessionToken: string | null,
  rideId: string,
  method: "PAYID" | "CASH",
  now = new Date(),
) {
  const session = requireSession(db, rawSessionToken, now);
  const ride = rideRow(db, rideId);
  if (!ride) throw new Error("RIDE_NOT_FOUND");
  if (!isAcceptedRider(db, ride, session))
    throw new Error("RIDE_ACCESS_DENIED");
  if (ride.status !== "CO_RIDE_ACTIVE") throw new Error("CO_RIDE_NOT_ACTIVE");
  if (method !== "PAYID" && method !== "CASH")
    throw new Error("INVALID_PAYMENT_HANDOFF");
  if (method === "PAYID" && !ride.driver_payid)
    throw new Error("PAYID_UNAVAILABLE");
  db.transaction(() => {
    db.prepare(
      "UPDATE rides SET status = 'COMPLETED', completed_at = ?, payment_handoff_method = ?, last_activity_at = ? WHERE id = ?",
    ).run(iso(now), method, iso(now), ride.id);
    db.prepare("DELETE FROM live_locations WHERE ride_id = ?").run(ride.id);
    event(db, ride.id, "CO_RIDE_COMPLETED", "RIDER", now);
  })();
  return getRide(db, rideId, session, now);
}

function riderRequestView(
  ride: RideRow,
  request: RequestRow,
): RiderRequestView {
  return {
    requestId: request.id,
    riderAlias: request.rider_alias,
    status: request.status,
    pickup: {
      latitude: request.pickup_latitude,
      longitude: request.pickup_longitude,
      label: request.pickup_label ?? undefined,
    },
    destination: {
      latitude: request.destination_latitude,
      longitude: request.destination_longitude,
      label: request.destination_label ?? undefined,
    },
    createdAt: request.created_at,
    requestedDepartureAt: request.requested_departure_at,
    directionFit: requestFitForRide(ride, request),
    decidedAt: request.decided_at,
  };
}
function driverView(db: Db, row: RideRow, now: Date): RideView {
  const selected = acceptedRequest(db, row);
  const requests = db
    .prepare(
      "SELECT * FROM ride_requests WHERE ride_id = ? AND status IN ('PENDING', 'ACCEPTED') ORDER BY created_at ASC",
    )
    .all(row.id) as RequestRow[];
  return {
    rideId: row.public_id,
    driverLocation: terminal(row.status)
      ? undefined
      : locationFor(db, row.id, "DRIVER", now),
    status: row.status,
    driverAlias: row.driver_alias,
    priceAud: row.price_aud,
    scheduledDepartureAt: row.scheduled_departure_at,
    expiresAt: rideOfferExpiryAt(row),
    acceptedAt: row.accepted_at,
    plannedRoute: {
      origin: {
        latitude: row.origin_latitude,
        longitude: row.origin_longitude,
        label: row.origin_label ?? undefined,
      },
      destination: {
        latitude: row.destination_latitude,
        longitude: row.destination_longitude,
        label: row.destination_label ?? undefined,
      },
    },
    rider: selected
      ? {
          alias: selected.rider_alias,
          pickup: {
            latitude: selected.pickup_latitude,
            longitude: selected.pickup_longitude,
            label: selected.pickup_label ?? undefined,
          },
          destination: {
            latitude: selected.destination_latitude,
            longitude: selected.destination_longitude,
            label: selected.destination_label ?? undefined,
          },
          requestedDepartureAt: selected.requested_departure_at,
          directionFit: requestFitForRide(row, selected),
        }
      : undefined,
    requests: requests.map((request) => ({
      requestId: request.id,
      riderAlias: request.rider_alias,
      pickup: {
        latitude: request.pickup_latitude,
        longitude: request.pickup_longitude,
        label: request.pickup_label ?? undefined,
      },
      destination: {
        latitude: request.destination_latitude,
        longitude: request.destination_longitude,
        label: request.destination_label ?? undefined,
      },
      createdAt: request.created_at,
      requestedDepartureAt: request.requested_departure_at,
      directionFit: requestFitForRide(row, request),
      status: request.status,
    })),
    riderLocation: ["ACCEPTED", "RIDE_ACTIVE", "CO_RIDE_ACTIVE"].includes(
      row.status,
    )
      ? locationFor(db, row.id, "RIDER", now)
      : undefined,
    paymentHandoffMethod: row.payment_handoff_method,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    expiredAt: row.expired_at,
    cancellationReason: row.cancellation_reason,
    payId: row.driver_payid,
    payIdType: row.driver_payid_type,
  };
}
function riderView(
  db: Db,
  row: RideRow,
  request: RequestRow,
  now: Date,
): RideView {
  const canSeePartner =
    request.status === "ACCEPTED" &&
    ["ACCEPTED", "RIDE_ACTIVE", "CO_RIDE_ACTIVE", "COMPLETED"].includes(
      row.status,
    );
  const code =
    row.status === "RIDE_ACTIVE" &&
    row.co_ride_code_ciphertext &&
    row.co_ride_code_expires_at &&
    new Date(row.co_ride_code_expires_at).getTime() > now.getTime()
      ? decryptCode(row.co_ride_code_ciphertext)
      : undefined;
  return {
    rideId: row.public_id,
    status: row.status,
    driverAlias: row.driver_alias,
    priceAud: row.price_aud,
    scheduledDepartureAt: row.scheduled_departure_at,
    expiresAt: rideOfferExpiryAt(row),
    acceptedAt: row.accepted_at,
    request: riderRequestView(row, request),
    driverLocation:
      ["PUBLISHED", "REQUESTED"].includes(row.status) ||
      (canSeePartner && !terminal(row.status))
        ? locationFor(db, row.id, "DRIVER", now)
        : undefined,
    riderLocation: canSeePartner
      ? locationFor(db, row.id, "RIDER", now)
      : undefined,
    coRideCode: code,
    payId: canSeePartner ? row.driver_payid : undefined,
    payIdType: canSeePartner ? row.driver_payid_type : undefined,
    paymentHandoffMethod: row.payment_handoff_method,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    expiredAt: row.expired_at,
    cancellationReason: row.cancellation_reason,
  };
}

export function getRide(
  db: Db,
  rideId: string,
  session: Session,
  now = new Date(),
  requestId?: string,
): RideView {
  expireStaleRides(db, now);
  const row = rideRow(db, rideId);
  if (!row) throw new Error("RIDE_NOT_FOUND");
  if (row.driver_session_id === session.id) return driverView(db, row, now);
  const request = requestForSession(db, row.id, session.id, requestId);
  if (!request) throw new Error("RIDE_ACCESS_DENIED");
  return riderView(db, row, request, now);
}

export function privateHistory(
  db: Db,
  rawSessionToken: string | null,
  now = new Date(),
) {
  const session = requireSession(db, rawSessionToken, now);
  expireStaleRides(db, now);
  const driverRows = db
    .prepare(
      "SELECT public_id FROM rides WHERE driver_session_id = ? AND status IN ('COMPLETED', 'CANCELLED', 'EXPIRED') ORDER BY COALESCE(completed_at, cancelled_at, expired_at) DESC",
    )
    .all(session.id) as Array<{ public_id: string }>;
  const riderRows = db
    .prepare(
      `SELECT r.public_id, q.id AS request_id
       FROM rides r
       JOIN ride_requests q ON q.ride_id = r.id
       WHERE q.rider_session_id = ?
         AND (
           (q.status = 'ACCEPTED' AND r.status = 'COMPLETED')
           OR q.status IN ('CANCELLED', 'DECLINED', 'DISCARDED')
           OR r.status = 'EXPIRED'
         )
       ORDER BY COALESCE(q.decided_at, r.completed_at, r.cancelled_at, r.expired_at, q.created_at) DESC`,
    )
    .all(session.id) as Array<{ public_id: string; request_id: string }>;
  return {
    driver: driverRows.map((row) => getRide(db, row.public_id, session, now)),
    rider: riderRows.map((row) =>
      getRide(db, row.public_id, session, now, row.request_id),
    ),
  };
}

export function currentOpenRide(
  db: Db,
  rawSessionToken: string | null,
  now = new Date(),
) {
  return currentOpenRides(db, rawSessionToken, now)[0] ?? null;
}

export function currentOpenRides(
  db: Db,
  rawSessionToken: string | null,
  now = new Date(),
) {
  const session = requireSession(db, rawSessionToken, now);
  expireStaleRides(db, now);
  const driver = db
    .prepare(
      "SELECT public_id FROM rides WHERE driver_session_id = ? AND status IN ('PUBLISHED', 'REQUESTED', 'ACCEPTED', 'RIDE_ACTIVE', 'CO_RIDE_ACTIVE') ORDER BY created_at DESC LIMIT 1",
    )
    .get(session.id) as { public_id: string } | undefined;
  const current = [] as Array<{ role: Participant; ride: RideView }>;
  if (driver)
    current.push({
      role: "DRIVER",
      ride: getRide(db, driver.public_id, session, now),
    });
  const rider = db
    .prepare(
      "SELECT r.public_id, q.id AS request_id FROM ride_requests q JOIN rides r ON r.id = q.ride_id WHERE q.rider_session_id = ? AND q.status IN ('PENDING', 'ACCEPTED') AND r.status IN ('PUBLISHED', 'REQUESTED', 'ACCEPTED', 'RIDE_ACTIVE', 'CO_RIDE_ACTIVE') ORDER BY q.created_at DESC LIMIT 1",
    )
    .get(session.id) as { public_id: string; request_id: string } | undefined;
  if (rider)
    current.push({
      role: "RIDER",
      ride: getRide(db, rider.public_id, session, now, rider.request_id),
    });
  return current;
}
