PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guest_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  anonymous_alias TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS rides (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('PUBLISHED', 'REQUESTED', 'ACCEPTED', 'RIDE_ACTIVE', 'CO_RIDE_ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED')),
  driver_session_id TEXT NOT NULL REFERENCES guest_sessions(id),
  driver_alias TEXT NOT NULL,
  origin_latitude REAL NOT NULL,
  origin_longitude REAL NOT NULL,
  origin_label TEXT,
  destination_latitude REAL NOT NULL,
  destination_longitude REAL NOT NULL,
  destination_label TEXT,
  scheduled_departure_at TEXT NOT NULL,
  price_aud INTEGER NOT NULL CHECK (price_aud >= 5),
  driver_payid TEXT,
  driver_payid_type TEXT CHECK (driver_payid_type IN ('MOBILE', 'EMAIL', 'OTHER')),
  accepted_request_id TEXT UNIQUE,
  co_ride_code_hash TEXT,
  co_ride_code_ciphertext TEXT,
  co_ride_code_expires_at TEXT,
  co_ride_code_attempts INTEGER NOT NULL DEFAULT 0,
  co_ride_code_last_attempt_at TEXT,
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  ride_started_at TEXT,
  co_ride_started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  expired_at TEXT,
  cancellation_reason TEXT,
  payment_handoff_method TEXT CHECK (payment_handoff_method IN ('PAYID', 'CASH')),
  last_activity_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ride_requests (
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

CREATE INDEX IF NOT EXISTS rides_discovery_index ON rides(status, scheduled_departure_at);
CREATE INDEX IF NOT EXISTS ride_requests_rider_index ON ride_requests(rider_session_id, status);
CREATE INDEX IF NOT EXISTS ride_requests_ride_index ON ride_requests(ride_id, status);

-- External map-provider responses are reusable but temporary. These tables are
-- intentionally independent from a guest's ride history and clean themselves
-- after seven days.
CREATE TABLE IF NOT EXISTS place_lookup_cache (
  cache_key TEXT PRIMARY KEY,
  label TEXT,
  country_code TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS place_lookup_cache_expiry_index ON place_lookup_cache(expires_at);

CREATE TABLE IF NOT EXISTS route_preview_cache (
  cache_key TEXT PRIMARY KEY,
  points_json TEXT NOT NULL,
  distance_meters REAL,
  duration_seconds REAL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS route_preview_cache_expiry_index ON route_preview_cache(expires_at);

CREATE TABLE IF NOT EXISTS live_locations (
  ride_id TEXT NOT NULL REFERENCES rides(id),
  participant TEXT NOT NULL CHECK (participant IN ('DRIVER', 'RIDER')),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy_meters REAL NOT NULL,
  captured_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (ride_id, participant)
);

CREATE TABLE IF NOT EXISTS ride_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ride_id TEXT NOT NULL REFERENCES rides(id),
  event TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('DRIVER', 'RIDER', 'SYSTEM')),
  created_at TEXT NOT NULL
);
