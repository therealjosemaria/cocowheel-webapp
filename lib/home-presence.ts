import type { JourneyRoleArt } from './journey-role-art';

export type PresenceCell = { role: JourneyRoleArt; latitude: number; longitude: number; count: number };
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
    return { ...safe, count: cell.count };
  });
}
