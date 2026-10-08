"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Pin, Ride } from "@/lib/client-types";
import CancelPrompt from "./cancel-prompt";
import RidePreviewClient from "./ride-preview-client";

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
const statusFor = (status: Ride["status"]) =>
  ({
    PUBLISHED: "Published",
    REQUESTED: "Requested",
    ACCEPTED: "Accepted",
    RIDE_ACTIVE: "Approaching pickup",
    CO_RIDE_ACTIVE: "In progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
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
      {error ? (
        <>
          <h1>Not available</h1>
          <p className="intro">{error}</p>
        </>
      ) : !ride ? (
        <div aria-busy="true" />
      ) : (
        <RideView ride={ride} />
      )}
    </section>
  );
}
function RideView({ ride }: { ride: Ride }) {
  const riderView = Boolean(ride.request);
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [roadPath, setRoadPath] = useState<Pin[] | null>(null);
  const loadedRouteCoordinates = useRef<string | null>(null);
  const location = riderView ? ride.driverLocation : ride.riderLocation;
  const routeCoordinates = ride.plannedRoute
    ? `${ride.plannedRoute.origin.latitude}:${ride.plannedRoute.origin.longitude}|${ride.plannedRoute.destination.latitude}:${ride.plannedRoute.destination.longitude}`
    : null;
  useEffect(() => {
    if (!ride.plannedRoute || !routeCoordinates) {
      loadedRouteCoordinates.current = null;
      return;
    }
    if (loadedRouteCoordinates.current === routeCoordinates) return;
    loadedRouteCoordinates.current = routeCoordinates;
    let cancelled = false;
    void cocowheelsApi<{ points: Pin[] }>("/api/route-preview", {
      method: "POST",
      body: JSON.stringify({
        origin: ride.plannedRoute.origin,
        destination: ride.plannedRoute.destination,
      }),
    })
      .then(({ points }) => {
        if (!cancelled && points.length >= 2) setRoadPath(points);
      })
      .catch(() => {
        if (!cancelled) setRoadPath(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ride.plannedRoute, routeCoordinates]);
  const canCancel = ![
    "CO_RIDE_ACTIVE",
    "COMPLETED",
    "CANCELLED",
    "EXPIRED",
  ].includes(ride.status);
  const cancelPath =
    riderView && ride.status === "REQUESTED"
      ? `/api/rides/${encodeURIComponent(ride.rideId)}/request/cancel`
      : `/api/rides/${encodeURIComponent(ride.rideId)}/cancel`;
  const cancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await cocowheelsApi(cancelPath, { method: "POST" });
      window.location.assign("/activity");
    } catch {
      setCancelError("We couldn’t cancel this ride. Please try again.");
      setCancelling(false);
    }
  };
  const mapPins = ride.plannedRoute
    ? [ride.plannedRoute.origin, ride.plannedRoute.destination]
    : ride.request
      ? [ride.request.pickup, ride.request.destination]
      : ride.rider
        ? [ride.rider.pickup, ride.rider.destination]
        : location
          ? [{ latitude: location.latitude, longitude: location.longitude }]
          : [];
  if (riderView && ride.status === "REQUESTED" && ride.request) {
    return (
      <RidePreviewClient
        rideId={ride.rideId}
        pendingRequest={ride.request}
      />
    );
  }
  if (!riderView && ride.status === "PUBLISHED") {
    return <RidePreviewClient rideId={ride.rideId} driverOwned />;
  }
  return (
    <section className="activity-record">
      <div className="activity-record-header">
        <strong>{riderView ? "Rider · ride request" : "Driver · published ride"}</strong>
        <span>{statusFor(ride.status)}</span>
      </div>
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
      {mapPins.length ? (
        <div className="activity-record-map">
          <JourneyMap
            pins={mapPins}
            lines={
              mapPins.length === 2
                ? [
                    {
                      points: roadPath?.length ? roadPath : mapPins,
                      color: "#111827",
                      muted: !roadPath?.length,
                    },
                  ]
                : []
            }
            markerKinds={
              ride.plannedRoute && mapPins.length === 2
                ? ["driver", "destination"]
                : undefined
            }
            roadPathAttribution={Boolean(roadPath?.length)}
          />
        </div>
      ) : null}
      {location ? (
        <p className="activity-note">
          {riderView ? "Driver" : "Rider"} location: {location.stale ? "last known" : "latest shared"}
        </p>
      ) : null}
      {cancelError ? <p className="error">{cancelError}</p> : null}
      {canCancel ? (
        <button
          type="button"
          className="danger activity-record-cancel"
          disabled={cancelling}
          onClick={() => setCancelPromptOpen(true)}
        >
          {riderView && ride.status === "REQUESTED"
            ? "WITHDRAW REQUEST"
            : "CANCEL RIDE"}
        </button>
      ) : null}
      {cancelPromptOpen ? (
        <CancelPrompt
          busy={cancelling}
          request={riderView && ride.status === "REQUESTED"}
          close={() => setCancelPromptOpen(false)}
          confirm={cancel}
        />
      ) : null}
    </section>
  );
}
