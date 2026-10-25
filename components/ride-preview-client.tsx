"use client";
import ParticipantName from "./participant-name";
import { VehiclePlatePrompt, RideVehicle } from "./vehicle-details";
import { fareLabel } from "@/lib/fare";
import { REQUEST_MESSAGE_HINT, requestedRideUrl } from "@/lib/messaging-types";
import { requestTarget, pickupTarget } from "@/lib/ride-updates";
import RideRating, { RatingBadge } from "./ride-rating";
import RideStatusText from "./ride-status-text";
import RideMessages, { ReportConcern } from "./ride-messages";
import { DRIVER_ROUTE, RIDER_ROUTE } from "@/lib/map-style";
import DepartureCountdown from "./departure-countdown";
import ExtraDriving from "./extra-driving";

import { participantStatusLabel } from "@/lib/ride-status";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CancelPrompt from "./cancel-prompt";
import PoorFitPrompt from "./poor-fit-prompt";
import LocationAge from "./location-age";
import { mapLocationText } from "@/lib/map-label";
import { directionsUrl } from "@/lib/directions";
import RideFieldLabel from "./ride-field-label";
import {
  CompleteRide,
  PickupConfirmation,
  Message,
  RouteRequiredPrompt,
} from "./ride-journey-controls";
import CopyPayId from "./copy-payid";
import {
  ApiError,
  apiErrorMessage,
  CONNECTION_MESSAGE,
  cocowheelsApi,
} from "@/lib/api-client";
import type { PayIdType, Pin, Ride } from "@/lib/client-types";
import {
  cacheRoadPath,
  cacheRiderRoadPath,
  cachedRiderRoadPath,
  riderSearchDraft,
  riderPreviewRoute,
} from "@/lib/ride-preview-cache";

