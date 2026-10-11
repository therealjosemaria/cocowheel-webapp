export function activeRideTabForPath(
  pathname: string,
  rideTab: "driver" | "rider" | null,
) {
  return pathname === "/" ? rideTab : null;
}
