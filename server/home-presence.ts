import type { Db } from './core';
import { MAP_MARKER_POLICY } from '../lib/map-marker-budget';
import { vehicleArtwork } from '../lib/vehicle-catalogue';
import { presenceCell, PRESENCE_LIMIT_PER_ROLE, PRESENCE_MAX_ICONS, PRESENCE_MAX_PER_AREA, type PresenceCell, type PresenceBounds, type PresenceViewport, presenceViewport, inPresenceBounds } from '../lib/home-presence';

// Separate public projection: never serialize IDs, names, labels, destinations,
// schedules, source photos, saved routes or live-location records to Home.
// Enabled map-avatar renders are public by the account's explicit display choice.
export function homePresence(db: Db, now = new Date(), viewport?: PresenceViewport): PresenceCell[] {
  const view = viewport ? presenceViewport(viewport) : undefined;
  const result: PresenceCell[] = [];
  const timestamp = now.toISOString();
  const sources = presenceSources(db, timestamp, view);
  for (const [role, rows] of sources) {
    const seen = new Map<string, PresenceCell>();
    for (const value of rows) {
      const row = value as { latitude: number; longitude: number; vehicle_body?: string; avatar_asset?: string };
      if (typeof row.latitude !== 'number' || typeof row.longitude !== 'number') continue;
      const cell = presenceCell(role, row.latitude, row.longitude);
      if (!cell || (view && !inPresenceBounds(cell,view))) continue;
      const key = `${cell.latitude}:${cell.longitude}`;
      const existing = seen.get(key);
      let art: string | null = null;
      if (role === 'driver' && row.vehicle_body) {
        try { art = vehicleArtwork(JSON.parse(row.vehicle_body)) ?? null; } catch { /* Invalid legacy detail keeps generic art. */ }
      }
      if (role === 'rider' && row.avatar_asset) art = `/api/map-avatar/${row.avatar_asset}.webp`;
      if (existing) {
        if (existing.count < PRESENCE_MAX_PER_AREA) {
          existing.count++;
          existing.artworks?.push(art);
        }
        continue;
      }
      if (seen.size === PRESENCE_LIMIT_PER_ROLE) continue;
      seen.set(key, cell);
      cell.artworks = [art];
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
  const distance = (cell: PresenceCell) => {
    if (!view) return 0;
    const longitude = view.west <= view.east ? (view.west + view.east) / 2 : (view.west + view.east + 360) / 2;
    const dx = Math.abs(cell.longitude - longitude) % 360;
    return (cell.latitude - (view.south + view.north) / 2) ** 2 + Math.min(dx,360-dx) ** 2;
  };
  const sorted = [...areas.values()].sort((a, b) => distance(a[0])-distance(b[0]) || a[0].latitude - b[0].latitude || a[0].longitude - b[0].longitude);
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


const driverEligible = `r.status IN ('PUBLISHED','REQUESTED') AND r.is_sample=0 AND r.accepted_request_id IS NULL
  AND COALESCE(r.offer_expires_at,strftime('%Y-%m-%dT%H:%M:%fZ',r.scheduled_departure_at,'+6 hours'))>?`;
const riderEligible = `d.status='OPEN' AND d.expires_at>?
  AND NOT EXISTS (SELECT 1 FROM rides r WHERE r.driver_session_id=d.owner_id AND r.status IN ('PUBLISHED','REQUESTED','ACCEPTED','RIDE_ACTIVE','CO_RIDE_ACTIVE'))
  AND NOT EXISTS (SELECT 1 FROM ride_requests q JOIN rides r ON r.id=q.ride_id WHERE q.rider_session_id=d.owner_id AND q.status='ACCEPTED' AND r.status IN ('ACCEPTED','RIDE_ACTIVE','CO_RIDE_ACTIVE'))`;
const riderLat = "json_extract(d.body,'$.origin.latitude')";
const riderLon = "json_extract(d.body,'$.origin.longitude')";

function presenceSources(db: Db, timestamp: string, view?: PresenceViewport) {
  return (["driver","rider"] as const).map(role => {
    const lat = role === "driver" ? "r.origin_latitude" : riderLat;
    const lon = role === "driver" ? "r.origin_longitude" : riderLon;
    const select = role === "driver" ? "r.id AS row_id,v.body AS vehicle_body" : "d.id AS row_id,a.asset_id AS avatar_asset";
    const table = role === "driver" ? "rides r" : "rider_demands d";
    const index = view ? ` INDEXED BY ${role === "driver" ? "rides_home_area" : "rider_demands_home_area"}` : "";
    const join = role === "driver" ? " LEFT JOIN account_vehicles v ON v.principal_id=r.driver_session_id" : " LEFT JOIN account_map_avatars a ON a.principal_id=d.owner_id AND a.enabled=1";
    const eligible = role === "driver" ? driverEligible : riderEligible;
    if (!view) return [role, db.prepare(`SELECT ${lat} AS latitude,${lon} AS longitude,${select} FROM ${table}${join} WHERE ${eligible} ORDER BY latitude,longitude`).iterate(timestamp)] as const;
    const params: (number|string)[] = [timestamp, view.south-.05, view.north+.05, view.west-.05, view.east+.05];
    const longitudeFilter = view.west <= view.east ? `${lon} BETWEEN ? AND ?` : `(${lon}>=? OR ${lon}<=?)`;
    const coarseLongitude = view.west <= view.east ? "cell_lon BETWEEN ? AND ?" : "(cell_lon>=? OR cell_lon<=?)";
    const centerLat=(view.south+view.north)/2;
    const centerLon=view.west<=view.east ? (view.west+view.east)/2 : (view.west+view.east+360)/2;
    params.push(view.south,view.north,view.west,view.east,centerLat,centerLat,centerLon,centerLon,centerLon,centerLon);
    // Range filter uses the partial spatial index before grouping/limiting. Within
    // a public cell, a stable row id picks artwork, never a sub-cell GPS distance.
    const sql = `WITH candidates AS (
      SELECT ${lat} AS latitude,${lon} AS longitude,${select},
        round(max(-89.975,min(89.975,(floor(${lat}/0.05)+0.5)*0.05)),3) AS cell_lat,round(max(-179.975,min(179.975,(floor(${lon}/0.05)+0.5)*0.05)),3) AS cell_lon
      FROM ${table}${index}${join} WHERE ${eligible} AND ${lat} BETWEEN ? AND ? AND ${longitudeFilter}
    ), ranked AS (
      SELECT *,row_number() OVER(PARTITION BY cell_lat,cell_lon ORDER BY row_id) AS cell_rank FROM candidates
      WHERE cell_lat BETWEEN ? AND ? AND ${coarseLongitude}
    ) SELECT * FROM ranked WHERE cell_rank<=${PRESENCE_MAX_PER_AREA}
      ORDER BY (cell_lat-?)*(cell_lat-?)+min(abs(cell_lon-?),360-abs(cell_lon-?))*min(abs(cell_lon-?),360-abs(cell_lon-?)),cell_lat,cell_lon,row_id
      LIMIT ${PRESENCE_LIMIT_PER_ROLE * PRESENCE_MAX_PER_AREA}`;
    return [role, db.prepare(sql).iterate(...params)] as const;
  });
}

/** Global existence/extent only, from public cells; never a capped first-page fit. */
export function homePresenceOverview(db: Db, now = new Date()): { hasPresence: boolean; bounds?: PresenceBounds } {
  const timestamp=now.toISOString();
  const row = db.prepare(`WITH origins AS (
    SELECT r.origin_latitude AS latitude,r.origin_longitude AS longitude FROM rides r WHERE ${driverEligible}
    UNION ALL SELECT ${riderLat},${riderLon} FROM rider_demands d WHERE ${riderEligible}
  ) SELECT min(latitude) AS south,max(latitude) AS north,min(longitude) AS west,max(longitude) AS east FROM origins
    WHERE typeof(latitude) IN ('real','integer') AND typeof(longitude) IN ('real','integer') AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180`).get(timestamp,timestamp) as { south:number|null;north:number|null;west:number|null;east:number|null };
  if (row.south===null || row.north===null || row.west===null || row.east===null) return { hasPresence:false };
  const low=presenceCell("driver",row.south,row.west)!,high=presenceCell("driver",row.north,row.east)!;
  return { hasPresence:true,bounds:{ south:Math.max(-90,Number((low.latitude-.025).toFixed(3))),north:Math.min(90,Number((high.latitude+.025).toFixed(3))),west:Math.max(-180,Number((low.longitude-.025).toFixed(3))),east:Math.min(180,Number((high.longitude+.025).toFixed(3))) } };
}

export function homePresenceResponse(db: Db, query: URLSearchParams, now = new Date()) {
  if (!query.size) return { cells:homePresence(db,now) }; // Existing clients during rollout.
  if (query.size===1 && query.get("overview")==="1") return { cells:[],...homePresenceOverview(db,now) };
  const names=["south","north","west","east","zoom"];
  if (query.size!==5 || [...query.keys()].some(key=>!names.includes(key)) || names.some(key=>!query.get(key) || query.get(key)!.length>24 || !/^-?\d+(?:\.\d+)?$/.test(query.get(key)!))) throw new Error("INVALID_PRESENCE_VIEWPORT");
  const view=presenceViewport(Object.fromEntries(names.map(key=>[key,Number(query.get(key))])) as PresenceViewport);
  const timestamp=now.toISOString();
  const hasPresence=Boolean(db.prepare(`SELECT 1 FROM rides r WHERE ${driverEligible} LIMIT 1`).get(timestamp) || db.prepare(`SELECT 1 FROM rider_demands d WHERE ${riderEligible} LIMIT 1`).get(timestamp));
  return { cells:hasPresence && view.zoom>=MAP_MARKER_POLICY.minZoom ? homePresence(db,now,view) : [],hasPresence };
}
