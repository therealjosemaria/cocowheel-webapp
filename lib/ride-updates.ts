import type { Ride } from "./client-types";

export type RideUpdate = {
  key: string;
  target: string;
  rideId: string;
  message: string;
  driver: boolean;
};
export const requestTarget = (id: string) =>
  `request-${encodeURIComponent(id)}`;
export const pickupTarget = (id: string) => `pickup-${encodeURIComponent(id)}`;
export function rideUpdates(
  item: { role: "DRIVER" | "RIDER"; ride: Ride } | null,
): RideUpdate[] {
  if (!item) return [];
  const { ride, role } = item;
  if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(ride.status)) return [];
  if (role === "DRIVER")
    return (ride.requests ?? [])
      .filter((r) => r.status === "PENDING")
      .map((r) => ({
        key: `${ride.rideId}:${r.requestId}:${r.createdAt ?? r.requestedDepartureAt}`,
        target: requestTarget(r.requestId),
        rideId: ride.rideId,
        message: "New rider request",
        driver: true,
      }));
  if (ride.request?.status !== "ACCEPTED" || ride.pickupEstablished) return [];
  return [
    {
      key: `${ride.rideId}:${ride.request.requestId}:accepted:${ride.request.decidedAt ?? ride.acceptedAt ?? ""}`,
      target: pickupTarget(ride.rideId),
      rideId: ride.rideId,
      message: `${ride.driverAlias} accepted your request`,
      driver: false,
    },
  ];
}
