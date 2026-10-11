import Link from "next/link";
import type { Ride } from "@/lib/client-types";
import RideFieldLabel from "./ride-field-label";

export type ActiveRide = { role: "DRIVER" | "RIDER"; ride: Ride };

export default function ActiveRideLink({
  item,
  compact = false,
  onClick,
}: {
  item: ActiveRide;
  compact?: boolean;
  onClick?: () => void;
}) {
  const { role, ride } = item;
  if (
    ![
      "PUBLISHED",
      "REQUESTED",
      "ACCEPTED",
      "RIDE_ACTIVE",
      "CO_RIDE_ACTIVE",
    ].includes(ride.status)
  )
    return null;
  if (
    role === "RIDER" &&
    ride.request &&
    !["PENDING", "ACCEPTED"].includes(ride.request.status)
  )
    return null;
  const riderRoute = ride.request ?? ride.rider;
  const origin =
    role === "RIDER" ? riderRoute?.pickup : ride.plannedRoute?.origin;
  const destination =
    role === "RIDER" ? riderRoute?.destination : ride.plannedRoute?.destination;
  const status =
    ride.status === "CO_RIDE_ACTIVE" || ride.status === "RIDE_ACTIVE"
      ? "In progress"
      : ride.status === "ACCEPTED"
        ? "Accepted"
        : role === "RIDER"
          ? "Request pending"
          : "Published";
  const href = `/activity/${encodeURIComponent(ride.rideId)}${role === "RIDER" && ride.request ? `?request=${encodeURIComponent(ride.request.requestId)}` : ""}`;
  return (
    <Link
      href={href}
      className={
        compact ? "secondary profile-active-ride" : "home-current-ride"
      }
      onClick={onClick}
    >
      <strong>
        <RideFieldLabel icon={role === "DRIVER" ? "driver" : "rider"}>
          Active ride
        </RideFieldLabel>
      </strong>
      {!compact && (
        <>
          <span className="active-ride-route">
            {origin?.label || "Where from"} <span aria-hidden="true">→</span>{" "}
            {destination?.label || "Where to"}
          </span>
          <span className="active-ride-status">{status}</span>
        </>
      )}
    </Link>
  );
}
