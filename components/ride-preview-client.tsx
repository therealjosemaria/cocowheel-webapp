"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CancelPrompt from "./cancel-prompt";
import PoorFitPrompt from "./poor-fit-prompt";
import LocationAge from "./location-age";
import ExpiryCountdown from "./expiry-countdown";
import RideFieldLabel from "./ride-field-label";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { PayIdType, Pin, Ride } from "@/lib/client-types";
import { routeReference } from "@/lib/route-id";
import {
  cacheRoadPath,
  cacheRiderRoadPath,
  cachedRoadPath,
  cachedRiderRoadPath,
  riderSearchDraft,
  riderPreviewRoute,
} from "@/lib/ride-preview-cache";

const JourneyMap = dynamic(() => import("./journey-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});

type PreviewRide = {
  driverLocation?: Ride["driverLocation"];
  rideId: string;
  driverAlias: string;
  priceAud: number;
  scheduledDepartureAt: string;
  expiresAt?: string;
  acceptedAt?: string | null;
  status: Ride["status"];
  requestStatus?: NonNullable<Ride["request"]>["status"];
  departureLabel: string;
  destinationLabel: string;
  plannedRoute?: { origin: Pin; destination: Pin };
  payId?: string | null;
  payIdType?: PayIdType | null;
};
type RoutePreviewResponse = {
  points: Pin[];
  distanceMeters: number | null;
  durationSeconds: number | null;
};
const locationLabel = (pin?: Pin) =>
  pin?.label ??
  (pin ? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}` : "—");

const previewFromActivity = (ride: Ride): PreviewRide => {
  const participantRoute = ride.request
    ? { origin: ride.request.pickup, destination: ride.request.destination }
    : ride.rider
      ? { origin: ride.rider.pickup, destination: ride.rider.destination }
      : undefined;
  const visibleRoute = ride.plannedRoute ?? participantRoute;
  return {
    rideId: ride.rideId,
    driverLocation: ride.driverLocation,
    driverAlias: ride.driverAlias,
    priceAud: ride.priceAud,
    scheduledDepartureAt: ride.scheduledDepartureAt,
    expiresAt: ride.expiresAt,
    acceptedAt: ride.acceptedAt,
    status: ride.status,
    requestStatus: ride.request?.status,
    departureLabel: locationLabel(visibleRoute?.origin),
    destinationLabel: locationLabel(visibleRoute?.destination),
    ...(ride.plannedRoute ? { plannedRoute: ride.plannedRoute } : {}),
    payId: ride.payId,
    payIdType: ride.payIdType,
  };
};
const prettyTime = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
const rideStatusLabel = (status: Ride["status"]) =>
  ({
    PUBLISHED: "Active",
    REQUESTED: "Requested",
    ACCEPTED: "Accepted",
    RIDE_ACTIVE: "Ride active",
    CO_RIDE_ACTIVE: "Co-ride active",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
  })[status];
const requestStatusLabel = (status: NonNullable<Ride["request"]>["status"]) =>
  ({
    PENDING: "Pending",
    ACCEPTED: "Accepted",
    DECLINED: "Declined",
    DISCARDED: "Unavailable",
    CANCELLED: "Withdrawn",
  })[status];

export default function RidePreviewClient({
  rideId,
  pendingRequest,
  driverOwned = false,
  participantRide,
  activityRide,
  readOnly = false,
}: {
  rideId: string;
  pendingRequest?: NonNullable<Ride["request"]>;
  driverOwned?: boolean;
  participantRide?: Ride;
  activityRide?: Ride;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [publicRide, setPublicRide] = useState<PreviewRide | null>(null);
  const [serverNow, setServerNow] = useState<string | null>(() =>
    activityRide || participantRide ? new Date().toISOString() : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [routeRequiredPromptOpen, setRouteRequiredPromptOpen] = useState(false);
  const [selfJoinPromptOpen, setSelfJoinPromptOpen] = useState(false);
  const [poorFitPromptOpen, setPoorFitPromptOpen] = useState(false);
  const [roleChangePromptOpen, setRoleChangePromptOpen] = useState(false);
  const [joinFailurePromptOpen, setJoinFailurePromptOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [endPromptOpen, setEndPromptOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [requestDecision, setRequestDecision] = useState<{
    requestId: string;
    decision: "ACCEPT" | "DECLINE";
  } | null>(null);
  const [requestDecisionError, setRequestDecisionError] = useState(false);
  const activityRequest =
    participantRide?.request ?? pendingRequest ?? activityRide?.request;
  const pendingRiderRequests =
    driverOwned && participantRide?.requests
      ? participantRide.requests.filter(
          (request) => request.status === "PENDING",
        )
      : [];
  const acceptedDriverRequest = participantRide?.requests?.find(
    (request) => request.status === "ACCEPTED",
  );
  const riderDetail = driverOwned
    ? participantRide?.rider
      ? {
          alias: participantRide.rider.alias,
          pickup: participantRide.rider.pickup,
          destination: participantRide.rider.destination,
          requestedAt:
            acceptedDriverRequest?.createdAt ??
            participantRide.rider.requestedDepartureAt,
          directionFit: participantRide.rider.directionFit,
          status: "ACCEPTED" as const,
        }
      : null
    : activityRequest
      ? {
          alias: activityRequest.riderAlias,
          pickup: activityRequest.pickup,
          destination: activityRequest.destination,
          requestedAt: activityRequest.createdAt,
          directionFit: activityRequest.directionFit,
          status: activityRequest.status,
        }
      : null;
  const riderRoute = useMemo<{
    pickup: Pin;
    destination: Pin;
    directionFit?: "GOOD" | "POOR";
  } | null>(() => {
    if (driverOwned) {
      return participantRide?.rider
        ? {
            pickup: participantRide.rider.pickup,
            destination: participantRide.rider.destination,
            directionFit: participantRide.rider.directionFit,
          }
        : null;
    }
    if (activityRequest) {
      return {
        pickup: activityRequest.pickup,
        destination: activityRequest.destination,
        directionFit: activityRequest.directionFit,
      };
    }
    return riderPreviewRoute(rideId);
  }, [activityRequest, driverOwned, participantRide, rideId]);
  const [roadPath, setRoadPath] = useState<Pin[] | null>(() =>
    riderRoute
      ? cachedRiderRoadPath(riderRoute.pickup, riderRoute.destination)
      : null,
  );
  const [riderDurationSeconds, setRiderDurationSeconds] = useState<
    number | null
  >(null);
  const [pickupDurationSeconds, setPickupDurationSeconds] = useState<
    number | null
  >(null);
  const [driverRoadPath, setDriverRoadPath] = useState<{
    coordinates: string;
    points: Pin[];
  } | null>(null);

  const privateRide = participantRide ?? activityRide;
  const ride = useMemo<PreviewRide | null>(() => {
    if (!privateRide) return publicRide;
    const next = previewFromActivity(privateRide);
    if (!publicRide || next.plannedRoute) return next;
    return {
      ...next,
      plannedRoute: publicRide.plannedRoute,
      departureLabel: publicRide.departureLabel,
      destinationLabel: publicRide.destinationLabel,
    };
  }, [privateRide, publicRide]);

  const participantStatus = participantRide?.status;
  useEffect(() => {
    const shouldFetchPublicPreview =
      !activityRide &&
      (!participantStatus ||
        (!driverOwned && participantStatus === "REQUESTED"));
    if (!shouldFetchPublicPreview) return;
    let cancelled = false;
    const refresh = () => {
      void cocowheelsApi<{ ride: PreviewRide; serverNow: string }>(
        `/api/rides/${encodeURIComponent(rideId)}/preview`,
      )
        .then((result) => {
          if (!cancelled) {
            setPublicRide(result.ride);
            setServerNow(result.serverNow);
          }
        })
        .catch((reason) => {
          if (cancelled) return;
          setError(
            reason instanceof ApiError && reason.status === 404
              ? "This ride is no longer available."
              : "Trying to reconnect. Please try again.",
          );
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activityRide, driverOwned, participantStatus, rideId]);

  const routeKey = riderRoute
    ? `${riderRoute.pickup.latitude}:${riderRoute.pickup.longitude}|${riderRoute.destination.latitude}:${riderRoute.destination.longitude}`
    : null;
  const driverRouteInput = useMemo(
    () =>
      ride?.plannedRoute
        ? {
            origin: ride.plannedRoute.origin,
            destination: ride.plannedRoute.destination,
          }
        : null,
    [ride],
  );
  const driverRouteCoordinates = driverRouteInput
    ? `${driverRouteInput.origin.latitude}:${driverRouteInput.origin.longitude}|${driverRouteInput.destination.latitude}:${driverRouteInput.destination.longitude}`
    : "";
  useEffect(() => {
    if (!riderRoute || (roadPath?.length && riderDurationSeconds !== null))
      return;
    let cancelled = false;
    void cocowheelsApi<RoutePreviewResponse>("/api/route-preview", {
      method: "POST",
      body: JSON.stringify({
        origin: riderRoute.pickup,
        destination: riderRoute.destination,
      }),
    })
      .then(({ points, durationSeconds }) => {
        if (cancelled || points.length < 2) return;
        cacheRiderRoadPath(riderRoute.pickup, riderRoute.destination, points);
        setRoadPath(points);
        setRiderDurationSeconds(durationSeconds);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [riderRoute, riderDurationSeconds, roadPath?.length, routeKey]);

  useEffect(() => {
    if (!ride?.plannedRoute || !riderRoute) return;
    let cancelled = false;
    void cocowheelsApi<RoutePreviewResponse>("/api/route-preview", {
      method: "POST",
      body: JSON.stringify({
        origin: ride.driverLocation ?? ride.plannedRoute.origin,
        destination: riderRoute.pickup,
      }),
    })
      .then(({ durationSeconds }) => {
        if (!cancelled) setPickupDurationSeconds(durationSeconds);
      })
      .catch(() => {
        if (!cancelled) setPickupDurationSeconds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ride?.plannedRoute, ride?.driverLocation, riderRoute]);

  useEffect(() => {
    if (!driverRouteInput) return;
    const cached = cachedRoadPath(
      driverRouteInput.origin,
      driverRouteInput.destination,
    );
    if (cached?.length) {
      const timer = window.setTimeout(
        () =>
          setDriverRoadPath({
            coordinates: driverRouteCoordinates,
            points: cached,
          }),
        0,
      );
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    void cocowheelsApi<RoutePreviewResponse>("/api/route-preview", {
      method: "POST",
      body: JSON.stringify(driverRouteInput),
    })
      .then(({ points }) => {
        if (cancelled || points.length < 2) return;
        cacheRoadPath(
          driverRouteInput.origin,
          driverRouteInput.destination,
          points,
        );
        setDriverRoadPath({ coordinates: driverRouteCoordinates, points });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [driverRouteCoordinates, driverRouteInput]);

  const activeDriverRoadPath =
    driverRoadPath?.coordinates === driverRouteCoordinates
      ? driverRoadPath.points
      : null;
  const pickupMinutes =
    pickupDurationSeconds === null
      ? null
      : Math.max(1, Math.round(pickupDurationSeconds / 60));
  const estimatedArrival =
    serverNow && pickupDurationSeconds !== null && riderDurationSeconds !== null
      ? new Date(
          Math.max(
            new Date(serverNow).getTime(),
            new Date(ride?.scheduledDepartureAt ?? serverNow).getTime(),
          ) +
            (pickupDurationSeconds + riderDurationSeconds) * 1_000,
        )
      : null;

  async function joinRide(confirmed = false) {
    if (!ride) return;
    try {
      const currentState = await cocowheelsApi<{
        current: { role: "DRIVER" | "RIDER"; ride: { rideId: string } } | null;
      }>("/api/current");
      if (currentState.current?.role === "DRIVER") {
        if (currentState.current.ride.rideId === ride.rideId)
          setSelfJoinPromptOpen(true);
        else setRoleChangePromptOpen(true);
        return;
      }
    } catch (reason) {
      if (!(reason instanceof ApiError && reason.status === 401)) {
        setJoinFailurePromptOpen(true);
        return;
      }
    }
    if (!riderRoute) {
      setRouteRequiredPromptOpen(true);
      return;
    }
    if (riderRoute.directionFit === "POOR" && !confirmed) {
      setPoorFitPromptOpen(true);
      return;
    }
    setJoining(true);
    try {
      const draft = riderSearchDraft();
      await cocowheelsApi<{ ride: unknown }>(
        `/api/rides/${encodeURIComponent(ride.rideId)}/requests`,
        {
          method: "POST",
          body: JSON.stringify({
            pickup: riderRoute.pickup,
            destination: riderRoute.destination,
            requestedDepartureAt: draft?.departureAt
              ? new Date(draft.departureAt).toISOString()
              : new Date().toISOString(),
          }),
        },
      );
      window.location.assign("/activity");
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.code === "OWN_RIDE_JOIN_NOT_ALLOWED"
      )
        setSelfJoinPromptOpen(true);
      else if (
        reason instanceof ApiError &&
        reason.code === "ROLE_CHANGE_REQUIRES_TERMINATION"
      )
        setRoleChangePromptOpen(true);
      else setJoinFailurePromptOpen(true);
    } finally {
      setJoining(false);
    }
  }

  async function endOpenRide() {
    setEnding(true);
    setEndError(null);
    try {
      await cocowheelsApi(
        !driverOwned && activityRequest?.status === "PENDING"
          ? `/api/rides/${encodeURIComponent(rideId)}/request/cancel`
          : `/api/rides/${encodeURIComponent(rideId)}/cancel`,
        { method: "POST" },
      );
      router.push("/activity");
    } catch {
      setEndError(
        driverOwned
          ? "We couldn’t cancel this ride. Please try again."
          : "We couldn’t withdraw this request. Please try again.",
      );
      setEnding(false);
      setEndPromptOpen(false);
    }
  }

  async function decideRiderRequest(
    requestId: string,
    decision: "ACCEPT" | "DECLINE",
  ) {
    setRequestDecision({ requestId, decision });
    try {
      await cocowheelsApi(
        `/api/rides/${encodeURIComponent(rideId)}/requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ decision }),
        },
      );
      window.location.reload();
    } catch {
      setRequestDecisionError(true);
      setRequestDecision(null);
    }
  }

  const lines = useMemo(() => {
    if (!ride) return [];
    return [
      ...(ride.plannedRoute
        ? [
            {
              points: activeDriverRoadPath?.length
                ? activeDriverRoadPath
                : [ride.plannedRoute.origin, ride.plannedRoute.destination],
              color: "#2563eb",
              weight: 8,
              opacity: 0.9,
            },
          ]
        : []),
      ...(riderRoute
        ? [
            {
              points: roadPath?.length
                ? roadPath
                : [riderRoute.pickup, riderRoute.destination],
              color: "#f97316",
              weight: 4,
              opacity: 0.95,
            },
          ]
        : []),
    ];
  }, [ride, activeDriverRoadPath, riderRoute, roadPath]);

  return (
    <section className="ride-preview" aria-live={ride ? undefined : "polite"}>
      {routeRequiredPromptOpen ? (
        <div className="location-prompt-backdrop" role="presentation">
          <section
            className="location-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="route-required-title"
          >
            <h2 id="route-required-title">Add your route first</h2>
            <p>Fill Where from and Where to to join.</p>
            <div className="location-prompt-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setRouteRequiredPromptOpen(false)}
              >
                OKAY
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {selfJoinPromptOpen ? (
        <div className="location-prompt-backdrop" role="presentation">
          <section
            className="location-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="self-join-title"
          >
            <h2 id="self-join-title">
              We apologise, drivers are not allowed to join their own rides.
            </h2>
            <div className="location-prompt-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setSelfJoinPromptOpen(false)}
              >
                OKAY
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {roleChangePromptOpen ? (
        <div className="location-prompt-backdrop" role="presentation">
          <section
            className="location-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-change-title"
          >
            <h2 id="role-change-title">
              End your current activity before switching roles.
            </h2>
            <div className="location-prompt-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setRoleChangePromptOpen(false)}
              >
                OKAY
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {joinFailurePromptOpen ? (
        <div className="location-prompt-backdrop" role="presentation">
          <section
            className="location-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-failure-title"
          >
            <h2 id="join-failure-title">We couldn’t join this ride.</h2>
            <div className="location-prompt-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setJoinFailurePromptOpen(false)}
              >
                OKAY
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {requestDecisionError ? (
        <div className="location-prompt-backdrop" role="presentation">
          <section
            className="location-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-decision-error-title"
          >
            <h2 id="request-decision-error-title">
              We couldn’t update this request.
            </h2>
            <div className="location-prompt-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setRequestDecisionError(false)}
              >
                OKAY
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {endPromptOpen && !readOnly ? (
        <CancelPrompt
          busy={ending}
          request={!driverOwned && activityRequest?.status === "PENDING"}
          close={() => setEndPromptOpen(false)}
          confirm={endOpenRide}
        />
      ) : null}
      {error ? (
        <>
          <h1 className="page-title">Ride preview</h1>
          <div className="ride-preview-content">
            <h2>Not available</h2>
            <p className="intro">{error}</p>
          </div>
        </>
      ) : !ride ? (
        <div aria-busy="true" />
      ) : (
        <>
          <h1 className="page-title">Ride preview</h1>
          <div className="ride-preview-content">
            <div className="ride-preview-summary">
              <dl className="ride-preview-fields">
                <div>
                  <dt>
                    <RideFieldLabel icon="route">Route ID</RideFieldLabel>
                  </dt>
                  <dd>
                    <code>{routeReference(ride.rideId)}</code>
                  </dd>
                </div>
                <div>
                  <dt>
                    <RideFieldLabel icon="status">Status</RideFieldLabel>
                  </dt>
                  <dd className="route-status">
                    {["PUBLISHED", "REQUESTED", "ACCEPTED"].includes(
                      ride.status,
                    ) ? (
                      <span className="route-status-active">Active</span>
                    ) : (
                      rideStatusLabel(ride.status)
                    )}
                  </dd>
                </div>
                <div>
                  <dt>
                    <RideFieldLabel icon="driver">Driver</RideFieldLabel>
                  </dt>
                  <dd>{ride.driverAlias}</dd>
                </div>
                <div>
                  <dt>
                    <RideFieldLabel icon="from">Where from?</RideFieldLabel>
                  </dt>
                  <dd>{ride.departureLabel}</dd>
                </div>
                <div>
                  <dt>
                    <RideFieldLabel icon="departure">Departure</RideFieldLabel>
                  </dt>
                  <dd>{prettyTime(ride.scheduledDepartureAt)}</dd>
                </div>
                <div>
                  <dt>
                    <RideFieldLabel icon="to">Where to?</RideFieldLabel>
                  </dt>
                  <dd>{ride.destinationLabel}</dd>
                </div>
                <div>
                  <dt>
                    <RideFieldLabel icon="expiry">Expiry</RideFieldLabel>
                  </dt>
                  <dd>
                    {serverNow &&
                    ride.expiresAt &&
                    (ride.status === "PUBLISHED" ||
                      ride.status === "REQUESTED") ? (
                      <ExpiryCountdown
                        key={serverNow}
                        expiresAt={ride.expiresAt}
                        serverNow={serverNow}
                      />
                    ) : null}
                  </dd>
                </div>
                {ride.acceptedAt ? (
                  <div>
                    <dt>
                      <RideFieldLabel icon="accepted">Accepted</RideFieldLabel>
                    </dt>
                    <dd>{prettyTime(ride.acceptedAt)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>
                    <RideFieldLabel icon="fit">Fit</RideFieldLabel>
                  </dt>
                  <dd
                    className={
                      riderRoute?.directionFit
                        ? `preview-fit preview-fit-${riderRoute.directionFit.toLowerCase()}`
                        : undefined
                    }
                  >
                    {riderRoute?.directionFit
                      ? riderRoute.directionFit === "GOOD"
                        ? "Good"
                        : "Poor"
                      : null}
                  </dd>
                </div>
                <div>
                  <dt>
                    <RideFieldLabel icon="price">Price</RideFieldLabel>
                  </dt>
                  <dd>A${ride.priceAud}</dd>
                </div>
                {pickupMinutes !== null ? (
                  <div>
                    <dt>
                      <RideFieldLabel icon="pickup-time">
                        To pickup
                      </RideFieldLabel>
                    </dt>
                    <dd>~{pickupMinutes} min</dd>
                  </div>
                ) : null}
                {estimatedArrival ? (
                  <div>
                    <dt>
                      <RideFieldLabel icon="arrival">
                        Est. arrival
                      </RideFieldLabel>
                    </dt>
                    <dd>
                      {new Intl.DateTimeFormat("en-AU", {
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(estimatedArrival)}
                    </dd>
                  </div>
                ) : null}
                {ride.payId ? (
                  <div>
                    <dt>
                      <RideFieldLabel icon="payid">
                        {driverOwned ? "Your PayID" : "Driver PayID"}
                      </RideFieldLabel>
                    </dt>
                    <dd className="preview-payid">
                      <span>
                        {ride.payIdType === "MOBILE"
                          ? "Mobile"
                          : ride.payIdType === "EMAIL"
                            ? "Email"
                            : ride.payIdType === "OTHER"
                              ? "Other"
                              : "PayID"}
                      </span>
                      <code>{ride.payId}</code>
                    </dd>
                  </div>
                ) : null}
                <div
                  className={`preview-field-action${
                    ride.acceptedAt || (!activityRequest && !driverOwned)
                      ? " preview-field-action-wide"
                      : ""
                  }`}
                >
                  <dt>
                    <RideFieldLabel icon="action">Action</RideFieldLabel>
                  </dt>
                  <dd>
                    {readOnly ? null : activityRequest || driverOwned ? (
                      <button
                        type="button"
                        className="preview-end-action"
                        disabled={ending}
                        onClick={() => setEndPromptOpen(true)}
                      >
                        {ending
                          ? driverOwned
                            ? "CANCELLING…"
                            : "WITHDRAWING…"
                          : driverOwned ||
                              activityRequest?.status === "ACCEPTED"
                            ? "CANCEL RIDE"
                            : "WITHDRAW"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="availability-join"
                        disabled={joining}
                        onClick={() => void joinRide()}
                      >
                        {joining ? "JOINING…" : "REQUEST TO JOIN"}
                      </button>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
            {pendingRiderRequests.length ? (
              <section className="driver-request-stack">
                <h2>Rider requests</h2>
                {pendingRiderRequests.map((request) => (
                  <article
                    className="driver-request-card"
                    key={request.requestId}
                  >
                    <dl className="driver-request-fields">
                      <div>
                        <dt>
                          <RideFieldLabel icon="rider">Rider</RideFieldLabel>
                        </dt>
                        <dd>{request.riderAlias}</dd>
                      </div>
                      <div>
                        <dt>
                          <RideFieldLabel icon="requested">
                            Requested
                          </RideFieldLabel>
                        </dt>
                        <dd>
                          {prettyTime(
                            request.createdAt ?? request.requestedDepartureAt,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <RideFieldLabel icon="from">
                            Where from?
                          </RideFieldLabel>
                        </dt>
                        <dd>{locationLabel(request.pickup)}</dd>
                      </div>
                      <div>
                        <dt>
                          <RideFieldLabel icon="to">Where to?</RideFieldLabel>
                        </dt>
                        <dd>{locationLabel(request.destination)}</dd>
                      </div>
                      <div>
                        <dt>
                          <RideFieldLabel icon="fit">Fit</RideFieldLabel>
                        </dt>
                        <dd
                          className={`preview-fit preview-fit-${request.directionFit.toLowerCase()}`}
                        >
                          {request.directionFit === "GOOD" ? "Good" : "Poor"}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <RideFieldLabel icon="request-status">
                            Request status
                          </RideFieldLabel>
                        </dt>
                        <dd>{requestStatusLabel(request.status)}</dd>
                      </div>
                      <div className="driver-request-action">
                        <dt>
                          <RideFieldLabel icon="action">Action</RideFieldLabel>
                        </dt>
                        <dd className="driver-request-buttons">
                          <button
                            type="button"
                            className="secondary"
                            disabled={requestDecision !== null}
                            onClick={() =>
                              void decideRiderRequest(
                                request.requestId,
                                "DECLINE",
                              )
                            }
                          >
                            {requestDecision?.requestId === request.requestId &&
                            requestDecision.decision === "DECLINE"
                              ? "DECLINING…"
                              : "DECLINE"}
                          </button>
                          <button
                            type="button"
                            className="primary compact"
                            disabled={requestDecision !== null}
                            onClick={() =>
                              void decideRiderRequest(
                                request.requestId,
                                "ACCEPT",
                              )
                            }
                          >
                            {requestDecision?.requestId === request.requestId &&
                            requestDecision.decision === "ACCEPT"
                              ? "ACCEPTING…"
                              : "ACCEPT RIDER"}
                          </button>
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </section>
            ) : null}
            {riderDetail ? (
              <section className="driver-request-stack">
                <h2>{driverOwned ? "Rider details" : "Request details"}</h2>
                <article className="driver-request-card">
                  <dl
                    className={`driver-request-fields${
                      driverOwned ? "" : " rider-request-detail-fields"
                    }`}
                  >
                    {driverOwned ? (
                      <div>
                        <dt>
                          <RideFieldLabel icon="rider">Rider</RideFieldLabel>
                        </dt>
                        <dd>{riderDetail.alias}</dd>
                      </div>
                    ) : null}
                    <div className="request-detail-requested">
                      <dt>
                        <RideFieldLabel icon="requested">
                          Requested
                        </RideFieldLabel>
                      </dt>
                      <dd>{prettyTime(riderDetail.requestedAt)}</dd>
                    </div>
                    <div className="request-detail-from">
                      <dt>
                        <RideFieldLabel icon="from">Where from?</RideFieldLabel>
                      </dt>
                      <dd>{locationLabel(riderDetail.pickup)}</dd>
                    </div>
                    {!driverOwned ? (
                      <div className="request-detail-status">
                        <dt>
                          <RideFieldLabel icon="request-status">
                            Request status
                          </RideFieldLabel>
                        </dt>
                        <dd>{requestStatusLabel(riderDetail.status)}</dd>
                      </div>
                    ) : null}
                    <div className="request-detail-to">
                      <dt>
                        <RideFieldLabel icon="to">Where to?</RideFieldLabel>
                      </dt>
                      <dd>{locationLabel(riderDetail.destination)}</dd>
                    </div>
                    <div className="request-detail-fit">
                      <dt>
                        <RideFieldLabel icon="fit">Fit</RideFieldLabel>
                      </dt>
                      <dd
                        className={`preview-fit preview-fit-${riderDetail.directionFit.toLowerCase()}`}
                      >
                        {riderDetail.directionFit === "GOOD" ? "Good" : "Poor"}
                      </dd>
                    </div>
                    {driverOwned ? (
                      <div className="request-detail-status">
                        <dt>
                          <RideFieldLabel icon="request-status">
                            Request status
                          </RideFieldLabel>
                        </dt>
                        <dd>{requestStatusLabel(riderDetail.status)}</dd>
                      </div>
                    ) : null}
                  </dl>
                </article>
              </section>
            ) : null}
            {poorFitPromptOpen ? (
              <PoorFitPrompt
                close={() => setPoorFitPromptOpen(false)}
                confirm={() => {
                  setPoorFitPromptOpen(false);
                  void joinRide(true);
                }}
              />
            ) : null}
            <LocationAge location={ride.driverLocation} />
            <JourneyMap
              fitPins={[
                ...(ride.plannedRoute
                  ? [ride.plannedRoute.origin, ride.plannedRoute.destination]
                  : []),
                ...(riderRoute
                  ? [riderRoute.pickup, riderRoute.destination]
                  : []),
              ]}
              pins={[
                ...(ride.plannedRoute
                  ? [
                      ride.driverLocation ?? ride.plannedRoute.origin,
                      ride.plannedRoute.destination,
                    ]
                  : []),
                ...(riderRoute
                  ? [riderRoute.pickup, riderRoute.destination]
                  : []),
              ]}
              markerKinds={
                ride.plannedRoute && riderRoute
                  ? ["driver", "destination", "pickup", "destination"]
                  : ride.plannedRoute
                    ? ["driver", "destination"]
                    : riderRoute
                      ? ["pickup", "destination"]
                      : undefined
              }
              lines={lines}
              roadPathAttribution={Boolean(
                activeDriverRoadPath?.length || roadPath?.length,
              )}
            />
            <div className="route-key">
              {ride.plannedRoute ? (
                <span>
                  <i className="route-key-driver" />
                  Driver route
                </span>
              ) : null}
              {riderRoute ? (
                <span>
                  <i className="route-key-rider" />
                  Your route
                </span>
              ) : null}
            </div>
            {endError ? <p className="error">{endError}</p> : null}
          </div>
        </>
      )}
    </section>
  );
}
