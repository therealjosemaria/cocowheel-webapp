"use client";

import { participantStatusLabel } from "@/lib/ride-status";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cocowheelsApi } from "@/lib/api-client";
import LocationAge from "./location-age";
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
  const [pickupEstimate, setPickupEstimate] = useState<{
    key: string;
    minutes: number;
  } | null>(null);
  const pickup = (ride.request ?? ride.rider)?.pickup;
  const originPoint = ride.driverLocation ?? ride.plannedRoute?.origin;
  const estimateKey =
    originPoint && pickup
      ? `${ride.rideId}:${originPoint.latitude},${originPoint.longitude}:${pickup.latitude},${pickup.longitude}`
      : "";
  const estimateEnabled =
    !compact && role === "RIDER" && ride.status === "ACCEPTED";
  useEffect(() => {
    if (!estimateEnabled || !estimateKey) return;
    let cancelled = false;
    const [, coordinates] = estimateKey.split(":");
    const [latitude, longitude] = coordinates.split(",").map(Number);
    const [pickupLatitude, pickupLongitude] = estimateKey
      .split(":")[2]
      .split(",")
      .map(Number);
    void cocowheelsApi<{ durationSeconds: number | null }>(
      "/api/route-preview",
      {
        method: "POST",
        body: JSON.stringify({
          origin: { latitude, longitude },
          destination: { latitude: pickupLatitude, longitude: pickupLongitude },
        }),
      },
    )
      .then(({ durationSeconds }) => {
        if (!cancelled && durationSeconds !== null)
          setPickupEstimate({
            key: estimateKey,
            minutes: Math.max(1, Math.round(durationSeconds / 60)),
          });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [estimateEnabled, estimateKey]);
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
  const status = participantStatusLabel(
    ride.status,
    role === "RIDER" ? ride.request?.status : undefined,
  );
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
          {status}
        </RideFieldLabel>
      </strong>
      {!compact && (
        <>
          <span className="active-ride-route">
            {origin?.label || "Where from"} <span aria-hidden="true">→</span>{" "}
            {destination?.label || "Where to"}
          </span>
          {estimateEnabled && pickupEstimate?.key === estimateKey ? (
            <span className="active-ride-status">
              Pickup · {pickupEstimate.minutes} min
            </span>
          ) : null}
          <span className="active-ride-price">A${ride.priceAud}</span>
          {role === "RIDER" &&
          ride.status === "ACCEPTED" &&
          ride.driverLocation ? (
            <LocationAge location={ride.driverLocation} />
          ) : null}
        </>
      )}
    </Link>
  );
}
