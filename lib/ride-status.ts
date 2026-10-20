import type { RequestStatus, RideStatus } from "./client-types";

export function rideStatusLabel(status: RideStatus): string {
  return {
    PUBLISHED: "Ride offered",
    REQUESTED: "Ride offered",
    ACCEPTED: "Awaiting pickup",
    RIDE_ACTIVE: "Awaiting pickup",
    CO_RIDE_ACTIVE: "Ride in progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
  }[status];
}

// A previous rider's request outcome must not inherit another rider's journey.
export function participantStatusLabel(
  status: RideStatus,
  request?: RequestStatus,
): string {
  if (request === "DECLINED") return "Declined";
  if (request === "DISCARDED") return "Unavailable";
  if (request === "CANCELLED" && status !== "CANCELLED") return "Withdrawn";
  if (["CANCELLED", "EXPIRED", "COMPLETED"].includes(status))
    return rideStatusLabel(status);
  if (request === "PENDING") return "Request pending";
  return rideStatusLabel(status);
}
