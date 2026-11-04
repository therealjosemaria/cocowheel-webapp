export type JourneyRoleArt = "driver" | "rider";

// Shared by React labels and Leaflet's static marker markup.
export function journeyRoleArtClass(role: JourneyRoleArt) {
  return `journey-role-art journey-role-art-${role}`;
}
