/** Overview policy is independent of stored population and shared by map renderers. */
export const MAP_MARKER_POLICY = {
  minZoom: 8, detailZoom: 12, maxVisible: 50, reducedVisible: 25,
  gap: 40, slowFrameMs: 50, slowFrameLimit: 3,
} as const;
export type MapImageDetail = "light" | "detail";
export type ScreenMarker = { key: string; x: number; y: number };

export function mapImageDetail(zoom: number, reduced = false): MapImageDetail {
  return !reduced && zoom >= MAP_MARKER_POLICY.detailZoom ? "detail" : "light";
}
/** No offscreen DOM/images. Greedy screen-space spacing, stable keys, hard budget. */
export function visibleMapMarkers<T extends ScreenMarker>(markers: T[], width: number, height: number, zoom: number, reduced = false): T[] {
  if (zoom < MAP_MARKER_POLICY.minZoom || width <= 0 || height <= 0) return [];
  const cap = Math.min(reduced ? MAP_MARKER_POLICY.reducedVisible : MAP_MARKER_POLICY.maxVisible, Math.max(3, Math.floor(width * height / (64 * 64))));
  const gap = MAP_MARKER_POLICY.gap;
  const candidates = markers.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 24 && p.x <= width - 24 && p.y >= 40 && p.y <= height - 24)
    .sort((a, b) => (a.x - width / 2) ** 2 + (a.y - height / 2) ** 2 - (b.x - width / 2) ** 2 - (b.y - height / 2) ** 2 || a.key.localeCompare(b.key));
  const bins = new Map<string, T[]>(), selected: T[] = [];
  for (const marker of candidates) {
    const x = Math.floor(marker.x / gap), y = Math.floor(marker.y / gap);
    let collision = false;
    for (let dx = -1; dx <= 1 && !collision; dx++) for (let dy = -1; dy <= 1 && !collision; dy++)
      collision = (bins.get(`${x + dx}:${y + dy}`) ?? []).some(p => (p.x - marker.x) ** 2 + (p.y - marker.y) ** 2 < gap ** 2);
    if (collision) continue;
    selected.push(marker);
    bins.set(`${x}:${y}`, [...(bins.get(`${x}:${y}`) ?? []), marker]);
    if (selected.length === cap) break;
  }
  return selected;
}

/** Consecutive interaction stalls, not a timer or an unlimited device capability claim. */
export function mapFrameBudgetExceeded(previous: number, time: number, consecutive: number) {
  const slow = previous > 0 && time - previous > MAP_MARKER_POLICY.slowFrameMs ? consecutive + 1 : 0;
  return { slow, exceeded: slow >= MAP_MARKER_POLICY.slowFrameLimit };
}
