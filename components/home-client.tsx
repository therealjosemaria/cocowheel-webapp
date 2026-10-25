"use client";
import ParticipantName from "./participant-name";
import { FindRiders, PostRideRequest, LiftRequestSwitchPrompt, openLiftRequestId } from "./rider-demands";
import { VehiclePlatePrompt } from "./vehicle-details";
import ScheduleFields from "./schedule-fields";
import { RouteRequiredPrompt } from "./ride-journey-controls";
import { initialDeparture, lastDepartureDate, sydneyDateTime, sydneyInstant } from "@/lib/ride-schedule";
import { departureLabel, departureTone } from "@/lib/departure-label";
import ContributionChoice from "./contribution-choice";
import PaymentFields from "./payment-fields";
import { RouteFields } from "./route-fields";
import SaveSearchRoute from "./save-search-route";
import { fareLabel, validFare, CONTRIBUTION_ERROR } from "@/lib/fare";
import { REQUEST_MESSAGE_HINT, requestedRideUrl } from "@/lib/messaging-types";
import { RatingBadge } from "./ride-rating";
import { Message } from "./ride-journey-controls";
import { DRIVER_ROUTE, RIDER_ROUTE } from "@/lib/map-style";
import ActiveRideLink from "./active-ride-link";
import { mapLocationText } from "@/lib/map-label";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CancelPrompt from "./cancel-prompt";
import PoorFitPrompt from "./poor-fit-prompt";
import CopyPayId from "./copy-payid";
import { payIdInputError } from "@/lib/input-validation";
import {
  ApiError,
  apiErrorMessage,
  CONNECTION_MESSAGE,
  cocowheelsApi,
} from "@/lib/api-client";
import type { Candidate, PayIdType, Pin, Ride } from "@/lib/client-types";
import { routeReference } from "@/lib/route-id";
import {
  cacheRoadPath,
  cachedRoadPath,
  consumeRiderSearchReturn,
  clearRiderSearchDraft,
  riderSearchDraft,
  riderSearchDraftTtlMs,
  saveRiderPreviewRoute,
  saveRiderSearchDraft,
} from "@/lib/ride-preview-cache";

