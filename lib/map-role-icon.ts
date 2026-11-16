import { divIcon } from "leaflet";
import { journeyRoleArtClass, type JourneyRoleArt } from "./journey-role-art";
import { vehicleArtwork, isVehicleArtworkPath, vehicleArtworkDisplayPath } from "./vehicle-catalogue";
import type { Vehicle } from "./vehicle";
import { isMapAvatarPath, mapAvatarImagePath } from "./map-avatar";

// Bounded construction cache only; no image bytes or permission decisions are cached.
const markerIcons = new Map<string, { icon: ReturnType<typeof divIcon>; src?: string }>();

export const modelMarkerIcon = (
  role: JourneyRoleArt,
  label: string,
  interactive = true,
  offset: [number, number] = [0, 0],
  vehicle?: Vehicle,
  artworkPath?: string | null,
  detail: "light" | "detail" = "detail",
) => {
  const src = role === "driver"
    ? vehicleArtwork(vehicle) ?? (isVehicleArtworkPath(artworkPath) ? artworkPath : undefined)
    : isMapAvatarPath(artworkPath) ? artworkPath : undefined;
  const imagePath = src ? role === "driver" ? vehicleArtworkDisplayPath(src) : mapAvatarImagePath(src, detail) : undefined;
  const key = JSON.stringify([role, label, interactive, offset, imagePath]);
  const cached = markerIcons.get(key);
  if (cached) return cached.icon;
  // src is a catalogue path or strict local avatar route, never arbitrary HTML/URLs.
  const art = src
    ? `<img class="${role === "driver" ? "vehicle-artwork-marker" : "map-avatar-artwork"}" src="${imagePath}" decoding="async" alt="" aria-hidden="true" />`
    : `<i class="${journeyRoleArtClass(role)}" aria-hidden="true"></i>`;
  const icon = divIcon({
    className: "journey-marker-icon",
    html: `<span class="journey-marker journey-marker-model" ${interactive ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${art}</span>`,
    iconSize: [48, 48],
    iconAnchor: [24 - offset[0], 40 - offset[1]],
  });
  if (markerIcons.size >= 256) markerIcons.delete(markerIcons.keys().next().value!);
  markerIcons.set(key, { icon, src: imagePath });
  return icon;
};


/** A temporary image failure must be able to recover on the next ordinary render. */
export function forgetMapImageIcon(path: string | null) {
  if (!path) return;
  for (const [key, value] of markerIcons) if (value.src === path) markerIcons.delete(key);
}
