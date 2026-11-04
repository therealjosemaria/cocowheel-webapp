import { divIcon } from 'leaflet';
import { journeyRoleArtClass, type JourneyRoleArt } from './journey-role-art';

export const modelMarkerIcon = (role: JourneyRoleArt, label: string, interactive = true, offset: [number, number] = [0, 0]) => divIcon({
  className: 'journey-marker-icon',
  html: `<span class="journey-marker journey-marker-model" ${interactive ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}><i class="${journeyRoleArtClass(role)}" aria-hidden="true"></i></span>`,
  iconSize: [48, 48],
  iconAnchor: [24 - offset[0], 40 - offset[1]],
});
