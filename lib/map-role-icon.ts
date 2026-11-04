import { divIcon } from "leaflet";
import { journeyRoleArtClass, type JourneyRoleArt } from "./journey-role-art";
import { vehicleArtwork, isVehicleArtworkPath, vehicleArtworkDisplayPath } from "./vehicle-catalogue";
import type { Vehicle } from "./vehicle";

export const modelMarkerIcon = (
  role: JourneyRoleArt,
  label: string,
  interactive = true,
  offset: [number, number] = [0, 0],
  vehicle?: Vehicle,
  artworkPath?: string | null,
) => {
  const src = role === "driver"
    ? vehicleArtwork(vehicle) ?? (isVehicleArtworkPath(artworkPath) ? artworkPath : undefined)
    : undefined;
  // src is catalogue-derived, never a user-supplied URL or HTML fragment.
  const art = src
    ? `<img class="vehicle-artwork-marker" src="${vehicleArtworkDisplayPath(src)}" alt="" aria-hidden="true" />`
    : `<i class="${journeyRoleArtClass(role)}" aria-hidden="true"></i>`;
  return divIcon({
    className: "journey-marker-icon",
    html: `<span class="journey-marker journey-marker-model" ${interactive ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${art}</span>`,
    iconSize: [48, 48],
    iconAnchor: [24 - offset[0], 40 - offset[1]],
  });
};
