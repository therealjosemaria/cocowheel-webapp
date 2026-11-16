import type { JourneyRoleArt } from './journey-role-art';
import { isVehicleArtworkPath } from './vehicle-catalogue';
import { isMapAvatarPath } from './map-avatar';

export type PresenceCell = { role: JourneyRoleArt; latitude: number; longitude: number; count: number; artworks?: Array<string | null> };
export const PRESENCE_REFRESH_MS = 60_000;
export const PRESENCE_LIMIT_PER_ROLE = 100;
export const PRESENCE_MAX_ICONS = 120;
export const PRESENCE_MAX_PER_AREA = 3;
// Stable area cells, not random offsets that repeated requests could average out.
export const PRESENCE_GRID_DEGREES = 0.05;

export function presenceCell(role: JourneyRoleArt, latitude: number, longitude: number): PresenceCell | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const center = (value: number, bound: number) => Number(Math.max(-bound + 0.025, Math.min(bound - 0.025,
    (Math.floor(value / PRESENCE_GRID_DEGREES) + 0.5) * PRESENCE_GRID_DEGREES)).toFixed(3));
  return { role, latitude: center(latitude, 90), longitude: center(longitude, 180), count: 1 };
}

export function readPresenceCells(payload: unknown): PresenceCell[] {
  if (!payload || typeof payload !== 'object' || !('cells' in payload) || !Array.isArray(payload.cells)) throw new Error('INVALID_PRESENCE');
  if (payload.cells.length > 2 * PRESENCE_LIMIT_PER_ROLE) throw new Error('INVALID_PRESENCE');
  let total = 0;
  const areas = new Map<string, number>();
  const roles = new Set<string>();
  return payload.cells.map(cell => {
    if (!cell || !['driver', 'rider'].includes(cell.role) || typeof cell.latitude !== 'number' || typeof cell.longitude !== 'number') throw new Error('INVALID_PRESENCE');
    const safe = presenceCell(cell.role, cell.latitude, cell.longitude);
    if (!safe || safe.latitude !== cell.latitude || safe.longitude !== cell.longitude) throw new Error('INVALID_PRESENCE');
    if (!Number.isInteger(cell.count) || cell.count < 1 || cell.count > PRESENCE_MAX_PER_AREA) throw new Error('INVALID_PRESENCE');
    const key = `${cell.latitude}:${cell.longitude}`;
    const area = (areas.get(key) ?? 0) + cell.count;
    if (area > PRESENCE_MAX_PER_AREA || roles.has(`${key}:${cell.role}`)) throw new Error('INVALID_PRESENCE');
    areas.set(key, area);
    roles.add(`${key}:${cell.role}`);
    total += cell.count;
    if (total > PRESENCE_MAX_ICONS) throw new Error('INVALID_PRESENCE');
    if (cell.artworks !== undefined && (!Array.isArray(cell.artworks) ||
      cell.artworks.length !== cell.count || !cell.artworks.every((art: unknown) => art === null ||
        (cell.role === 'driver' ? isVehicleArtworkPath(art) : isMapAvatarPath(art))))) throw new Error('INVALID_PRESENCE');
    return { ...safe, count: cell.count, ...(cell.artworks ? { artworks: [...cell.artworks] } : {}) };
  });
}

export type PresenceBounds = { south: number; north: number; west: number; east: number };
export type PresenceViewport = PresenceBounds & { zoom: number };
export type PresenceReply = { cells: PresenceCell[]; hasPresence: boolean; bounds?: PresenceBounds };
export const PRESENCE_MOVE_DELAY_MS = 300;

/** Canonical whole public cells: narrow requests cannot probe positions inside a cell. */
export function presenceViewport(value: PresenceViewport): PresenceViewport {
  const { south, north, west, east, zoom } = value;
  if (![south,north,west,east,zoom].every(Number.isFinite) || south < -90 || north > 90 || south >= north || west < -180 || west > 180 || east < -180 || east > 180 || west === east || !Number.isInteger(zoom) || zoom < 0 || zoom > 22)
    throw new Error('INVALID_PRESENCE_VIEWPORT');
  const snap = (n: number, up: boolean) => {
    const scaled=n/PRESENCE_GRID_DEGREES, nearest=Math.round(scaled);
    // Avoid re-expanding an already canonical decimal due to binary rounding.
    const aligned=Math.abs(scaled-nearest)<1e-9 ? nearest : scaled;
    return Number(((up ? Math.ceil(aligned) : Math.floor(aligned))*PRESENCE_GRID_DEGREES).toFixed(3));
  };
  let left=Math.max(-180,snap(west,false)),right=Math.min(180,snap(east,true));
  if (west>east && left<=right) { left=-180;right=180; }
  if (left===right) { left=Math.max(-180,left-PRESENCE_GRID_DEGREES); right=Math.min(180,right+PRESENCE_GRID_DEGREES); }
  return { south:Math.max(-90,snap(south,false)),north:Math.min(90,snap(north,true)),west:left,east:right,zoom };
}
export function inPresenceBounds(cell: Pick<PresenceCell,'latitude'|'longitude'>, bounds: PresenceBounds) {
  return cell.latitude >= bounds.south && cell.latitude <= bounds.north && (bounds.west <= bounds.east
    ? cell.longitude >= bounds.west && cell.longitude <= bounds.east : cell.longitude >= bounds.west || cell.longitude <= bounds.east);
}
export function presenceViewportQuery(view: PresenceViewport) {
  return new URLSearchParams(Object.entries(view).map(([k,v]) => [k,String(v)])).toString();
}
export function readPresenceReply(payload: unknown): PresenceReply {
  const cells = readPresenceCells(payload);
  const data = payload as { hasPresence?: unknown; bounds?: unknown };
  if (data.hasPresence !== undefined && typeof data.hasPresence !== 'boolean') throw new Error('INVALID_PRESENCE');
  const hasPresence = data.hasPresence === undefined ? cells.length > 0 : data.hasPresence;
  if (!hasPresence && cells.length) throw new Error('INVALID_PRESENCE');
  let bounds: PresenceBounds | undefined;
  if (data.bounds !== undefined) {
    const b = data.bounds as PresenceBounds;
    if (!b || typeof b !== 'object' || ![b.south,b.north,b.west,b.east].every(n => typeof n === 'number' && Number.isFinite(n)) || b.south < -90 || b.north > 90 || b.south >= b.north || b.west < -180 || b.east > 180 || b.west >= b.east) throw new Error('INVALID_PRESENCE');
    bounds = { south:b.south,north:b.north,west:b.west,east:b.east };
  }
  return { cells, hasPresence, ...(bounds ? { bounds } : {}) };
}