const JourneyMap = dynamic(() => import("./journey-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});
type Role = "DRIVER" | "RIDER";
type FormPin = "origin" | "destination" | "pickup" | "riderDestination";
const prettyTime = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
const locationText = (pin?: Pin) =>
  pin
    ? (pin.label ?? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`)
    : "Select a location";
const canonicalPin = (pin: Pin) => ({
  latitude: pin.latitude,
  longitude: pin.longitude,
});
const placeCachePrefix = "cocowheels:place-label:v1:";
const countryPreferenceKey = "cocowheels:country-preference:v1";
const countryPreferenceTtlMs = 7 * 24 * 60 * 60 * 1_000;
type CachedPlace = { label: string; countryCode?: string };
const placeCacheKey = (pin: Pin) =>
  `${placeCachePrefix}${pin.latitude.toFixed(5)}:${pin.longitude.toFixed(5)}`;
function cachedPlace(pin: Pin): CachedPlace | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed: unknown = JSON.parse(
      window.sessionStorage.getItem(placeCacheKey(pin)) ?? "null",
    );
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("label" in parsed) ||
      typeof parsed.label !== "string" ||
      !parsed.label.trim()
    )
      return null;
    return {
      label: parsed.label,
      ...("countryCode" in parsed && typeof parsed.countryCode === "string"
        ? { countryCode: parsed.countryCode }
        : {}),
    };
  } catch {
    return null;
  }
}
function cachePlace(pin: Pin, place: CachedPlace) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(placeCacheKey(pin), JSON.stringify(place));
  } catch {
    // Location labelling still works when browser storage is unavailable.
  }
}
function storedCountryPreference() {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(countryPreferenceKey) ?? "null",
    );
    if (
      !value ||
      typeof value !== "object" ||
      !("countryCode" in value) ||
      !("expiresAt" in value) ||
      typeof value.countryCode !== "string" ||
      !/^[a-z]{2}$/i.test(value.countryCode) ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(countryPreferenceKey);
      return null;
    }
    return value.countryCode.toLowerCase();
  } catch {
    return null;
  }
}
function storeCountryPreference(countryCode: string) {
  if (typeof window === "undefined" || !/^[a-z]{2}$/i.test(countryCode)) return;
  try {
    window.localStorage.setItem(
      countryPreferenceKey,
      JSON.stringify({
        countryCode: countryCode.toLowerCase(),
        expiresAt: Date.now() + countryPreferenceTtlMs,
      }),
    );
  } catch {
    // Searching still works if local browser storage is unavailable.
  }
}
const humanError = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : "REQUEST_FAILED";
  const messages: Record<string, string> = {
    VERIFICATION_CANCELLED: "",
    UNIVERSITY_VERIFICATION_REQUIRED: "Please verify your email to continue.",
    SERVICE_UNAVAILABLE: CONNECTION_MESSAGE,
    OPEN_ITEM_EXISTS: "You already have an active ride or request.",
    INVALID_DEPARTURE_TIME: "Choose a future departure within the next three months.",
    INVALID_REQUEST_TIME: "Choose a date from today through the next three months.",
    FRESH_LOCATIONS_REQUIRED:
      "Both people need to update their location before the driver can start.",
    LOCATION_STALE: "Your location is out of date. Update it to continue.",
    LOCATION_ACCURACY_REJECTED:
      "Location accuracy is too low. Move somewhere with a clearer signal and try again.",
    CO_RIDE_CODE_INVALID: "That code doesn’t match. Check it and try again.",
    CO_RIDE_CODE_RATE_LIMITED:
      "Please wait a moment before another code attempt.",
    PAYID_UNAVAILABLE: "PayID details are not available.",
    PAYID_REQUIRED: "Enter your PayID before offering a ride.",
    INVALID_PAYID: "Check your PayID format and length.",
    INVALID_FIXED_PRICE: CONTRIBUTION_ERROR,
    REQUEST_TIME_INCOMPATIBLE:
      "That requested time is not compatible with the driver’s planned departure.",
  };
  return messages[code] ?? apiErrorMessage(error);
};

export default function HomeClient({
  initialScreen = "HOME",
  initialMatch,
  initialNotice,
}: {
  initialScreen?: "HOME" | "DRIVER" | "RIDER";
  initialMatch?: { rideId: string; origin: Pin; destination: Pin; scheduledDepartureAt?: string };
  initialNotice?: string;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<"HOME" | "DRIVER" | "RIDER">(
    initialScreen,
  );
  const [role, setRole] = useState<Role | null>(
    initialScreen === "DRIVER"
      ? "DRIVER"
      : initialScreen === "RIDER"
        ? "RIDER"
        : null,
  );
  const [ride, setRide] = useState<Ride | null>(null);
  const [homeCurrent, setHomeCurrent] = useState<
    Array<{
      role: Role;
      ride: Ride;
    }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialNotice ?? null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(
    null,
  );
  const [countryPreference, setCountryPreference] = useState<string | null>(
    null,
  );
  const [driverPins, setDriverPins] = useState<{
    origin?: Pin;
    destination?: Pin;
  }>({});
  const [riderPins, setRiderPins] = useState<{
    pickup?: Pin;
    destination?: Pin;
  }>(initialMatch ? { pickup: initialMatch.origin, destination: initialMatch.destination } : {});
  const [price, setPrice] = useState("5");
  const [contribution, setContribution] = useState(false);
  const [driverSchedule, setDriverSchedule] = useState(initialDeparture);
  const [payId, setPayId] = useState("");
  const [payIdType, setPayIdType] = useState<PayIdType>("MOBILE");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(initialMatch?.rideId ?? null);
  const pendingEmailMatch = useRef(initialMatch?.rideId ?? null);
  const [searching, setSearching] = useState(false);
  const [riderSelectionOpen, setRiderSelectionOpen] = useState(Boolean(initialMatch));
  const [riderTime, setRiderTime] = useState<string | null>(null);
  const [riderDate, setRiderDate] = useState(() => {
    const today = sydneyDateTime().date;
    const date = sydneyDateTime(initialMatch?.scheduledDepartureAt ?? Date.now()).date;
    return date < today ? today : date;
  });
  const [code, setCode] = useState("");
  const [ownOfferPromptOpen, setOwnOfferPromptOpen] = useState(false);
  const [roleChangePromptOpen, setRoleChangePromptOpen] = useState(false);
  const [liftSwitchId, setLiftSwitchId] = useState<string | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<"DRIVER" | "RIDER">(
    "RIDER",
  );
  const [routeRequiredPromptOpen, setRouteRequiredPromptOpen] =
    useState(false);
  const [riderRoute, setRiderRoute] = useState<{
    coordinates: string;
    points: Pin[];
    durationSeconds: number | null;
  } | null>(null);
  const placeLookupIds = useRef<Record<FormPin, number>>({
    origin: 0,
    destination: 0,
    pickup: 0,
    riderDestination: 0,
  });
  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.rideId === selected) ?? null,
    [candidates, selected],
  );
  useEffect(() => {
    if (!initialMatch && !initialNotice) return;
    const timer = window.setTimeout(() => window.dispatchEvent(
      new CustomEvent("cocowheels:ride-tab", { detail: "rider" }),
    ), 0);
    return () => window.clearTimeout(timer);
  }, [initialMatch, initialNotice]);

  const begin = useCallback(
    (roleChoice: Role) => {
      if (ride) return;
      setRole(roleChoice);
      if (roleChoice === "RIDER") {
        const draft = riderSearchDraft();
        if (draft) {
          setRiderSelectionOpen(true);
          setRiderPins((state) =>
            state.pickup || state.destination
              ? state
              : { pickup: draft.pickup, destination: draft.destination },
          );
          setRiderTime(draft.departureAt);
          setRiderDate(draft.departureDate ?? sydneyDateTime().date);
        } else {
          setRiderSelectionOpen(false);
          setRiderTime(null);
        }
      }
      setScreen(roleChoice === "DRIVER" ? "DRIVER" : "RIDER");
      window.dispatchEvent(
        new CustomEvent("cocowheels:ride-tab", {
          detail: roleChoice === "DRIVER" ? "driver" : "rider",
        }),
      );
      setError(null);
    },
    [ride],
  );

  async function refreshCurrent() {
    try {
      const result = await cocowheelsApi<{
        current: { role: Role; ride: Ride } | null;
        currents: Array<{ role: Role; ride: Ride }>;
      }>("/api/current");
      setServiceAvailable(true);
      setServiceError(null);
      setHomeCurrent(result.currents);
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
        setServiceAvailable(true);
        setServiceError(null);
        setHomeCurrent([]);
        setRide(null);
        return;
      }
      setServiceAvailable(false);
      setServiceError(
        apiErrorMessage(
          reason,
          "We couldn’t refresh your ride. Please try again.",
        ),
      );
    }
  }
  useEffect(() => {
    if (initialMatch || initialNotice) return;
    if (!consumeRiderSearchReturn()) return;
    const draft = riderSearchDraft();
    if (!draft) return;
    const timer = window.setTimeout(() => {
      setRole("RIDER");
      setRiderSelectionOpen(true);
      setRiderPins({ pickup: draft.pickup, destination: draft.destination });
      setRiderTime(draft.departureAt);
      setRiderDate(draft.departureDate ?? sydneyDateTime().date);
      setScreen("RIDER");
      window.dispatchEvent(
        new CustomEvent("cocowheels:ride-tab", { detail: "rider" }),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialMatch, initialNotice]);
  useEffect(() => {
    if (initialMatch || initialNotice) return;
    const requested = new URLSearchParams(window.location.search).get("start");
    if (requested !== "driver" && requested !== "rider") return;
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
    const timer = window.setTimeout(() => {
      const roleChoice: Role = requested === "driver" ? "DRIVER" : "RIDER";
      setRole(roleChoice);
      if (roleChoice === "RIDER") {
        const draft = riderSearchDraft();
        if (draft) {
          setRiderSelectionOpen(true);
          setRiderPins({
            pickup: draft.pickup,
            destination: draft.destination,
          });
          setRiderTime(draft.departureAt);
          setRiderDate(draft.departureDate ?? sydneyDateTime().date);
        } else {
          setRiderSelectionOpen(false);
        }
      }
      setScreen(roleChoice);
      window.dispatchEvent(
        new CustomEvent("cocowheels:ride-tab", {
          detail: roleChoice === "DRIVER" ? "driver" : "rider",
        }),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialMatch, initialNotice]);
  useEffect(() => {
    const handleStart = (event: Event) => {
      const roleChoice = (event as CustomEvent<unknown>).detail;
      if (roleChoice === "driver") begin("DRIVER");
      if (roleChoice === "rider") begin("RIDER");
    };
    window.addEventListener("cocowheels:start", handleStart);
    return () => window.removeEventListener("cocowheels:start", handleStart);
  }, [begin]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refreshCurrent(), 0);
    const sync = (event: Event) =>
      setHomeCurrent(
        (event as CustomEvent<Array<{ role: Role; ride: Ride }>>).detail,
      );
    window.addEventListener("cocowheels:current-updated", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("cocowheels:current-updated", sync);
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setCountryPreference(storedCountryPreference()),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);
  const activeRideId = ride?.rideId;
  const [poorFitCandidate, setPoorFitCandidate] = useState<Candidate | null>(
    null,
  );
  useEffect(() => {
    if (!activeRideId) return;
    const timer = window.setInterval(() => {
      cocowheelsApi<{ ride: Ride }>(
        `/api/rides/${encodeURIComponent(activeRideId)}`,
      )
        .then((result) => {
          setRide(result.ride);
          setServiceAvailable(true);
          setServiceError(null);
        })
        .catch((reason) => {
          if (
            reason instanceof ApiError &&
            [401, 403, 404].includes(reason.status)
          )
            setRide(null);
          setServiceAvailable(false);
          setServiceError(
            apiErrorMessage(
              reason,
              "We couldn’t refresh your ride. Please try again.",
            ),
          );
        });
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [activeRideId]);

  function setPinForTarget(target: FormPin, pin: Pin | undefined) {
    if (target === "origin")
      setDriverPins((state) => ({ ...state, origin: pin }));
    if (target === "destination")
      setDriverPins((state) => ({ ...state, destination: pin }));
    if (target === "pickup")
      setRiderPins((state) => ({ ...state, pickup: pin }));
    if (target === "riderDestination")
      setRiderPins((state) => ({ ...state, destination: pin }));
  }
  const placePins = useMemo(
    () =>
      [
        ["origin", driverPins.origin],
        ["destination", driverPins.destination],
        ["pickup", riderPins.pickup],
        ["riderDestination", riderPins.destination],
      ] as const,
    [
      driverPins.destination,
      driverPins.origin,
      riderPins.destination,
      riderPins.pickup,
    ],
  );
  useEffect(() => {
    for (const [target, pin] of placePins) {
      const requestId = ++placeLookupIds.current[target];
      if (!pin || pin.label) continue;
      const cached = cachedPlace(pin);
      if (cached) {
        void Promise.resolve(cached).then((place) => {
          if (placeLookupIds.current[target] !== requestId) return;
          if (place.countryCode) {
            storeCountryPreference(place.countryCode);
            setCountryPreference(place.countryCode);
          }
          setPinForTarget(target, { ...pin, ...place });
        });
        continue;
      }
      void cocowheelsApi<{ label: string | null; countryCode: string | null }>(
        "/api/place-label",
        {
          method: "POST",
          body: JSON.stringify({ pin: canonicalPin(pin) }),
        },
      )
        .then(({ label, countryCode }) => {
          if (placeLookupIds.current[target] !== requestId) return;
          if (!label && !countryCode) return;
          if (label)
            cachePlace(pin, { label, ...(countryCode ? { countryCode } : {}) });
          if (countryCode) {
            storeCountryPreference(countryCode);
            setCountryPreference(countryCode);
          }
          setPinForTarget(target, {
            ...pin,
            ...(label ? { label } : {}),
            ...(countryCode ? { countryCode } : {}),
          });
        })
        .catch(() => undefined);
    }
  }, [placePins]);
  const pickupLatitude = riderPins.pickup?.latitude;
  const pickupLongitude = riderPins.pickup?.longitude;
  const riderDestinationLatitude = riderPins.destination?.latitude;
  const riderDestinationLongitude = riderPins.destination?.longitude;
  const riderRouteInput = useMemo(() => {
    if (
      pickupLatitude === undefined ||
      pickupLongitude === undefined ||
      riderDestinationLatitude === undefined ||
      riderDestinationLongitude === undefined
    )
      return null;
    return {
      origin: { latitude: pickupLatitude, longitude: pickupLongitude },
      destination: {
        latitude: riderDestinationLatitude,
        longitude: riderDestinationLongitude,
      },
    };
  }, [
    pickupLatitude,
    pickupLongitude,
    riderDestinationLatitude,
    riderDestinationLongitude,
  ]);
  const riderRouteCoordinates = riderRouteInput
    ? `${riderRouteInput.origin.latitude}:${riderRouteInput.origin.longitude}|${riderRouteInput.destination.latitude}:${riderRouteInput.destination.longitude}`
    : "";
  useEffect(() => {
    if (!riderRouteInput) return;
    void cocowheelsApi<RoutePreviewResponse>("/api/route-preview", {
      method: "POST",
      body: JSON.stringify(riderRouteInput),
    })
      .then(({ points, durationSeconds }) => {
        if (points.length >= 2)
          setRiderRoute({
            coordinates: riderRouteCoordinates,
            points,
            durationSeconds,
          });
      })
      .catch(() => undefined);
  }, [riderRouteCoordinates, riderRouteInput]);
  const activeRiderRoute =
    riderRoute?.coordinates === riderRouteCoordinates
      ? riderRoute.points
      : null;
  const activeRiderDurationSeconds =
    riderRoute?.coordinates === riderRouteCoordinates
      ? riderRoute.durationSeconds
      : null;
  async function publish(withdrawLiftRequestId?: string) {
    if (!driverPins.origin || !driverPins.destination) {
      setError(null);
      setRouteRequiredPromptOpen(true);
      return;
    }
    const departure = sydneyInstant(driverSchedule.date, driverSchedule.time);
    if (!departure || Date.parse(departure) <= Date.now() || driverSchedule.date > lastDepartureDate()) {
      setError("Choose a future departure within the next three months."); return;
    }
    setBusy(true);
    setError(null);
    try {
      await cocowheelsApi<{ ride: Ride }>("/api/rides", {
        method: "POST",
        body: JSON.stringify({
          origin: canonicalPin(driverPins.origin),
          destination: canonicalPin(driverPins.destination),
          scheduledDepartureAt: departure,
          priceAud: contribution ? Number(price) : 0,
          payId: contribution ? payId : "",
          payIdType,
          withdrawLiftRequestId,
        }),
      });
      window.dispatchEvent(new Event("cocowheels:identity-changed"));
      window.location.assign("/activity");
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "LIFT_REQUEST_WITHDRAWAL_REQUIRED") {
        try { setLiftSwitchId(await openLiftRequestId()); }
        catch (error) { setError(apiErrorMessage(error)); }
        return;
      }
      if (
        reason instanceof ApiError &&
        reason.code === "ROLE_CHANGE_REQUIRES_TERMINATION"
      ) {
        setRoleChangeTarget("DRIVER");
        setRoleChangePromptOpen(true);
        return;
      }
      setError(humanError(reason));
    } finally {
      setBusy(false);
    }
  }
  const riderSearchKey =
    riderPins.pickup && riderPins.destination
      ? `${riderPins.pickup.latitude}:${riderPins.pickup.longitude}|${riderPins.destination.latitude}:${riderPins.destination.longitude}`
      : null;
  useEffect(() => {
    if (!riderSearchKey || !riderPins.pickup || !riderPins.destination) return;
    const draft = riderSearchDraft();
    const matchesDraft =
      draft?.pickup.latitude === riderPins.pickup.latitude &&
      draft.pickup.longitude === riderPins.pickup.longitude &&
      draft.destination.latitude === riderPins.destination.latitude &&
      draft.destination.longitude === riderPins.destination.longitude &&
      draft.departureDate === riderDate && draft.departureAt === riderTime;
    const savedAt = matchesDraft ? draft.savedAt : Date.now();
    if (!matchesDraft)
      saveRiderSearchDraft(riderPins.pickup, riderPins.destination, riderTime, riderDate);
    const timer = window.setTimeout(
      () => {
        clearRiderSearchDraft();
        setRiderPins({});
        setRiderTime(null);
        setCandidates([]);
        setSelected(null);
        setRiderRoute(null);
        setRiderSelectionOpen(false);
      },
      Math.max(0, savedAt + riderSearchDraftTtlMs - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [riderPins.destination, riderPins.pickup, riderSearchKey, riderTime, riderDate]);
  useEffect(() => {
    if (
      screen !== "RIDER" ||
      !riderSelectionOpen ||
      !riderSearchKey ||
      !riderPins.pickup ||
      !riderPins.destination
    ) {
      return;
    }
    let cancelled = false;
    const search = () => {
      void cocowheelsApi<{ candidates: Candidate[]; serverNow: string }>(
        "/api/search",
        {
          method: "POST",
          body: JSON.stringify({
            pickup: canonicalPin(riderPins.pickup!),
            destination: canonicalPin(riderPins.destination!),
            requestedDepartureAt: new Date().toISOString(),
            departureDate: riderDate,
            ...(riderTime ? { departureTime: sydneyDateTime(riderTime).time } : {}),
          }),
        },
      )
        .then((result) => {
          if (cancelled) return;
          setCandidates(result.candidates);
          setDiscoveryError(null);
          if (pendingEmailMatch.current) {
            if (!result.candidates.some((candidate) => candidate.rideId === pendingEmailMatch.current)) {
              setError("That ride is no longer available. You can browse other rides for your route.");
            }
            pendingEmailMatch.current = null;
          }
          setSelected((current) =>
            result.candidates.some((candidate) => candidate.rideId === current)
              ? current
              : (result.candidates[0]?.rideId ?? null),
          );
        })
        .catch((reason) => !cancelled && setDiscoveryError(humanError(reason)))
        .finally(() => !cancelled && setSearching(false));
    };
    const timer = window.setTimeout(search, 250);
    const refresh = window.setInterval(search, 15000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(refresh);
    };
  }, [
    riderPins.destination,
    riderPins.pickup,
    riderSearchKey,
    riderTime,
    riderDate,
    riderSelectionOpen,
    screen,
  ]);
  async function requestSelected(
    candidate = selectedCandidate,
    confirmed = false,
  ) {
    if (!candidate || !riderPins.pickup || !riderPins.destination) return;
    if (candidate.isOwnOffer) {
      setOwnOfferPromptOpen(true);
      return;
    }
    if (candidate.directionFit === "POOR" && !confirmed) {
      setPoorFitCandidate(candidate);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      saveRiderPreviewRoute(
        candidate.rideId,
        riderPins.pickup,
        riderPins.destination,
        candidate.directionFit,
      );
      const result = await cocowheelsApi<{ ride: Ride }>(
        `/api/rides/${encodeURIComponent(candidate.rideId)}/requests`,
        {
          method: "POST",
          body: JSON.stringify({
            pickup: canonicalPin(riderPins.pickup),
            destination: canonicalPin(riderPins.destination),
            requestedDepartureAt: new Date().toISOString(),
          }),
        },
      );
      window.dispatchEvent(new Event("cocowheels:identity-changed"));
      router.push(
        requestedRideUrl(candidate.rideId, result.ride.request?.requestId),
      );
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.code === "OWN_RIDE_JOIN_NOT_ALLOWED"
      ) {
        setOwnOfferPromptOpen(true);
        return;
      }
      if (
        reason instanceof ApiError &&
        reason.code === "ROLE_CHANGE_REQUIRES_TERMINATION"
      ) {
        setRoleChangeTarget("RIDER");
        setRoleChangePromptOpen(true);
        return;
      }
      setError(humanError(reason));
    } finally {
      setBusy(false);
    }
  }
  const [plateAction, setPlateAction] = useState<string | null>(null);
  async function action(path: string, body?: unknown, fromPlate = false) {
    if (!ride) return false;
    setBusy(true);
    setError(null);
    try {
      const result = await cocowheelsApi<{ ride: Ride }>(path, {
        method: path.includes("/requests/") ? "PATCH" : "POST",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      setRide(result.ride);
      setServiceAvailable(true);
      return true;
    } catch (reason) {
      if (fromPlate) throw reason;
      if (reason instanceof ApiError && reason.code === "VEHICLE_PLATE_REQUIRED") {
        setPlateAction(path);
        return false;
      }
      setError(humanError(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function sendCurrentLocation(silent = false) {
    if (!ride || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void action(`/api/rides/${encodeURIComponent(ride.rideId)}/location`, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        });
      },
      () => {
        if (!silent)
          setError(
            "We couldn’t update your location. Check location permissions and try somewhere with a clearer GPS signal.",
          );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }

  const status = ride ? (
    <RideStatus
      ride={ride}
      role={role!}
      busy={busy}
      code={code}
      setCode={setCode}
      onAction={action}
      onLocation={() => sendCurrentLocation()}
    />
  ) : null;
  return (
    <section
      className={
        !ride && screen === "HOME"
          ? "page-content home-page-content"
          : "page-content"
      }
    >
      {plateAction && <VehiclePlatePrompt close={() => setPlateAction(null)} confirm={async plate => { const accepted = await action(plateAction, { decision: "ACCEPT", plate }, true); if (!accepted) throw new Error("Ride unavailable"); setPlateAction(null); }} />}
      {serviceAvailable === false && serviceError !== CONNECTION_MESSAGE ? (
        <p className="reconnect" role="status">
          {serviceError}
        </p>
      ) : null}
      {ownOfferPromptOpen ? (
        <OwnOfferPrompt close={() => setOwnOfferPromptOpen(false)} />
      ) : null}
      {poorFitCandidate ? (
        <PoorFitPrompt
          close={() => setPoorFitCandidate(null)}
          confirm={() => {
            const candidate = poorFitCandidate;
            setPoorFitCandidate(null);
            void requestSelected(candidate, true);
          }}
        />
      ) : null}
      {roleChangePromptOpen ? (
        <RoleChangePrompt
          target={roleChangeTarget}
          close={() => setRoleChangePromptOpen(false)}
        />
      ) : null}
      {liftSwitchId && <LiftRequestSwitchPrompt busy={busy} close={() => setLiftSwitchId(null)} confirm={() => { const id = liftSwitchId; setLiftSwitchId(null); void publish(id); }} />}
      {routeRequiredPromptOpen ? (
        <RouteRequiredPrompt
          close={() => setRouteRequiredPromptOpen(false)}
        />
      ) : null}
      {error ? <Message text={error} close={() => setError(null)} /> : null}
      {discoveryError && screen === "RIDER" ? (
        <p className="reconnect" role="status">
          {discoveryError}
        </p>
      ) : null}
      {ride ? (
        status
      ) : screen === "HOME" ? (
        <Home current={homeCurrent} onBegin={begin} />
      ) : screen === "DRIVER" ? (
        <DriverForm
          pins={driverPins}
          countryPreference={countryPreference}
          setOrigin={(pin) => {
            setPinForTarget("origin", pin);
          }}
          setDestination={(pin) => setPinForTarget("destination", pin)}
          price={price}
          contribution={contribution}
          setContribution={setContribution}
          setPrice={setPrice}
          schedule={driverSchedule}
          setSchedule={setDriverSchedule}
          payId={payId}
          setPayId={setPayId}
          payIdType={payIdType}
          setPayIdType={setPayIdType}
          submit={() => void publish()}
          busy={busy}
        />
      ) : screen === "RIDER" ? (
        <RiderForm
          date={riderDate}
          time={riderTime ? sydneyDateTime(riderTime).time : ""}
          setDate={setRiderDate}
          // The stored instant carries a Sydney wall-clock preference, not a booking date.
          setTime={time => setRiderTime(time ? sydneyInstant("2026-01-15", time) : null)}
          setOrigin={(pin) => {
            if (!pin) clearRiderSearchDraft();
            setCandidates([]);
            setSelected(null);
            setPinForTarget("pickup", pin);
          }}
          pins={riderPins}
          countryPreference={countryPreference}
          setDestination={(pin) => {
            if (!pin) clearRiderSearchDraft();
            setCandidates([]);
            setSelected(null);
            setPinForTarget("riderDestination", pin);
          }}
          routePoints={activeRiderRoute}
          routeDurationSeconds={activeRiderDurationSeconds}
          candidates={candidates}
          selected={selected}
          setSelected={setSelected}
          request={requestSelected}
          busy={busy}
          searching={searching}
          selectionOpen={riderSelectionOpen}
          openSelection={() => {
            if (!riderPins.pickup || !riderPins.destination) {
              setError(null);
              setRouteRequiredPromptOpen(true);
              return;
            }
            setRiderSelectionOpen(true);
          }}
          closeSelection={() => setRiderSelectionOpen(false)}
        />
      ) : null}
    </section>
  );
}

function Home({
  current,
  onBegin,
}: {
  current: Array<{ role: Role; ride: Ride }>;
  onBegin: (role: Role) => void;
}) {
  return (
    <div className="role-choice">
      <h1 className="home-hero">
        <span>Going your way.</span>
      </h1>
      <button
        className="role-card role-card-primary"
        onClick={() => onBegin("RIDER")}
      >
        FIND A RIDE
      </button>
      <button className="role-card" onClick={() => onBegin("DRIVER")}>
        OFFER A RIDE
      </button>
      {current.map((item) => (
        <ActiveRideLink key={`${item.role}-${item.ride.rideId}`} item={item} />
      ))}
    </div>
  );
}
function OwnOfferPrompt({ close }: { close: () => void }) {
  return (
    <div className="location-prompt-backdrop" role="presentation">
      <section
        className="location-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="own-offer-title"
      >
        <h2 id="own-offer-title">
          We apologise, drivers are not allowed to join their own rides.
        </h2>
        <div className="location-prompt-actions">
          <button type="button" className="primary" onClick={close}>
            OKAY
          </button>
        </div>
      </section>
    </div>
  );
}
function RoleChangePrompt({
  close,
  target,
}: {
  close: () => void;
  target: "DRIVER" | "RIDER";
}) {
  return (
    <div className="location-prompt-backdrop" role="presentation">
      <section
        className="location-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-change-title"
      >
        <h2 id="role-change-title">
          {target === "DRIVER"
            ? "Withdraw your ride request before offering a ride."
            : "Cancel your offered ride before requesting a ride."}
        </h2>
        <div className="location-prompt-actions">
          <button type="button" className="primary" onClick={close}>
            OKAY
          </button>
        </div>
      </section>
    </div>
  );
}
function DriverForm(props: {
  pins: { origin?: Pin; destination?: Pin };
  countryPreference: string | null;
  setOrigin: (pin: Pin | undefined) => void;
  setDestination: (pin: Pin | undefined) => void;
  price: string;
  contribution: boolean;
  setContribution: (value: boolean) => void;
  setPrice: (value: string) => void;
  schedule: { date: string; time: string };
  setSchedule: (value: { date: string; time: string }) => void;
  payId: string;
  setPayId: (value: string) => void;
  payIdType: PayIdType;
  setPayIdType: (value: PayIdType) => void;
  submit: () => void;
  busy: boolean;
}) {
  const payIdRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const [findingRiders, setFindingRiders] = useState(false);
  const submit = () => {
    if (!props.pins.origin || !props.pins.destination) {
      props.submit();
      return;
    }
    priceRef.current?.setCustomValidity(
      Number(props.price) > 0 && validFare(Number(props.price))
        ? "" : CONTRIBUTION_ERROR,
    );
    payIdRef.current?.setCustomValidity(
      payIdInputError(props.payId, props.payIdType) ?? "",
    );
    if (props.contribution && (!priceRef.current?.checkValidity() || !payIdRef.current?.checkValidity())) {
      priceRef.current?.closest("details")?.setAttribute("open", "");
    }
    if (
      props.contribution && (!priceRef.current?.reportValidity() ||
      !payIdRef.current?.reportValidity())
    )
      return;
    props.submit();
  };
  if (findingRiders) return <FindRiders origin={props.pins.origin} destination={props.pins.destination} back={() => setFindingRiders(false)} />;
  return (
    <div className="form-page">
      <h1 className="page-title">Offer a ride</h1>
      <div className="form-panel-content">
        <RouteFields sheet
          origin={props.pins.origin} destination={props.pins.destination}
          countryCode={props.countryPreference ?? "au"}
          setOrigin={props.setOrigin} setDestination={props.setDestination}
        />
        <ScheduleFields date={props.schedule.date} time={props.schedule.time}
          setDate={date => props.setSchedule({ ...props.schedule, date })} setTime={time => props.setSchedule({ ...props.schedule, time })} />
        <ContributionChoice checked={props.contribution} onChange={props.setContribution} fare={props.price}>
          <PaymentFields
            fare={props.price} setFare={props.setPrice}
            payId={props.payId} setPayId={props.setPayId}
            type={props.payIdType} setType={props.setPayIdType}
            priceRef={priceRef} payIdRef={payIdRef}
          />
        </ContributionChoice>
        <button className="primary" disabled={props.busy} onClick={submit}>
          {props.busy ? "Offering…" : "OFFER A RIDE"}
        </button>
        <div className="save-search-route driver-discovery-action"><button type="button" className="text-button" disabled={props.busy} onClick={() => setFindingRiders(true)}>Find someone who needs a ride</button></div>
      </div>
    </div>
  );
}
function RiderForm(props: {
  date: string; time: string; setDate: (value: string) => void; setTime: (value: string) => void;
  setOrigin: (pin: Pin | undefined) => void;
  pins: { pickup?: Pin; destination?: Pin };
  countryPreference: string | null;
  setDestination: (pin: Pin | undefined) => void;
  routePoints?: Pin[] | null;
  routeDurationSeconds?: number | null;
  candidates: Candidate[];
  selected: string | null;
  setSelected: (id: string) => void;
  request: () => void;
  busy: boolean;
  searching: boolean;
  selectionOpen: boolean;
  openSelection: () => void;
  closeSelection: () => void;
}) {
  if (props.selectionOpen && props.pins.pickup && props.pins.destination) {
    return (
      <RideSelection
        date={props.date} time={props.time}
        pickup={props.pins.pickup}
        destination={props.pins.destination}
        riderRoute={props.routePoints}
        riderDurationSeconds={props.routeDurationSeconds}
        candidates={props.candidates}
        selected={props.selected}
        setSelected={props.setSelected}
        request={props.request}
        busy={props.busy}
        searching={props.searching}
        back={props.closeSelection}
      />
    );
  }
  return (
    <div className="form-page rider-form-page">
      <h1 className="page-title">Find a ride</h1>
      <div className="form-panel-content">
        <RouteFields sheet
          origin={props.pins.pickup} destination={props.pins.destination}
          countryCode={props.countryPreference ?? "au"}
          setOrigin={props.setOrigin} setDestination={props.setDestination}
        />
        <ScheduleFields date={props.date} time={props.time} setDate={props.setDate} setTime={props.setTime} optional />
        <button type="button" className="primary" onClick={props.openSelection}>FIND A RIDE</button>
      </div>
    </div>
  );
}

type PublicRideRoute = {
  plannedRoute: { origin: Pin; destination: Pin };
};
type RoutePreviewResponse = {
  points: Pin[];
  distanceMeters: number | null;
  durationSeconds: number | null;
};

function RideOptionTiming({ scheduledAt, pickupSeconds, riderSeconds }: {
  scheduledAt: string;
  pickupSeconds?: number;
  riderSeconds?: number | null;
}) {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setClock(Date.now()); };
    const timer = window.setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const arrival = pickupSeconds !== undefined && riderSeconds != null
    ? new Date(Math.max(clock, Date.parse(scheduledAt)) + (pickupSeconds + riderSeconds) * 1000)
    : null;
  return <>
    <small>
      {pickupSeconds !== undefined ? `${Math.max(1, Math.round(pickupSeconds / 60))} min away` : "Estimating pickup"}
      {arrival ? ` · ${new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(arrival)}` : ""}
    </small>
    <small className={`ride-option-departure departure-tone-${departureTone(scheduledAt, clock)}`}>{departureLabel(scheduledAt, clock)}</small>
  </>;
}

function RideSelection({
  date, time,
  pickup,
  destination,
  riderRoute,
  riderDurationSeconds,
  candidates,
  selected,
  setSelected,
  request,
  busy,
  searching,
  back,
}: {
  date: string; time: string;
  pickup: Pin;
  destination: Pin;
  riderRoute?: Pin[] | null;
  riderDurationSeconds?: number | null;
  candidates: Candidate[];
  selected: string | null;
  setSelected: (id: string) => void;
  request: () => void;
  busy: boolean;
  searching: boolean;
  back: () => void;
}) {
  const selectedCandidate =
    candidates.find((candidate) => candidate.rideId === selected) ?? null;
  const visibleCandidates = candidates.slice(0, 20);
  const [estimates, setEstimates] = useState<
    Record<string, { pickupSeconds: number; calculatedAt: number }>
  >({});
  const [driverRoute, setDriverRoute] = useState<{
    rideId: string;
    origin: Pin;
    destination: Pin;
    points: Pin[];
  } | null>(null);

  useEffect(() => {
    if (!selectedCandidate) return;
    let cancelled = false;
    void cocowheelsApi<{ ride: PublicRideRoute }>(
      `/api/rides/${encodeURIComponent(selectedCandidate.rideId)}/preview`,
    )
      .then(async ({ ride }) => {
        const cached = cachedRoadPath(
          ride.plannedRoute.origin,
          ride.plannedRoute.destination,
        );
        const points =
          cached ??
          (
            await cocowheelsApi<RoutePreviewResponse>("/api/route-preview", {
              method: "POST",
              body: JSON.stringify(ride.plannedRoute),
            })
          ).points;
        if (cancelled) return;
        if (!cached)
          cacheRoadPath(
            ride.plannedRoute.origin,
            ride.plannedRoute.destination,
            points,
          );
        setDriverRoute({
          rideId: selectedCandidate.rideId,
          ...ride.plannedRoute,
          points,
        });
      })
      .catch(() => {
        if (!cancelled) setDriverRoute(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCandidate]);

  const estimateKey = visibleCandidates
    .map(
      (candidate) =>
        `${candidate.rideId}:origin`,
    )
    .join("|");
  useEffect(() => {
    if (!estimateKey) return;
    let cancelled = false;
    const calculatedAt = Date.now();
    void Promise.allSettled(
      visibleCandidates.map(async (candidate) => {
        const { ride } = await cocowheelsApi<{ ride: PublicRideRoute }>(
          `/api/rides/${encodeURIComponent(candidate.rideId)}/preview`,
        );
        const route = await cocowheelsApi<RoutePreviewResponse>(
          "/api/route-preview",
          {
            method: "POST",
            body: JSON.stringify({
              origin: ride.plannedRoute.origin,
              destination: pickup,
            }),
          },
        );
        return {
          rideId: candidate.rideId,
          pickupSeconds: route.durationSeconds,
        };
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<
        string,
        { pickupSeconds: number; calculatedAt: number }
      > = {};
      for (const result of results) {
        if (
          result.status !== "fulfilled" ||
          result.value.pickupSeconds === null
        )
          continue;
        next[result.value.rideId] = {
          pickupSeconds: result.value.pickupSeconds,
          calculatedAt,
        };
      }
      setEstimates(next);
    });
    return () => {
      cancelled = true;
    };
    // Candidate IDs and pickup coordinates are the meaningful estimate inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateKey, pickup.latitude, pickup.longitude]);

  const visibleDriverRoute =
    driverRoute?.rideId === selectedCandidate?.rideId
      ? driverRoute
      : selectedCandidate
        ? {
            rideId: selectedCandidate.rideId,
            origin: selectedCandidate.redactedCorridor[0],
            destination: selectedCandidate.redactedCorridor[1],
            points: selectedCandidate.redactedCorridor,
          }
        : null;
  const mapPins = [
    ...(visibleDriverRoute
      ? [
          visibleDriverRoute.origin,
          visibleDriverRoute.destination,
        ]
      : []),
    pickup,
    destination,
  ];
  const markerKinds = [
    ...(visibleDriverRoute ? (["driver", "destination"] as const) : []),
    "pickup",
    "destination",
  ] as Array<"driver" | "pickup" | "destination">;
  const selectedPickupMinutes =
    selectedCandidate && estimates[selectedCandidate.rideId]
      ? Math.max(
          1,
          Math.round(estimates[selectedCandidate.rideId].pickupSeconds / 60),
        )
      : null;
  const markerLabels = [
    ...(visibleDriverRoute ? [undefined, undefined] : []),
    selectedPickupMinutes !== null
      ? {
          etaMinutes: selectedPickupMinutes,
          text: mapLocationText(pickup),
        }
      : mapLocationText(pickup),
    mapLocationText(destination),
  ];

  return (
    <div className="ride-selection-page">
      <div className="ride-selection-map">
        <JourneyMap
          pins={mapPins}
          fitPins={[
            ...(visibleDriverRoute
              ? [visibleDriverRoute.origin, visibleDriverRoute.destination]
              : []),
            pickup,
            destination,
          ]}
          markerKinds={markerKinds}
          markerLabels={markerLabels}
          roadPathAttribution={Boolean(
            riderRoute?.length ||
            (driverRoute &&
              driverRoute.rideId === selectedCandidate?.rideId &&
              driverRoute.points.length),
          )}
          lines={[
            ...(visibleDriverRoute
              ? [
                  {
                    points: visibleDriverRoute.points,
                    ...DRIVER_ROUTE,
                  },
                ]
              : []),
            {
              points: riderRoute?.length ? riderRoute : [pickup, destination],
              ...RIDER_ROUTE,
            },
          ]}
        />
        <button
          type="button"
          className="ride-selection-back"
          aria-label="Back to route search"
          onClick={back}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </div>
      <div className="ride-selection-route-key" aria-label="Map route colours">
        <span>
          <i className="ride-selection-route-rider" aria-hidden="true" />
          Your route
        </span>
        <span>
          <i className="ride-selection-route-driver" aria-hidden="true" />
          Driver route
        </span>
      </div>
      <section className="ride-options" aria-live="polite">
        {searching ? null : visibleCandidates.length ? (
          <div className="ride-option-list">
            {visibleCandidates.map((candidate) => {
              const estimate = estimates[candidate.rideId];
              return (
                <button
                  type="button"
                  key={candidate.rideId}
                  className={`ride-option${
                    candidate.rideId === selected ? " selected" : ""
                  }`}
                  aria-pressed={candidate.rideId === selected}
                  onClick={() => setSelected(candidate.rideId)}
                >
                  <span className="ride-option-car" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M5 14.5h14l-1.5-4.3a2 2 0 0 0-1.9-1.4H8.4a2 2 0 0 0-1.9 1.4L5 14.5v3h2v-1h10v1h2v-3Z" />
                      <path d="M7.5 14.5h.01M16.5 14.5h.01" />
                    </svg>
                  </span>
                  <span className="ride-option-main">
                    <strong>
                      <ParticipantName name={candidate.driverAlias} />{" "}
                      <RatingBadge summary={candidate.driverRating} />
                    </strong>
                    <RideOptionTiming scheduledAt={candidate.scheduledDepartureAt}
                      pickupSeconds={estimate?.pickupSeconds} riderSeconds={riderDurationSeconds} />
                  </span>
                  <span className="ride-option-payment">
                    <b>{fareLabel(candidate.priceAud)}</b>
                    {candidate.priceAud > 0 ? <small>PayID</small> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="ride-options-empty">No rides available</p>
        )}
      </section>
      <div className="ride-selection-action">
        <p className="request-message-hint">{REQUEST_MESSAGE_HINT}</p>
        <button
          type="button"
          className="primary"
          disabled={busy || !selectedCandidate}
          onClick={() => request()}
        >
          {busy ? "REQUESTING…" : "REQUEST TO JOIN"}
        </button>
        <div className="save-search-route ride-search-secondary-actions">
          <PostRideRequest key={JSON.stringify([pickup, destination, date, time])} route={{origin: pickup, destination, date, time}} />
          <SaveSearchRoute key={`${pickup.latitude},${pickup.longitude}:${destination.latitude},${destination.longitude}`} origin={pickup} destination={destination} />
        </div>
      </div>
    </div>
  );
}
function RideStatus({
  ride,
  role,
  busy,
  code,
  setCode,
  onAction,
  onLocation,
}: {
  ride: Ride;
  role: Role;
  busy: boolean;
  code: string;
  setCode: (value: string) => void;
  onAction: (path: string, body?: unknown) => Promise<boolean>;
  onLocation: () => void;
}) {
  const driver = role === "DRIVER";
  const request = ride.request;
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false);
  const canCancel = ![
    "CO_RIDE_ACTIVE",
    "COMPLETED",
    "CANCELLED",
    "EXPIRED",
  ].includes(ride.status);
  const location = driver ? ride.riderLocation : ride.driverLocation;
  const statusTitle =
    ride.status === "REQUESTED" && driver
      ? "Rider requests"
      : ride.status === "ACCEPTED"
        ? "Awaiting pickup"
        : ride.status === "RIDE_ACTIVE"
          ? "Awaiting pickup"
          : ride.status === "CO_RIDE_ACTIVE"
            ? "Ride in progress"
            : ride.status === "COMPLETED"
              ? "Ride completed"
              : ride.status === "EXPIRED"
                ? "Ride expired"
                : null;
  const cancelPath =
    ride.status === "REQUESTED" && !driver
      ? `/api/rides/${ride.rideId}/request/cancel`
      : `/api/rides/${ride.rideId}/cancel`;
  return (
    <div className="status-page">
      <h1 className="page-title">
        {driver ? "Your offered ride" : "Your ride request"}
      </h1>
      {statusTitle ? <h2 className="status-heading">{statusTitle}</h2> : null}
      <div className="ride-summary">
        <ParticipantName name={ride.driverAlias} />
        <strong>{fareLabel(ride.priceAud)}</strong>
        <small>{prettyTime(ride.scheduledDepartureAt)}</small>
      </div>
      {driver && ride.requests?.length ? (
        <section className="request-stack">
          {ride.requests.map((item) => (
            <article key={item.requestId} className="request-card">
              <strong><ParticipantName name={item.riderAlias} /></strong>
              <p>
                Pickup: {locationText(item.pickup)}
                <br />
                Destination: {locationText(item.destination)}
              </p>
              <small>
                {item.directionFit === "GOOD"
                  ? "Good direction fit"
                  : "Poor direction fit"}{" "}
                · {prettyTime(item.requestedDepartureAt)}
              </small>
              {item.status === "PENDING" ? (
                <div className="split-actions">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      onAction(
                        `/api/rides/${ride.rideId}/requests/${item.requestId}`,
                        { decision: "DECLINE" },
                      )
                    }
                  >
                    DECLINE
                  </button>
                  <button
                    className="primary compact"
                    disabled={busy}
                    onClick={() =>
                      onAction(
                        `/api/rides/${ride.rideId}/requests/${item.requestId}`,
                        { decision: "ACCEPT" },
                      )
                    }
                  >
                    ACCEPT RIDER
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
      {request ? (
        <div className="journey-summary">
          <p>
            <strong>Pickup</strong>
            {locationText(request.pickup)}
          </p>
          <p>
            <strong>Your destination</strong>
            {locationText(request.destination)}
          </p>
        </div>
      ) : null}
      {["ACCEPTED", "RIDE_ACTIVE", "CO_RIDE_ACTIVE"].includes(ride.status) ? (
        <section className="location-card">
          <h2>{driver ? "Rider location" : "Driver location"}</h2>
          {location ? (
            <>
              <p>
                {location.stale
                  ? "Last known location · Trying to reconnect"
                  : "Current location received"}
              </p>
              <JourneyMap
                pins={[
                  {
                    latitude: location.latitude,
                    longitude: location.longitude,
                  },
                ]}
              />
            </>
          ) : (
            <p>
              {driver
                ? "Ask the rider to update their location."
                : ride.status === "ACCEPTED"
                  ? "The driver will become visible after they begin the ride."
                  : "Waiting for a location update."}
            </p>
          )}
          <button className="secondary" disabled={busy} onClick={onLocation}>
            UPDATE LOCATION
          </button>
        </section>
      ) : null}
      {ride.status === "ACCEPTED" && driver ? (
        <button
          className="primary"
          disabled={busy}
          onClick={() => onAction(`/api/rides/${ride.rideId}/begin`)}
        >
          BEGIN RIDE
        </button>
      ) : null}
      {ride.status === "RIDE_ACTIVE" && !driver ? (
        <section className="code-card">
          <p>Tell this one-time code to your driver when you are together.</p>
          <strong>{ride.coRideCode ?? "Waiting for code…"}</strong>
          <small>
            It expires after pickup confirmation is not completed in time.
          </small>
        </section>
      ) : null}
      {ride.status === "RIDE_ACTIVE" && driver ? (
        <section className="code-entry">
          <label>
            Enter the rider’s four-digit code
            <input
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
            />
          </label>
          <button
            className="primary"
            disabled={busy || code.length !== 4}
            onClick={() =>
              onAction(`/api/rides/${ride.rideId}/co-ride/confirm`, { code })
            }
          >
            START RIDE
          </button>
        </section>
      ) : null}
      {ride.status === "CO_RIDE_ACTIVE" && !driver && ride.priceAud > 0 ? (
        <section className="payment-card">
          <h2>Payment</h2>
          {ride.payId ? (
            <>
              <p>PayID is now visible only to you.</p>
              <CopyPayId value={ride.payId} />
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  onAction(`/api/rides/${ride.rideId}/complete`, {
                    method: "PAYID",
                  })
                }
              >
                COMPLETE · PAYID
              </button>
            </>
          ) : null}
          <div className="copy-grid">
            <button
              className="secondary"
              onClick={() =>
                void navigator.clipboard?.writeText(`A$${ride.priceAud}`)
              }
            >
              COPY AMOUNT · A${ride.priceAud}
            </button>
            <button
              className="secondary"
              onClick={() =>
                void navigator.clipboard?.writeText(
                  `GUMWHEEL ride ${routeReference(ride.rideId)}`,
                )
              }
            >
              COPY DESCRIPTION
            </button>
            <button
              className="secondary"
              onClick={() => void navigator.clipboard?.writeText(ride.rideId)}
            >
              COPY RIDE REFERENCE
            </button>
          </div>
          <small>
            GUMWHEEL records your selected payment method only. It never
            verifies a bank payment.
          </small>
        </section>
      ) : null}
      {ride.status === "COMPLETED" ? (
        <section className="complete-card">
          <p>Private completed record</p>
          <strong>
            {ride.priceAud === 0 ? "Free ride" : ride.paymentHandoffMethod === "PAYID"
              ? "Payment method: PayID"
              : "Payment method: Cash"}
          </strong>
          <small>Ride reference: {routeReference(ride.rideId)}</small>
        </section>
      ) : null}
      {canCancel ? (
        <button
          className="danger"
          disabled={busy}
          onClick={() => setCancelPromptOpen(true)}
        >
          {ride.status === "REQUESTED" && !driver
            ? "WITHDRAW REQUEST"
            : "CANCEL RIDE"}
        </button>
      ) : null}
      {cancelPromptOpen ? (
        <CancelPrompt
          busy={busy}
          request={ride.status === "REQUESTED" && !driver}
          close={() => setCancelPromptOpen(false)}
          confirm={async () => {
            const cancelled = await onAction(cancelPath);
            if (cancelled) window.location.assign("/activity");
          }}
        />
      ) : null}
    </div>
  );
}
