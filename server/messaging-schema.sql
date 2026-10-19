-- Run after the legacy ride_requests compatibility migration, never before its rename.
-- Closed conversations remain stored but inaccessible through participant APIs.
CREATE TABLE IF NOT EXISTS ride_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL REFERENCES ride_requests(id),
  sender_id TEXT NOT NULL REFERENCES guest_sessions(id),
  client_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(request_id, sender_id, client_id)
);
CREATE INDEX IF NOT EXISTS ride_messages_thread ON ride_messages(request_id, id);
CREATE INDEX IF NOT EXISTS ride_messages_sender_time ON ride_messages(sender_id, created_at);
CREATE TABLE IF NOT EXISTS message_reads (
  request_id TEXT NOT NULL REFERENCES ride_requests(id),
  principal_id TEXT NOT NULL REFERENCES guest_sessions(id),
  last_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(request_id, principal_id)
);
CREATE TABLE IF NOT EXISTS message_stops (
  request_id TEXT PRIMARY KEY REFERENCES ride_requests(id),
  principal_id TEXT NOT NULL REFERENCES guest_sessions(id),
  created_at TEXT NOT NULL
);
