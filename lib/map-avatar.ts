export type MapAvatar = {
  available: boolean;
  enabled: boolean;
  previewUrl: string | null;
  artworkUrl: string | null;
};

// Only our versioned, opaque sprite route may enter Leaflet's HTML renderer.
export function isMapAvatarPath(value: unknown): value is string {
  return typeof value === "string" && /^\/api\/map-avatar\/[a-f0-9]{32}\.webp$/.test(value);
}