const JourneyMap = dynamic(() => import("./journey-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});

type PreviewRide = {
  driverRating?: Ride["driverRating"];
  isSample?: boolean;
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
  paymentMethod?: "PAYID" | "CASH";
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
    isSample: ride.isSample,
    driverLocation: ["ACCEPTED", "RIDE_ACTIVE", "CO_RIDE_ACTIVE"].includes(ride.status)
      ? ride.driverLocation : undefined,
    driverAlias: ride.driverAlias,
    driverRating: ride.driverRating,
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
    paymentMethod: ride.paymentMethod,
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
  const [driverDurationSeconds, setDriverDurationSeconds] = useState<
    number | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [routeRequiredPromptOpen, setRouteRequiredPromptOpen] = useState(false);
  const [selfJoinPromptOpen, setSelfJoinPromptOpen] = useState(false);
  const [poorFitPromptOpen, setPoorFitPromptOpen] = useState(false);
  const [roleChangePromptOpen, setRoleChangePromptOpen] = useState(false);
  const [joinFailurePromptOpen, setJoinFailurePromptOpen] = useState<
    string | null
  >(null);
  const [joining, setJoining] = useState(false);
  const [endPromptOpen, setEndPromptOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [requestDecision, setRequestDecision] = useState<{
    requestId: string;
    decision: "ACCEPT" | "DECLINE";
  } | null>(null);
  const [requestDecisionError, setRequestDecisionError] = useState<
    string | null
  >(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [openRequests, setOpenRequests] = useState<Record<string, boolean>>({});
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
  const driverRide = participantRide ?? activityRide;
  const riderDetail = driverOwned
    ? driverRide?.rider
      ? {
          alias: driverRide.rider.alias,
          pickup: driverRide.rider.pickup,
          destination: driverRide.rider.destination,
          requestedAt:
            acceptedDriverRequest?.createdAt ??
            driverRide.rider.requestedDepartureAt,
          directionFit: driverRide.rider.directionFit,
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
      const selectedRequest = participantRide?.requests?.find(
        (request) =>
          request.requestId === selectedRequestId &&
          request.status === "PENDING",
      );
      return participantRide?.rider
        ? {
            pickup: participantRide.rider.pickup,
            destination: participantRide.rider.destination,
            directionFit: participantRide.rider.directionFit,
          }
        : selectedRequest
          ? {
              pickup: selectedRequest.pickup,
              destination: selectedRequest.destination,
              directionFit: selectedRequest.directionFit,
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
  }, [
    activityRequest,
    driverOwned,
    participantRide,
    rideId,
    selectedRequestId,
  ]);
  const [riderRoadResult, setRiderRoadResult] = useState<{
    key: string;
    points: Pin[];
    durationSeconds: number | null;
  } | null>(null);
  const [pickupDurationSeconds, setPickupDurationSeconds] = useState<
    number | null
  >(null);
  const [driverRoadPath, setDriverRoadPath] = useState<{
    coordinates: string;
    points: Pin[];
  } | null>(null);

  const privateRide = participantRide ?? activityRide;
  const [previewClock, setPreviewClock] = useState(() => Date.now());
  const ride = useMemo<PreviewRide | null>(() => {
    if (!privateRide) return publicRide ? { ...publicRide, driverLocation: undefined } : null;
    const next = previewFromActivity(privateRide);
    if (privateRide.pickupEstablished && privateRide.tracking?.location)
      next.driverLocation = privateRide.tracking.location;
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
            setPreviewClock(Date.parse(result.serverNow) || Date.now());
            setError(null);
          }
        })
        .catch((reason) => {
          if (cancelled) return;
          if (
            reason instanceof ApiError &&
            [401, 403, 404].includes(reason.status)
          )
            setPublicRide(null);
          setError(
            reason instanceof ApiError && reason.status === 404
              ? "This ride is no longer available."
              : apiErrorMessage(
                  reason,
                  "We couldn’t load this ride. Please try again.",
                ),
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
  const roadPath =
    riderRoadResult?.key === routeKey
      ? riderRoadResult?.points
      : riderRoute
        ? cachedRiderRoadPath(riderRoute.pickup, riderRoute.destination)
        : null;
  const riderDurationSeconds =
    riderRoadResult?.key === routeKey
      ? (riderRoadResult?.durationSeconds ?? null)
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
    if (!riderRoute || !routeKey || riderRoadResult?.key === routeKey) return;
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
        setRiderRoadResult({ key: routeKey, points, durationSeconds });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [riderRoute, riderRoadResult?.key, routeKey]);

  useEffect(() => {
    if (
      ride?.isSample ||
      !ride?.plannedRoute ||
      !riderRoute ||
      ![
        "PUBLISHED",
        "REQUESTED",
        "ACCEPTED",
        "RIDE_ACTIVE",
        "CO_RIDE_ACTIVE",
      ].includes(ride.status)
    )
      return;
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
  }, [
    ride?.isSample,
    ride?.plannedRoute,
    ride?.driverLocation,
    ride?.status,
    riderRoute,
  ]);

  useEffect(() => {
    if (
      !driverRouteInput ||
      driverRoadPath?.coordinates === driverRouteCoordinates
    )
      return;
    let cancelled = false;
    void cocowheelsApi<RoutePreviewResponse>("/api/route-preview", {
      method: "POST",
      body: JSON.stringify(driverRouteInput),
    })
      .then(({ points, durationSeconds }) => {
        if (cancelled || points.length < 2) return;
        setDriverDurationSeconds(durationSeconds);
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
  }, [driverRouteCoordinates, driverRouteInput, driverRoadPath?.coordinates]);

  const activeDriverRoadPath =
    driverRoadPath?.coordinates === driverRouteCoordinates
      ? driverRoadPath.points
      : null;
  const rideIsActive = Boolean(
    ride &&
    [
      "PUBLISHED",
      "REQUESTED",
      "ACCEPTED",
      "RIDE_ACTIVE",
      "CO_RIDE_ACTIVE",
    ].includes(ride.status),
  );
  const pickupMinutes =
    !rideIsActive ||
    (ride &&
      ["PUBLISHED", "REQUESTED"].includes(ride.status) &&
      Date.parse(ride.scheduledDepartureAt) > previewClock) ||
    privateRide?.pickupEstablished ||
    pickupDurationSeconds === null
      ? null
      : Math.max(1, Math.round(pickupDurationSeconds / 60));
  const durationSeconds = driverOwned
    ? driverDurationSeconds
    : riderDurationSeconds;
  const estimatedDuration =
    durationSeconds === null
      ? "—"
      : `${Math.max(1, Math.round(durationSeconds / 60))} min`;

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
      if (
        reason instanceof ApiError &&
        reason.code === "VERIFICATION_CANCELLED"
      )
        return;
      if (!(reason instanceof ApiError && reason.status === 401)) {
        setJoinFailurePromptOpen(
          apiErrorMessage(reason, "We couldn’t send your request."),
        );
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
      const result = await cocowheelsApi<{ ride: Ride }>(
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
      window.location.assign(
        requestedRideUrl(ride.rideId, result.ride.request?.requestId),
      );
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.code === "VERIFICATION_CANCELLED"
      )
        return;
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
      else
        setJoinFailurePromptOpen(
          apiErrorMessage(reason, "We couldn’t send your request."),
        );
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
    } catch (reason) {
      setEndError(
        apiErrorMessage(
          reason,
          driverOwned
            ? "We couldn’t cancel this ride. Please try again."
            : "We couldn’t withdraw this request. Please try again.",
        ),
      );
      setEnding(false);
      setEndPromptOpen(false);
    }
  }

  const [plateRequest, setPlateRequest] = useState<string | null>(null);
  async function decideRiderRequest(
    requestId: string,
    decision: "ACCEPT" | "DECLINE",
    plate?: string,
  ) {
    setRequestDecision({ requestId, decision });
    try {
      await cocowheelsApi(
        `/api/rides/${encodeURIComponent(rideId)}/requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ decision, plate }),
        },
      );
      window.location.reload();
    } catch (reason) {
      setRequestDecision(null);
      if (plate !== undefined) throw reason;
      if (reason instanceof ApiError && reason.code === "VEHICLE_PLATE_REQUIRED") {
        setPlateRequest(requestId);
        return;
      }
      setRequestDecisionError(
        apiErrorMessage(reason, "We couldn’t update this request."),
      );
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
              ...DRIVER_ROUTE,
            },
          ]
        : []),
      ...(riderRoute
        ? [
            {
              points: roadPath?.length
                ? roadPath
                : [riderRoute.pickup, riderRoute.destination],
              ...RIDER_ROUTE,
            },
          ]
        : []),
    ];
  }, [ride, activeDriverRoadPath, riderRoute, roadPath]);

  return (
    <section className="ride-preview" aria-live={ride ? undefined : "polite"}>
      {routeRequiredPromptOpen ? (
        <RouteRequiredPrompt close={() => setRouteRequiredPromptOpen(false)} />
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
              Cancel your offered ride before requesting a ride.
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
            <h2 id="join-failure-title">{joinFailurePromptOpen}</h2>
            <div className="location-prompt-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setJoinFailurePromptOpen(null)}
              >
                OKAY
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {plateRequest && <VehiclePlatePrompt close={() => setPlateRequest(null)} confirm={async plate => { await decideRiderRequest(plateRequest, "ACCEPT", plate); setPlateRequest(null); }} />}
      {requestDecisionError ? (
        <div className="location-prompt-backdrop" role="presentation">
          <section
            className="location-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-decision-error-title"
          >
            <h2 id="request-decision-error-title">{requestDecisionError}</h2>
            <div className="location-prompt-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setRequestDecisionError(null)}
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
      {error && ride ? (
        <p className="stale-notice" role="status">
          {error !== CONNECTION_MESSAGE ? `${error} ` : ""}Showing previously
          loaded ride details.
        </p>
      ) : null}
      {error && !ride ? (
        <>
          <div className="ride-preview-content">
            <h2>Not available</h2>
            <p className="intro">{error}</p>
          </div>
        </>
      ) : !ride ? (
        <div aria-busy="true" />
      ) : (
        <>
          <div className="ride-preview-content">
            <div className="ride-selection-map" id="ride-comparison-map">
              <JourneyMap
                followZoom={ride.isSample ? 14 : 16}
                recenterPin={
                  privateRide?.pickupEstablished &&
                  ride.status === "CO_RIDE_ACTIVE"
                    ? ride.driverLocation
                    : undefined
                }
                followPins={
                  ride.driverLocation &&
                  riderRoute &&
                  ["ACCEPTED", "RIDE_ACTIVE", "CO_RIDE_ACTIVE"].includes(
                    ride.status,
                  )
                    ? privateRide?.pickupEstablished
                      ? [ride.driverLocation]
                      : [ride.driverLocation, riderRoute.pickup]
                    : undefined
                }
                fitPins={[
                  ...(ride.driverLocation ? [ride.driverLocation] : []),
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
                    ? [
                        privateRide?.pickupEstablished &&
                        privateRide.tracking?.location
                          ? privateRide.tracking.location
                          : riderRoute.pickup,
                        riderRoute.destination,
                      ]
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
                markerLabels={[
                  ...(ride.plannedRoute
                    ? [
                        riderRoute
                          ? undefined
                          : mapLocationText(ride.plannedRoute.origin),
                        riderRoute
                          ? undefined
                          : mapLocationText(ride.plannedRoute.destination),
                      ]
                    : []),
                  ...(riderRoute
                    ? [
                        pickupMinutes !== null
                          ? {
                              etaMinutes: pickupMinutes,
                              text: mapLocationText(riderRoute.pickup),
                            }
                          : mapLocationText(riderRoute.pickup),
                        mapLocationText(riderRoute.destination),
                      ]
                    : []),
                ]}
                labelPins={[
                  ...(ride.plannedRoute
                    ? [ride.plannedRoute.origin, ride.plannedRoute.destination]
                    : []),
                  ...(riderRoute
                    ? [riderRoute.pickup, riderRoute.destination]
                    : []),
                ]}
                lines={lines}
                roadPathAttribution={Boolean(
                  activeDriverRoadPath?.length || roadPath?.length,
                )}
              />
            </div>
            <div
              className="ride-selection-route-key"
              aria-label="Map route colours"
            >
              {rideIsActive ? (
                <LocationAge
                  location={ride.driverLocation}
                  label={privateRide?.pickupEstablished ? "Trip" : "Driver"}
                />
              ) : null}
              {riderRoute ? (
                <span>
                  <i className="ride-selection-route-rider" />
                  {driverOwned ? "Rider’s route" : "Your route"}
                </span>
              ) : null}
              {ride.plannedRoute ? (
                <span>
                  <i className="ride-selection-route-driver" />
                  Driver route
                </span>
              ) : null}
            </div>
            {!readOnly && privateRide ? (
              <div
                id={
                  !driverOwned &&
                  privateRide.request?.status === "ACCEPTED" &&
                  !privateRide.pickupEstablished
                    ? pickupTarget(privateRide.rideId)
                    : undefined
                }
              >
                <PickupConfirmation ride={privateRide} driver={driverOwned} />
                {!driverOwned && <RideVehicle vehicle={privateRide.vehicle} />}
              </div>
            ) : null}
            {privateRide ? (
              <RideRating
                key={privateRide.rideId}
                rideId={privateRide.rideId}
                state={privateRide.rating}
              />
            ) : null}
            <div className="ride-preview-summary">
              {privateRide?.conversations
                ?.filter(
                  (c) =>
                    !driverOwned ||
                    c.requestId === acceptedDriverRequest?.requestId,
                )
                .map((c) => (
                  <RideMessages
                    key={c.requestId}
                    rideId={rideId}
                    summary={c}
                    rider={!driverOwned}
                  />
                ))}
              <dl className="ride-preview-fields">
                <div>
                  <dt>
                    <RideFieldLabel icon="status">Status</RideFieldLabel>
                  </dt>
                  <dd className="route-status">
                    <RideStatusText
                      label={participantStatusLabel(
                        ride.status,
                        driverOwned ? undefined : activityRequest?.status,
                      )}
                    />
                  </dd>
                </div>
                <div>
                  <dt>
                    <RideFieldLabel icon="from">
                      {driverOwned && riderDetail
                        ? "Rider pickup"
                        : "Where from?"}
                    </RideFieldLabel>
                  </dt>
                  <dd>
                    {driverOwned && riderDetail
                      ? locationLabel(riderDetail.pickup)
                      : !driverOwned && activityRequest
                        ? locationLabel(activityRequest.pickup)
                        : ride.departureLabel}
                    {driverOwned && riderDetail && rideIsActive ? (
                      <a
                        className="ride-directions"
                        href={directionsUrl(riderDetail.pickup)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Directions to rider pickup in Google Maps (opens a new tab)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d="m21 3-6 18-4-8-8-4 18-6Z" />
                        </svg>
                        Google Maps
                      </a>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>
                    <RideFieldLabel icon={driverOwned ? "arrival" : "driver"}>
                      {driverOwned ? "Estimated duration" : "Driver"}
                    </RideFieldLabel>
                  </dt>
                  <dd>
                    {driverOwned ? (
                      estimatedDuration
                    ) : (
                      <>
                        <ParticipantName name={ride.driverAlias} />{" "}
                        <RatingBadge summary={ride.driverRating} />
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>
                    <RideFieldLabel icon="to">
                      {driverOwned && riderDetail
                        ? "Rider drop-off"
                        : "Where to?"}
                    </RideFieldLabel>
                  </dt>
                  <dd>
                    {driverOwned && riderDetail
                      ? locationLabel(riderDetail.destination)
                      : !driverOwned && activityRequest
                        ? locationLabel(activityRequest.destination)
                        : ride.destinationLabel}
                    {driverOwned && riderDetail && rideIsActive ? (
                      <a
                        className="ride-directions"
                        href={directionsUrl(riderDetail.destination)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Directions to rider drop-off in Google Maps (opens a new tab)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d="m21 3-6 18-4-8-8-4 18-6Z" />
                        </svg>
                        Google Maps
                      </a>
                    ) : null}
                  </dd>
                </div>
                {driverOwned && rideIsActive && !privateRide?.pickupEstablished ? (
                  <div className="preview-driver-departure">
                    <dt><RideFieldLabel icon="departure">Departure</RideFieldLabel></dt>
                    <dd><DepartureCountdown scheduledAt={ride.scheduledDepartureAt} /></dd>
                  </div>
                ) : null}
                {!driverOwned ? (
                  <div>
                    <dt>
                      <RideFieldLabel icon="arrival">
                        Estimated duration
                      </RideFieldLabel>
                    </dt>
                    <dd>{estimatedDuration}</dd>
                  </div>
                ) : null}
                {!driverOwned && ["PUBLISHED", "REQUESTED"].includes(ride.status) ? (
                  <div className="preview-rider-departure">
                    <dt><RideFieldLabel icon="departure">Departure</RideFieldLabel></dt>
                    <dd><DepartureCountdown scheduledAt={ride.scheduledDepartureAt} /></dd>
                  </div>
                ) : null}
                <div>
                  <dt>
                    <RideFieldLabel icon="price">Fare</RideFieldLabel>
                  </dt>
                  <dd>{fareLabel(ride.priceAud)}</dd>
                </div>
                {!driverOwned && ride.priceAud > 0 &&
                (ride.payId ||
                  ride.paymentMethod ||
                  (activityRequest && rideIsActive)) ? (
                  <div className="preview-field-payment">
                    <dt>
                      <RideFieldLabel icon="payid">
                        {ride.payId ? "Driver PayID" : "Payment"}
                      </RideFieldLabel>
                    </dt>
                    <dd className="preview-payid">
                      <span>
                        {!ride.payId
                          ? ride.paymentMethod === "PAYID"
                            ? "PayID"
                            : ride.paymentMethod === "CASH"
                              ? "Cash"
                              : "PayID"
                          : ride.payIdType === "MOBILE"
                            ? "Mobile"
                            : ride.payIdType === "EMAIL"
                              ? "Email"
                              : ride.payIdType === "OTHER"
                                ? ride.isSample
                                  ? "ABN"
                                  : "Other"
                                : "PayID"}
                      </span>
                      {ride.payId ? (
                        <CopyPayId value={ride.payId} />
                      ) : ride.paymentMethod !== "CASH" && rideIsActive ? (
                        <span>Visible after pickup confirmation</span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {driverOwned && ride.priceAud > 0 && ride.payId ? (
                  <div className="preview-driver-payment">
                    <dt>
                      <RideFieldLabel icon="payid">Your PayID</RideFieldLabel>
                    </dt>
                    <dd className="preview-payid">
                      <span>
                        {ride.payIdType === "MOBILE"
                          ? "Mobile"
                          : ride.payIdType === "EMAIL"
                            ? "Email"
                            : "Other"}
                      </span>
                      <code className="payid-value">{ride.payId}</code>
                    </dd>
                  </div>
                ) : null}
                {!readOnly &&
                !["COMPLETED", "CANCELLED", "EXPIRED"].includes(ride.status) ? (
                  <div
                    id="ride-actions"
                    tabIndex={-1}
                    className="preview-field-action preview-field-action-wide"
                  >
                    <dt>
                      <RideFieldLabel icon="action">Action</RideFieldLabel>
                    </dt>
                    <dd
                      className={`ride-action-buttons${!readOnly && !activityRequest && !driverOwned ? " request-action" : ""}`}
                    >
                      {!readOnly && !activityRequest && !driverOwned ? (
                        <p className="request-message-hint">
                          {REQUEST_MESSAGE_HINT}
                        </p>
                      ) : null}
                      {!readOnly &&
                      privateRide &&
                      (driverOwned || activityRequest?.status === "ACCEPTED") &&
                      ride.status === "CO_RIDE_ACTIVE" &&
                      privateRide.pickupEstablished ? (
                        <CompleteRide ride={privateRide} />
                      ) : null}
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
                              : "WITHDRAW REQUEST"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="availability-join"
                          disabled={joining}
                          onClick={() => void joinRide()}
                        >
                          {joining ? "REQUESTING…" : "REQUEST TO JOIN"}
                        </button>
                      )}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
            {pendingRiderRequests.length ? (
              <section
                className="driver-request-stack driver-request-section"
                aria-labelledby="rider-requests-heading"
              >
                <h2 id="rider-requests-heading">Rider requests</h2>
                {pendingRiderRequests.map((request) => (
                  <details
                    className="driver-request-card driver-request-accordion"
                    key={request.requestId}
                    onToggle={(event) => {
                      if (event.target !== event.currentTarget) return;
                      const open = event.currentTarget.open;
                      setOpenRequests((previous) => ({
                        ...previous,
                        [request.requestId]: open,
                      }));
                    }}
                  >
                    <summary>
                      <RideFieldLabel icon="rider">
                        <ParticipantName name={request.riderAlias} />
                      </RideFieldLabel>
                      <span className="request-summary-status">
                        {requestStatusLabel(request.status)}
                      </span>
                    </summary>
                    {privateRide?.conversations
                      ?.filter((c) => c.requestId === request.requestId)
                      .map((c) => (
                        <RideMessages
                          key={c.requestId}
                          rideId={rideId}
                          summary={c}
                          rider={false}
                        />
                      ))}
                    <dl className="driver-request-fields">
                      <div id={requestTarget(request.requestId)}>
                        <dt>
                          <RideFieldLabel icon="rider">Rider</RideFieldLabel>
                        </dt>
                        <dd>
                          <ParticipantName name={request.riderAlias} />{" "}
                          <RatingBadge summary={request.rating} />
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <RideFieldLabel icon="from">
                            Where from?
                          </RideFieldLabel>
                        </dt>
                        <dd>
                          {locationLabel(request.pickup)}
                          <a
                            className="ride-directions"
                            href={directionsUrl(request.pickup)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Directions to rider pickup in Google Maps (opens a new tab)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path d="m21 3-6 18-4-8-8-4 18-6Z" />
                            </svg>
                            Google Maps
                          </a>
                        </dd>
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
                        <dt className="request-route-heading">
                          <RideFieldLabel icon="to">Where to?</RideFieldLabel>
                          <button
                            type="button"
                            className="secondary request-route-button"
                            aria-pressed={
                              selectedRequestId === request.requestId
                            }
                            aria-controls="ride-comparison-map"
                            onClick={() => {
                              const showRoute =
                                selectedRequestId !== request.requestId;
                              setSelectedRequestId(
                                showRoute ? request.requestId : null,
                              );
                              setPickupDurationSeconds(null);
                            }}
                          >
                            {selectedRequestId === request.requestId
                              ? "Hide route"
                              : "Show route"}
                          </button>
                        </dt>
                        <dd>
                          {locationLabel(request.destination)}
                          <a
                            className="ride-directions"
                            href={directionsUrl(request.destination)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Directions to rider drop-off in Google Maps (opens a new tab)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path d="m21 3-6 18-4-8-8-4 18-6Z" />
                            </svg>
                            Google Maps
                          </a>
                        </dd>
                      </div>
                      <div className="request-extra-driving">
                        <dt>
                          <RideFieldLabel icon="requested">
                            Extra driving
                          </RideFieldLabel>
                        </dt>
                        <dd>
                          {ride?.plannedRoute ? (
                            <ExtraDriving
                              origin={ride.plannedRoute.origin}
                              destination={ride.plannedRoute.destination}
                              pickup={request.pickup}
                              dropoff={request.destination}
                              expanded={Boolean(
                                openRequests[request.requestId],
                              )}
                            />
                          ) : (
                            "Estimate unavailable"
                          )}
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
                  </details>
                ))}
              </section>
            ) : null}
            {driverOwned && riderDetail ? (
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
                  </dl>
                </article>
              </section>
            ) : null}
            {privateRide ? <ReportConcern rideId={rideId} /> : null}
            {poorFitPromptOpen ? (
              <PoorFitPrompt
                close={() => setPoorFitPromptOpen(false)}
                confirm={() => {
                  setPoorFitPromptOpen(false);
                  void joinRide(true);
                }}
              />
            ) : null}
            {endError ? (
              <Message text={endError} close={() => setEndError(null)} />
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
