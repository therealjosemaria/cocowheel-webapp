import type { Db } from './core';
import { vehicleArtwork } from '../lib/vehicle-catalogue';
import { presenceCell, PRESENCE_LIMIT_PER_ROLE, PRESENCE_MAX_ICONS, PRESENCE_MAX_PER_AREA, type PresenceCell } from '../lib/home-presence';

// Separate public projection: never serialize IDs, names, labels, destinations,
// schedules, photos, saved routes or live-location records to Home.
export function homePresence(db: Db, now = new Date()): PresenceCell[] {
  const result: PresenceCell[] = [];
  const timestamp = now.toISOString();
  const sources = [
    ['driver', db.prepare(`SELECT origin_latitude AS latitude, origin_longitude AS longitude, v.body AS vehicle_body
      FROM rides LEFT JOIN account_vehicles v ON v.principal_id=rides.driver_session_id WHERE status IN ('PUBLISHED','REQUESTED') AND is_sample=0
      AND accepted_request_id IS NULL
      AND COALESCE(offer_expires_at, strftime('%Y-%m-%dT%H:%M:%fZ', scheduled_departure_at, '+6 hours')) > ?
      ORDER BY origin_latitude, origin_longitude`).iterate(timestamp)],
    ['rider', db.prepare(`SELECT json_extract(d.body,'$.origin.latitude') AS latitude,
      json_extract(d.body,'$.origin.longitude') AS longitude FROM rider_demands d
      WHERE d.status='OPEN' AND d.expires_at>?
      AND NOT EXISTS (SELECT 1 FROM rides r WHERE r.driver_session_id=d.owner_id
        AND r.status IN ('PUBLISHED','REQUESTED','ACCEPTED','RIDE_ACTIVE','CO_RIDE_ACTIVE'))
      AND NOT EXISTS (SELECT 1 FROM ride_requests q JOIN rides r ON r.id=q.ride_id
        WHERE q.rider_session_id=d.owner_id AND q.status='ACCEPTED'
        AND r.status IN ('ACCEPTED','RIDE_ACTIVE','CO_RIDE_ACTIVE'))
      ORDER BY latitude, longitude`).iterate(timestamp)],
  ] as const;
  for (const [role, rows] of sources) {
    const seen = new Map<string, PresenceCell>();
    for (const value of rows) {
      const row = value as { latitude: number; longitude: number; vehicle_body?: string };
      if (typeof row.latitude !== 'number' || typeof row.longitude !== 'number') continue;
      const cell = presenceCell(role, row.latitude, row.longitude);
      if (!cell) continue;
      const key = `${cell.latitude}:${cell.longitude}`;
      const existing = seen.get(key);
      let art: string | null = null;
      if (role === 'driver' && row.vehicle_body) {
        try { art = vehicleArtwork(JSON.parse(row.vehicle_body)) ?? null; } catch { /* Invalid legacy detail keeps generic art. */ }
      }
      if (existing) {
        if (existing.count < PRESENCE_MAX_PER_AREA) {
          existing.count++;
          existing.artworks?.push(art);
        }
        continue;
      }
      if (seen.size === PRESENCE_LIMIT_PER_ROLE) continue;
      seen.set(key, cell);
      if (role === 'driver') cell.artworks = [art];
      result.push(cell);
    }
  }
  const areas = new Map<string, PresenceCell[]>();
  for (const cell of result) {
    const key = `${cell.latitude}:${cell.longitude}`;
    areas.set(key, [...(areas.get(key) ?? []), cell]);
  }
  const bounded: PresenceCell[] = [];
  let remaining = PRESENCE_MAX_ICONS;
  const sorted = [...areas.values()].sort((a, b) => a[0].latitude - b[0].latitude || a[0].longitude - b[0].longitude);
  for (const area of sorted) {
    if (area.length === 2 && area[0].count + area[1].count > PRESENCE_MAX_PER_AREA) {
      // Preserve both roles; give the third icon to the more numerous role.
      area[0].count = area[0].count >= area[1].count ? 2 : 1;
      area[1].count = PRESENCE_MAX_PER_AREA - area[0].count;
    }
    for (const cell of area) {
      const count = Math.min(cell.count, remaining);
      const { artworks, ...area } = cell;
      const visibleArt = artworks?.slice(0, count);
      if (count) bounded.push({ ...area, count, ...(visibleArt?.some(Boolean)
        ? { artworks: visibleArt } : {}) });
      remaining -= count;
    }
    if (!remaining) break;
  }
  return bounded;
}
