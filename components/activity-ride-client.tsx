"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Pin, Ride } from "@/lib/client-types";

const JourneyMap = dynamic(() => import("./journey-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});

const locationText = (pin?: Pin) =>
  pin
    ? (pin.label ?? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`)
    : "Not available";
const prettyTime = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
const titleFor = (status: Ride["status"]) =>
  ({
    PUBLISHED: "Published ride",
    REQUESTED: "Rider requests",
    ACCEPTED: "Rider accepted",
    RIDE_ACTIVE: "Heading to pickup",
    CO_RIDE_ACTIVE: "Co-ride in progress",
    COMPLETED: "Co-ride complete",
    CANCELLED: "Ride cancelled",
    EXPIRED: "Ride expired",
  })[status];

export default function ActivityRideClient({ rideId }: { rideId: string }) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await cocowheelsApi<{ ride: Ride }>(
          `/api/rides/${encodeURIComponent(rideId)}`,
        );
        if (!cancelled) {
          setRide(result.ride);
          setError(null);
        }
      } catch (reason) {
        if (cancelled) return;
        setError(
          reason instanceof ApiError && reason.status === 403
            ? "This ride is not available."
            : "Trying to reconnect. Please try again.",
        );
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [rideId]);

  return (
    <section className="activity-detail" aria-live={ride ? undefined : "polite"}>
      <Link href="/activity" className="text-button">
        Back to activity
      </Link>
      {error ? (
        <>
          <p className="eyebrow">Ride</p>
          <h1>Not available</h1>
          <p className="intro">{error}</p>
        </>
      ) : !ride ? (
        <>
          <p className="eyebrow">Ride</p>
          <h1>Loading</h1>
        </>
      ) : (
        <RideView ride={ride} />
      )}
    </section>
  );
}

function RideView({ ride }: { ride: Ride }) {
  const riderView = Boolean(ride.request);
  const location = riderView ? ride.driverLocation : ride.riderLocation;
  return (
    <>
      <p className="eyebrow">Ride</p>
      <h1>{titleFor(ride.status)}</h1>
      <div className="ride-summary">
        <span>{ride.driverAlias}</span>
        <strong>A${ride.priceAud}</strong>
        <small>{prettyTime(ride.scheduledDepartureAt)}</small>
      </div>
      {ride.request ? (
        <div className="journey-summary">
          <p>
            <strong>Pickup</strong>
            {locationText(ride.request.pickup)}
          </p>
          <p>
            <strong>Your destination</strong>
            {locationText(ride.request.destination)}
          </p>
        </div>
      ) : null}
      {ride.rider ? (
        <div className="journey-summary">
          <p>
            <strong>Rider pickup</strong>
            {locationText(ride.rider.pickup)}
          </p>
          <p>
            <strong>Rider destination</strong>
            {locationText(ride.rider.destination)}
          </p>
        </div>
      ) : null}
      {location ? (
        <section className="location-card">
          <h2>{riderView ? "Driver location" : "Rider location"}</h2>
          <p>
            {location.stale ? "Last known location" : "Latest shared location"}
          </p>
          <JourneyMap
            pins={[{ latitude: location.latitude, longitude: location.longitude }]}
          />
        </section>
      ) : null}
      {ride.status === "CANCELLED" ? (
        <p className="activity-note">This ride was cancelled.</p>
      ) : null}
    </>
  );
}
