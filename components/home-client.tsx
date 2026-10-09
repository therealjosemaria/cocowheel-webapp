"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CancelPrompt from "./cancel-prompt";
import ExpiryCountdown from "./expiry-countdown";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Candidate, PayIdType, Pin, Ride } from "@/lib/client-types";
import { routeReference } from "@/lib/route-id";
import {
  consumeRiderSearchReturn,
  clearRiderSearchDraft,
  markRiderSearchReturn,
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
type PinTarget = FormPin | null;
type AvailabilityOffer = {
  rideId: string;
  driverAlias: string;
  priceAud: number;
  scheduledDepartureAt: string;
  expiresAt: string;
  departureLabel: string | null;
  destinationLabel: string | null;
  status: "PUBLISHED" | "REQUESTED";
};
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
    : "Place a pin on the map";
const canonicalPin = (pin: Pin) => ({
  latitude: pin.latitude,
  longitude: pin.longitude,
});
const placeCachePrefix = "cocowheels:place-label:v1:";
const countryPreferenceKey = "cocowheels:country-preference:v1";
const countryPreferenceTtlMs = 7 * 24 * 60 * 60 * 1_000;
const recentDeviceLocationKey = "cocowheels:recent-device-location:v1";
const recentDeviceLocationTtlMs = 5 * 60 * 1_000;
type CachedPlace = { label: string; countryCode?: string };
type RecentDeviceLocation = { pin: Pin; capturedAt: number };
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
function recentDeviceLocation(): Pin | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(
      window.sessionStorage.getItem(recentDeviceLocationKey) ?? "null",
    );
    if (
      !value ||
      typeof value !== "object" ||
      !("pin" in value) ||
      !("capturedAt" in value) ||
      typeof value.capturedAt !== "number" ||
      value.capturedAt + recentDeviceLocationTtlMs <= Date.now() ||
      !value.pin ||
      typeof value.pin !== "object" ||
      !("latitude" in value.pin) ||
      !("longitude" in value.pin) ||
      typeof value.pin.latitude !== "number" ||
      !Number.isFinite(value.pin.latitude) ||
      typeof value.pin.longitude !== "number" ||
      !Number.isFinite(value.pin.longitude)
    ) {
      window.sessionStorage.removeItem(recentDeviceLocationKey);
      return null;
    }
    return value.pin as Pin;
  } catch {
    return null;
  }
}
function storeRecentDeviceLocation(pin: Pin, capturedAt: number) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      recentDeviceLocationKey,
      JSON.stringify({ pin, capturedAt } satisfies RecentDeviceLocation),
    );
  } catch {
    // Location setup still works if browser session storage is unavailable.
  }
}
const humanError = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : "REQUEST_FAILED";
  const messages: Record<string, string> = {
    SERVICE_UNAVAILABLE:
      "Trying to reconnect. Your last known ride is still safe on the server.",
    OPEN_ITEM_EXISTS: "You already have an open item in this role.",
    FRESH_LOCATIONS_REQUIRED:
      "Both phones need a fresh location before the driver can begin.",
    LOCATION_STALE: "That location is no longer fresh. Try again now.",
    LOCATION_ACCURACY_REJECTED:
      "Location accuracy is too low. Move somewhere with a clearer signal and try again.",
    CO_RIDE_CODE_INVALID: "That code doesn’t match. Check it and try again.",
    CO_RIDE_CODE_RATE_LIMITED:
      "Please wait a moment before another code attempt.",
    PAYID_UNAVAILABLE: "This driver did not add PayID. Cash is available.",
    REQUEST_TIME_INCOMPATIBLE:
      "That requested time is not compatible with the driver’s planned departure.",
  };
  return (
    messages[code] ?? "We couldn’t complete that action. Please try again."
  );
};

export default function HomeClient({
  initialScreen = "HOME",
}: {
  initialScreen?: "HOME" | "DRIVER" | "RIDER";
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
  const [error, setError] = useState<string | null>(null);
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
  }>({});
  const [pinTarget, setPinTarget] = useState<PinTarget>(null);
  const [price, setPrice] = useState("10");
  const [payId, setPayId] = useState("");
  const [payIdType, setPayIdType] = useState<PayIdType>("MOBILE");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [riderMapOpen, setRiderMapOpen] = useState(false);
  const [riderTime, setRiderTime] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityOffer[]>([]);
  const [availabilityServerNow, setAvailabilityServerNow] = useState<
    string | null
  >(null);
  const [candidateServerNow, setCandidateServerNow] = useState<string | null>(
    null,
  );
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [code, setCode] = useState("");
  const [locationPromptTarget, setLocationPromptTarget] = useState<
    "origin" | "pickup" | null
  >(null);
  const [ownOfferPromptOpen, setOwnOfferPromptOpen] = useState(false);
  const [routeRequiredPromptOpen, setRouteRequiredPromptOpen] = useState(false);
  const [publishRouteRequiredPromptOpen, setPublishRouteRequiredPromptOpen] =
    useState(false);
  const [locatingTarget, setLocatingTarget] = useState<FormPin | null>(null);
  const [allowManualDeparture, setAllowManualDeparture] = useState(false);
  const [riderRoute, setRiderRoute] = useState<{
    coordinates: string;
    points: Pin[];
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

  const begin = useCallback(
    (roleChoice: Role) => {
      if (ride) return;
      const recentLocation = recentDeviceLocation();
      setRole(roleChoice);
      setPinTarget(null);
      if (roleChoice === "RIDER") {
        setRiderMapOpen(false);
        const draft = riderSearchDraft();
        if (draft) {
          setRiderPins((state) =>
            state.pickup || state.destination
              ? state
              : { pickup: draft.pickup, destination: draft.destination },
          );
          setRiderTime(draft.departureAt);
        } else {
          setRiderPins(recentLocation ? { pickup: recentLocation } : {});
          setRiderTime(null);
        }
      }
      if (roleChoice === "DRIVER") {
        setAllowManualDeparture(false);
        if (recentLocation)
          setDriverPins((state) =>
            state.origin ? state : { ...state, origin: recentLocation },
          );
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
      setHomeCurrent(result.currents);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setServiceAvailable(true);
        return;
      }
      setServiceAvailable(false);
    }
  }
  useEffect(() => {
    if (!consumeRiderSearchReturn()) return;
    const draft = riderSearchDraft();
    if (!draft) return;
    const timer = window.setTimeout(() => {
      setRole("RIDER");
      setPinTarget(null);
      setRiderMapOpen(false);
      setRiderPins({ pickup: draft.pickup, destination: draft.destination });
      setRiderTime(draft.departureAt);
      setScreen("RIDER");
      window.dispatchEvent(
        new CustomEvent("cocowheels:ride-tab", { detail: "rider" }),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("start");
    if (requested !== "driver" && requested !== "rider") return;
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
    const timer = window.setTimeout(() => {
      const recentLocation = recentDeviceLocation();
      const roleChoice: Role = requested === "driver" ? "DRIVER" : "RIDER";
      setRole(roleChoice);
      setPinTarget(null);
      if (roleChoice === "DRIVER") {
        setAllowManualDeparture(false);
        if (recentLocation)
          setDriverPins((state) => ({ ...state, origin: recentLocation }));
      } else {
        setRiderMapOpen(false);
        const draft = riderSearchDraft();
        if (draft) {
          setRiderPins({
            pickup: draft.pickup,
            destination: draft.destination,
          });
          setRiderTime(draft.departureAt);
        } else if (recentLocation) {
          setRiderPins({ pickup: recentLocation });
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
  }, []);
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
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setCountryPreference(storedCountryPreference()),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);
  const activeRideId = ride?.rideId;
  const activeRideStatus = ride?.status;
  useEffect(() => {
    if (!activeRideId) return;
    const timer = window.setInterval(() => {
      cocowheelsApi<{ ride: Ride }>(
        `/api/rides/${encodeURIComponent(activeRideId)}`,
      )
        .then((result) => {
          setRide(result.ride);
          setServiceAvailable(true);
        })
        .catch(() => {
          setServiceAvailable(false);
        });
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [activeRideId]);
  useEffect(() => {
    if (
      !activeRideId ||
      !activeRideStatus ||
      !["RIDE_ACTIVE", "CO_RIDE_ACTIVE"].includes(activeRideStatus)
    )
      return;
    const send = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void cocowheelsApi<{ ride: Ride }>(
            `/api/rides/${encodeURIComponent(activeRideId)}/location`,
            {
              method: "POST",
              body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracyMeters: position.coords.accuracy,
                capturedAt: new Date(position.timestamp).toISOString(),
              }),
            },
          )
            .then((result) => {
              setRide(result.ride);
              setServiceAvailable(true);
            })
            .catch(() => setServiceAvailable(false));
        },
        () => undefined,
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
      );
    };
    const timer = window.setInterval(send, 20_000);
    return () => window.clearInterval(timer);
  }, [activeRideId, activeRideStatus]);

  function setPinForTarget(target: FormPin, pin: Pin) {
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
    void cocowheelsApi<{ points: Pin[] }>("/api/route-preview", {
      method: "POST",
      body: JSON.stringify(riderRouteInput),
    })
      .then(({ points }) => {
        if (points.length >= 2)
          setRiderRoute({ coordinates: riderRouteCoordinates, points });
      })
      .catch(() => undefined);
  }, [riderRouteCoordinates, riderRouteInput]);
  const activeRiderRoute =
    riderRoute?.coordinates === riderRouteCoordinates
      ? riderRoute.points
      : null;
  function setPin(pin: Pin) {
    if (!pinTarget) {
      if (role === "RIDER") {
        setPinForTarget("pickup", pin);
        setPinTarget("pickup");
      }
      return;
    }
    const target = pinTarget;
    if (target === "origin" && driverPins.origin && !allowManualDeparture) {
      setPinForTarget("destination", pin);
      setPinTarget("destination");
      return;
    }
    if (target === "pickup" && riderPins.pickup) {
      setPinForTarget("riderDestination", pin);
      setPinTarget("riderDestination");
      return;
    }
    setPinForTarget(target, pin);
    if (target === "origin") {
      setAllowManualDeparture(false);
    }
  }
  function requestCurrentLocation(target: FormPin) {
    setPinTarget(target);
    setLocatingTarget(target);
    if (target === "origin") setAllowManualDeparture(false);
    if (!navigator.geolocation) {
      setLocatingTarget(null);
      if (target === "origin") setAllowManualDeparture(true);
      setError(
        target === "origin"
          ? "Location wasn’t available. Search for your departure instead."
          : "Location wasn’t available. Search for your pickup instead.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pin = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        storeRecentDeviceLocation(pin, position.timestamp);
        if (target === "origin") {
          setPinForTarget(target, pin);
          setAllowManualDeparture(false);
        }
        if (target === "pickup") {
          setPinForTarget(target, pin);
        }
        setLocatingTarget(null);
        setBusy(false);
      },
      () => {
        setLocatingTarget(null);
        if (target === "origin") setAllowManualDeparture(true);
        setBusy(false);
        setError(
          target === "origin"
            ? "Location wasn’t available. Search for your departure instead."
            : "Location wasn’t available. Search for your pickup instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }
  async function publish() {
    if (!driverPins.origin || !driverPins.destination) {
      setError(null);
      setPublishRouteRequiredPromptOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await cocowheelsApi<{ ride: Ride }>("/api/rides", {
        method: "POST",
        body: JSON.stringify({
          origin: canonicalPin(driverPins.origin),
          destination: canonicalPin(driverPins.destination),
          scheduledDepartureAt: new Date().toISOString(),
          priceAud: Number(price),
          payId,
          payIdType,
        }),
      });
      window.dispatchEvent(new Event("cocowheels:identity-changed"));
      window.location.assign("/activity");
    } catch (reason) {
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
      draft.destination.longitude === riderPins.destination.longitude;
    const savedAt = matchesDraft ? draft.savedAt : Date.now();
    if (!matchesDraft)
      saveRiderSearchDraft(riderPins.pickup, riderPins.destination, riderTime);
    const timer = window.setTimeout(
      () => {
        clearRiderSearchDraft();
        setRiderPins({});
        setRiderTime(null);
        setCandidates([]);
        setSelected(null);
        setRiderRoute(null);
      },
      Math.max(0, savedAt + riderSearchDraftTtlMs - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [riderPins.destination, riderPins.pickup, riderSearchKey, riderTime]);
  useEffect(() => {
    if (
      screen !== "RIDER" ||
      !riderSearchKey ||
      !riderPins.pickup ||
      !riderPins.destination
    ) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void cocowheelsApi<{ candidates: Candidate[]; serverNow: string }>(
        "/api/search",
        {
          method: "POST",
          body: JSON.stringify({
            pickup: canonicalPin(riderPins.pickup!),
            destination: canonicalPin(riderPins.destination!),
            requestedDepartureAt: riderTime
              ? new Date(riderTime).toISOString()
              : new Date().toISOString(),
          }),
        },
      )
        .then((result) => {
          if (cancelled) return;
          setCandidates(result.candidates);
          setCandidateServerNow(result.serverNow);
          setSelected(result.candidates[0]?.rideId ?? null);
        })
        .catch((reason) => !cancelled && setError(humanError(reason)))
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    riderPins.destination,
    riderPins.pickup,
    riderSearchKey,
    riderTime,
    screen,
  ]);
  useEffect(() => {
    if (screen !== "RIDER") return;
    let cancelled = false;
    const load = () => {
      if (!cancelled) setAvailabilityChecking(true);
      cocowheelsApi<{ rides: AvailabilityOffer[]; serverNow: string }>(
        "/api/availability",
      )
        .then((result) => {
          if (cancelled) return;
          setAvailability(result.rides);
          setAvailabilityServerNow(result.serverNow);
        })
        .catch(() => undefined)
        .finally(() => !cancelled && setAvailabilityChecking(false));
    };
    load();
    const timer = window.setInterval(load, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [screen]);
  async function requestSelected(candidate = selectedCandidate) {
    if (!candidate || !riderPins.pickup || !riderPins.destination) return;
    if (candidate.isOwnOffer) {
      setOwnOfferPromptOpen(true);
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
      await cocowheelsApi<{ ride: Ride }>(
        `/api/rides/${encodeURIComponent(candidate.rideId)}/requests`,
        {
          method: "POST",
          body: JSON.stringify({
            pickup: canonicalPin(riderPins.pickup),
            destination: canonicalPin(riderPins.destination),
            requestedDepartureAt: riderTime
              ? new Date(riderTime).toISOString()
              : new Date().toISOString(),
          }),
        },
      );
      window.dispatchEvent(new Event("cocowheels:identity-changed"));
      router.push("/activity");
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.code === "ROLE_CHANGE_REQUIRES_TERMINATION"
      ) {
        setOwnOfferPromptOpen(true);
        return;
      }
      setError(humanError(reason));
    } finally {
      setBusy(false);
    }
  }
  async function action(path: string, body?: unknown) {
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
            "We couldn’t get a fresh location. Check location permission or place yourself where GPS can see the sky.",
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
      {serviceAvailable === false ? (
        <p className="reconnect">Trying to reconnect.</p>
      ) : null}
      {locationPromptTarget ? (
        <LocationPrompt
          target={locationPromptTarget}
          confirm={() => {
            const target = locationPromptTarget;
            setLocationPromptTarget(null);
            requestCurrentLocation(target);
          }}
          close={() => setLocationPromptTarget(null)}
        />
      ) : null}
      {ownOfferPromptOpen ? (
        <OwnOfferPrompt close={() => setOwnOfferPromptOpen(false)} />
      ) : null}
      {routeRequiredPromptOpen ? (
        <RouteRequiredPrompt close={() => setRouteRequiredPromptOpen(false)} />
      ) : null}
      {publishRouteRequiredPromptOpen ? (
        <PublishRouteRequiredPrompt
          close={() => setPublishRouteRequiredPromptOpen(false)}
        />
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
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
          onDepartureRequest={() => setLocationPromptTarget("origin")}
          locatingDeparture={locatingTarget === "origin"}
          allowManualDeparture={allowManualDeparture}
          setOrigin={(pin) => {
            setPinForTarget("origin", pin);
            setAllowManualDeparture(false);
          }}
          setDestination={(pin) => setPinForTarget("destination", pin)}
          price={price}
          setPrice={setPrice}
          payId={payId}
          setPayId={setPayId}
          payIdType={payIdType}
          setPayIdType={setPayIdType}
          submit={publish}
          busy={busy}
        />
      ) : screen === "RIDER" ? (
        <RiderForm
          pins={riderPins}
          countryPreference={countryPreference}
          target={pinTarget}
          setTarget={setPinTarget}
          setPin={setPin}
          onPickupRequest={() => setLocationPromptTarget("pickup")}
          setDestination={(pin) => setPinForTarget("riderDestination", pin)}
          routePoints={activeRiderRoute}
          mapOpen={riderMapOpen}
          setMapOpen={setRiderMapOpen}
          candidates={candidates}
          selected={selected}
          setSelected={setSelected}
          request={requestSelected}
          busy={busy}
          searching={searching}
          availability={availability}
          availabilityServerNow={availabilityServerNow}
          availabilityChecking={availabilityChecking}
          candidateServerNow={candidateServerNow}
          onAvailabilityJoin={() => setRouteRequiredPromptOpen(true)}
          previewRoute={(candidate) => {
            if (!riderPins.pickup || !riderPins.destination) return;
            saveRiderSearchDraft(
              riderPins.pickup,
              riderPins.destination,
              riderTime,
            );
            markRiderSearchReturn();
            saveRiderPreviewRoute(
              candidate.rideId,
              riderPins.pickup,
              riderPins.destination,
              candidate.directionFit,
            );
          }}
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
      <button className="role-card" onClick={() => onBegin("DRIVER")}>
        OFFER A RIDE
      </button>
      <button
        className="role-card role-card-primary"
        onClick={() => onBegin("RIDER")}
      >
        FIND A RIDE
      </button>
      {current.map((item) => (
        <Link
          key={`${item.role}-${item.ride.rideId}`}
          className="home-current-ride"
          href={`/activity/${encodeURIComponent(item.ride.rideId)}${
            item.role === "RIDER" && item.ride.request
              ? `?request=${encodeURIComponent(item.ride.request.requestId)}`
              : ""
          }`}
        >
          <strong>
            {item.role === "DRIVER"
              ? "View your offered ride"
              : "Continue ride request"}
          </strong>
          <code>Ride ID · {routeReference(item.ride.rideId)}</code>
        </Link>
      ))}
    </div>
  );
}
function LocationPrompt({
  target,
  confirm,
  close,
}: {
  target: "origin" | "pickup";
  confirm: () => void;
  close: () => void;
}) {
  const departure = target === "origin";
  return (
    <div className="location-prompt-backdrop" role="presentation">
      <section
        className="location-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-prompt-title"
      >
        <p className="eyebrow">{departure ? "Departure" : "Pickup"}</p>
        <h2 id="location-prompt-title">Use your current location?</h2>
        <p>
          Cocowheels will use your current location as the{" "}
          {departure ? "default departure point" : "pickup location"}.
        </p>
        <div className="location-prompt-actions">
          <button type="button" className="secondary" onClick={close}>
            Not now
          </button>
          <button type="button" className="primary" onClick={confirm}>
            USE CURRENT LOCATION
          </button>
        </div>
      </section>
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
function RouteRequiredPrompt({ close }: { close: () => void }) {
  return (
    <div className="location-prompt-backdrop" role="presentation">
      <section
        className="location-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-required-title"
      >
        <h2 id="route-required-title">Add your route first</h2>
        <p>Fill Where from? and Where to? to join.</p>
        <div className="location-prompt-actions">
          <button type="button" className="primary" onClick={close}>
            OKAY
          </button>
        </div>
      </section>
    </div>
  );
}
function PublishRouteRequiredPrompt({ close }: { close: () => void }) {
  return (
    <div className="location-prompt-backdrop" role="presentation">
      <section
        className="location-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-route-required-title"
      >
        <h2 id="publish-route-required-title">Add your route first</h2>
        <p>Fill Where from? and Where to? to publish.</p>
        <div className="location-prompt-actions">
          <button type="button" className="primary" onClick={close}>
            OKAY
          </button>
        </div>
      </section>
    </div>
  );
}
function PinControls({
  target,
  setTarget,
  setPin,
  onDepartureRequest,
  onPickupRequest,
  locatingDeparture,
  allowManualDeparture,
  pins,
  driver,
  routePoints,
  mapVisible = true,
}: {
  target: PinTarget;
  setTarget: (target: PinTarget) => void;
  setPin: (pin: Pin) => void;
  onDepartureRequest: () => void;
  onPickupRequest?: () => void;
  locatingDeparture: boolean;
  allowManualDeparture: boolean;
  pins: { origin?: Pin; destination?: Pin; pickup?: Pin };
  driver: boolean;
  routePoints?: Pin[] | null;
  mapVisible?: boolean;
}) {
  const first = driver ? "origin" : "pickup";
  const second = driver ? "destination" : "riderDestination";
  const driverMapPoints = [
    ...(pins.origin ? [{ pin: pins.origin, kind: "departure" as const }] : []),
    ...(pins.destination
      ? [{ pin: pins.destination, kind: "destination" as const }]
      : []),
  ];
  const riderMapPoints = [
    ...(pins.pickup ? [{ pin: pins.pickup, kind: "pickup" as const }] : []),
    ...(pins.destination
      ? [{ pin: pins.destination, kind: "destination" as const }]
      : []),
  ];
  const mapPins = driver
    ? driverMapPoints.map((point) => point.pin)
    : riderMapPoints.map((point) => point.pin);
  const markerKinds = driver
    ? driverMapPoints.map((point) => point.kind)
    : riderMapPoints.map((point) => point.kind);
  const startingPoint = driver ? pins.origin : pins.pickup;
  return (
    <>
      {driver ? (
        <div className="pin-tabs">
          <button
            className={target === first ? "active" : ""}
            disabled={driver && locatingDeparture}
            onClick={() =>
              driver ? onDepartureRequest() : onPickupRequest?.()
            }
          >
            {driver ? (
              <>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="6.5" />
                </svg>
                Departure
              </>
            ) : (
              "Pickup"
            )}
          </button>
          <button
            className={target === second ? "active" : ""}
            onClick={() => setTarget(second)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21s6-5.13 6-11a6 6 0 1 0-12 0c0 5.87 6 11 6 11Z" />
              <circle cx="12" cy="10" r="2" />
            </svg>
            Final destination
          </button>
        </div>
      ) : null}
      <div
        className={`pin-summary ${driver ? "driver-location-summary" : "rider-location-summary"}`}
      >
        <p>
          <strong className="location-heading">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="6.5" />
            </svg>
            {driver ? "Departure" : "Where from?"}
          </strong>
          {driver && locatingDeparture
            ? "Finding your current location…"
            : driver && !pins.origin
              ? "Select Departure to use your current location."
              : !driver && !pins.pickup
                ? null
                : locationText(driver ? pins.origin : pins.pickup)}
          {!driver ? (
            <button
              type="button"
              className="pickup-location-button"
              onClick={() => onPickupRequest?.()}
            >
              {pins.pickup ? "Update location" : "Use current location"}
            </button>
          ) : null}
        </p>
        <p>
          <strong className="location-heading">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21s6-5.13 6-11a6 6 0 1 0-12 0c0 5.87 6 11 6 11Z" />
              <circle cx="12" cy="10" r="2" />
            </svg>
            {driver ? "Final destination" : "Where to?"}
          </strong>
          {pins.destination
            ? locationText(pins.destination)
            : driver
              ? "Select Final destination."
              : null}
        </p>
      </div>
      {mapVisible ? (
        <JourneyMap
          pins={mapPins}
          onPick={
            !target
              ? driver
                ? () => onDepartureRequest()
                : setPin
              : driver &&
                  target === "origin" &&
                  !allowManualDeparture &&
                  !pins.origin
                ? undefined
                : setPin
          }
          markerKinds={markerKinds}
          roadPathAttribution={Boolean(routePoints?.length)}
          lines={
            startingPoint && pins.destination
              ? [
                  {
                    points: routePoints?.length
                      ? routePoints
                      : [startingPoint, pins.destination],
                    color: "#111827",
                    muted: !routePoints?.length,
                  },
                ]
              : []
          }
        />
      ) : null}
    </>
  );
}
function DriverForm(props: {
  pins: { origin?: Pin; destination?: Pin };
  countryPreference: string | null;
  onDepartureRequest: () => void;
  locatingDeparture: boolean;
  allowManualDeparture: boolean;
  setOrigin: (pin: Pin) => void;
  setDestination: (pin: Pin) => void;
  price: string;
  setPrice: (value: string) => void;
  payId: string;
  setPayId: (value: string) => void;
  payIdType: PayIdType;
  setPayIdType: (value: PayIdType) => void;
  submit: () => void;
  busy: boolean;
}) {
  return (
    <div className="form-page">
      <h1 className="page-title">Offer a ride</h1>
      <div className="form-panel-content">
        <div className="pin-summary driver-location-summary">
          <p>
            <strong className="location-heading">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="6.5" />
              </svg>
              Where from?
            </strong>
            {props.locatingDeparture
              ? "Finding your current location…"
              : props.pins.origin
                ? locationText(props.pins.origin)
                : null}
            {!props.locatingDeparture ? (
              <button
                type="button"
                className="pickup-location-button"
                onClick={props.onDepartureRequest}
              >
                {props.pins.origin ? "Update location" : "Use current location"}
              </button>
            ) : null}
          </p>
          <p>
            <strong className="location-heading">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21s6-5.13 6-11a6 6 0 1 0-12 0c0 5.87 6 11 6 11Z" />
                <circle cx="12" cy="10" r="2" />
              </svg>
              Where to?
            </strong>
            {props.pins.destination
              ? locationText(props.pins.destination)
              : null}
          </p>
        </div>
        {props.allowManualDeparture && !props.pins.origin ? (
          <PlaceSearch
            placeholder="Search departure"
            autoFocus
            choose={props.setOrigin}
          />
        ) : null}
        <PlaceSearch
          bias={props.pins.origin}
          countryCode={
            props.pins.origin?.countryCode ??
            props.countryPreference ??
            undefined
          }
          placeholder="Search destination"
          autoFocus={!props.allowManualDeparture}
          choose={props.setDestination}
        />
        <label className="field">
          You receive
          <div className="money">
            <b>A$</b>
            <input
              inputMode="numeric"
              type="number"
              min="5"
              step="1"
              value={props.price}
              onChange={(event) => props.setPrice(event.target.value)}
            />
          </div>
        </label>
        <fieldset className="payid-field">
          <legend>Your PayID</legend>
          <div
            className="payid-type-options"
            role="radiogroup"
            aria-label="PayID type"
          >
            {(["MOBILE", "EMAIL", "OTHER"] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={props.payIdType === type}
                className={props.payIdType === type ? "active" : undefined}
                onClick={() => props.setPayIdType(type)}
              >
                {type === "MOBILE"
                  ? "Mobile"
                  : type === "EMAIL"
                    ? "Email"
                    : "Other"}
              </button>
            ))}
          </div>
          <input
            aria-label={`Your PayID ${props.payIdType.toLowerCase()}`}
            inputMode={
              props.payIdType === "MOBILE"
                ? "tel"
                : props.payIdType === "EMAIL"
                  ? "email"
                  : "text"
            }
            placeholder={
              props.payIdType === "MOBILE"
                ? "04xx xxx xxx"
                : props.payIdType === "EMAIL"
                  ? "name@example.com"
                  : "ABN or organisation identifier"
            }
            value={props.payId}
            onChange={(event) => props.setPayId(event.target.value)}
          />
        </fieldset>
        <button
          className="primary"
          disabled={props.busy}
          onClick={props.submit}
        >
          {props.busy ? "Publishing…" : "PUBLISH RIDE"}
        </button>
      </div>
    </div>
  );
}
function RiderForm(props: {
  pins: { pickup?: Pin; destination?: Pin };
  countryPreference: string | null;
  target: PinTarget;
  setTarget: (target: PinTarget) => void;
  setPin: (pin: Pin) => void;
  onPickupRequest: () => void;
  setDestination: (pin: Pin) => void;
  routePoints?: Pin[] | null;
  mapOpen: boolean;
  setMapOpen: (open: boolean) => void;
  candidates: Candidate[];
  selected: string | null;
  setSelected: (id: string) => void;
  request: () => void;
  busy: boolean;
  searching: boolean;
  availability: AvailabilityOffer[];
  availabilityServerNow: string | null;
  availabilityChecking: boolean;
  candidateServerNow: string | null;
  onAvailabilityJoin: () => void;
  previewRoute: (candidate: Candidate) => void;
}) {
  return (
    <div className="form-page">
      <h1 className="page-title">Find a ride</h1>
      <div className="form-panel-content">
        <PinControls
          target={props.target}
          setTarget={props.setTarget}
          setPin={props.setPin}
          onDepartureRequest={() => undefined}
          onPickupRequest={props.onPickupRequest}
          locatingDeparture={false}
          allowManualDeparture={false}
          routePoints={props.routePoints}
          pins={props.pins}
          driver={false}
          mapVisible={props.mapOpen}
        />
        <PlaceSearch
          bias={props.pins.pickup}
          countryCode={
            props.pins.pickup?.countryCode ??
            props.countryPreference ??
            undefined
          }
          placeholder="Search destination"
          autoFocus={!props.pins.destination}
          choose={(pin) => {
            props.setDestination(pin);
            props.setTarget("riderDestination");
            props.setMapOpen(false);
          }}
        />
        {props.pins.pickup && props.pins.destination ? (
          <Results
            candidates={props.candidates}
            serverNow={props.candidateServerNow}
            selected={props.selected}
            setSelected={props.setSelected}
            request={props.request}
            previewRoute={props.previewRoute}
            busy={props.busy}
            searching={props.searching}
          />
        ) : (
          <AvailabilityBoard
            rides={props.availability}
            serverNow={props.availabilityServerNow}
            checking={props.availabilityChecking}
            onJoin={props.onAvailabilityJoin}
          />
        )}
      </div>
    </div>
  );
}
function PlaceSearch({
  bias,
  countryCode,
  choose,
  placeholder,
  autoFocus = false,
}: {
  bias?: Pin;
  countryCode?: string;
  choose: (pin: Pin) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [places, setPlaces] = useState<Pin[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoFocus) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus]);
  const search = () => {
    if (text.trim().length < 3) {
      inputRef.current?.focus();
      return;
    }
    void cocowheelsApi<{ places: Pin[] }>("/api/place-search", {
      method: "POST",
      body: JSON.stringify({
        text,
        ...(bias ? { bias: canonicalPin(bias) } : {}),
        ...(countryCode ? { countryCode } : {}),
      }),
    })
      .then((result) => setPlaces(result.places))
      .catch(() => setPlaces([]));
  };
  return (
    <div className="place-search">
      <div className="place-search-input">
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPlaces([]);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <button type="button" onClick={search}>
          Search
        </button>
      </div>
      {places.length ? (
        <div className="place-results">
          {places.map((place) => (
            <button
              type="button"
              key={`${place.latitude}:${place.longitude}`}
              onClick={() => {
                choose(place);
                setText(place.label ?? "");
                setPlaces([]);
              }}
            >
              {place.label ??
                `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
function AvailabilityBoard({
  rides,
  serverNow,
  checking,
  onJoin,
}: {
  rides: AvailabilityOffer[];
  serverNow: string | null;
  checking: boolean;
  onJoin: () => void;
}) {
  return (
    <section className="availability-board" aria-live="polite">
      <div className="availability-heading" aria-hidden="true">
        <span>Route ID</span>
        <span>Driver</span>
        <span>Where from?</span>
        <span>Where to?</span>
        <span>Expiry</span>
        <span>Price</span>
        <span>View</span>
        <span>Fit</span>
        <span>Action</span>
      </div>
      {rides.map((ride) => (
        <div className="availability-row" key={ride.rideId}>
          <code>{routeReference(ride.rideId)}</code>
          <strong tabIndex={0}>{ride.driverAlias}</strong>
          <span tabIndex={0}>{ride.departureLabel ?? "Location pending"}</span>
          <span tabIndex={0}>
            {ride.destinationLabel ?? "Location pending"}
          </span>
          <span className="availability-expiry">
            {serverNow ? (
              <ExpiryCountdown
                key={serverNow}
                expiresAt={ride.expiresAt}
                serverNow={serverNow}
              />
            ) : (
              "—"
            )}
          </span>
          <b>A${ride.priceAud}</b>
          <Link
            className="availability-view"
            href={`/rides/${encodeURIComponent(ride.rideId)}`}
          >
            OPEN
          </Link>
          <span aria-label="Set a route to calculate direction fit"></span>
          <button type="button" className="availability-join" onClick={onJoin}>
            JOIN
          </button>
        </div>
      ))}
      {!rides.length ? (
        <p className="availability-empty">
          {checking ? "Checking available rides…" : "0 available rides"}
        </p>
      ) : null}
    </section>
  );
}
function Results({
  candidates,
  serverNow,
  selected,
  setSelected,
  request,
  previewRoute,
  busy,
  searching,
}: {
  candidates: Candidate[];
  serverNow: string | null;
  selected: string | null;
  setSelected: (id: string) => void;
  request: (candidate?: Candidate) => void;
  previewRoute: (candidate: Candidate) => void;
  busy: boolean;
  searching: boolean;
}) {
  return (
    <div className="results">
      <h2>Rides available</h2>
      {searching ? null : candidates.length === 0 ? (
        <div className="empty">
          <h2>No planned rides yet</h2>
        </div>
      ) : (
        <>
          <div className="availability-board matched-availability">
            <div className="availability-heading" aria-hidden="true">
              <span>Route ID</span>
              <span>Driver</span>
              <span>Where from?</span>
              <span>Where to?</span>
              <span>Expiry</span>
              <span>Price</span>
              <span>View</span>
              <span>Fit</span>
              <span>Action</span>
            </div>
            {candidates.map((candidate) => (
              <article
                key={candidate.rideId}
                className={`availability-row availability-select ${candidate.rideId === selected ? "selected" : ""}`}
                onClick={() => setSelected(candidate.rideId)}
              >
                <code>{routeReference(candidate.rideId)}</code>
                <strong>{candidate.driverAlias}</strong>
                <span>{candidate.departureLabel ?? "—"}</span>
                <span>{candidate.destinationLabel ?? "—"}</span>
                <span className="availability-expiry">
                  {serverNow ? (
                    <ExpiryCountdown
                      key={serverNow}
                      expiresAt={candidate.expiresAt}
                      serverNow={serverNow}
                    />
                  ) : (
                    "—"
                  )}
                </span>
                <b>A${candidate.priceAud}</b>
                <Link
                  className="availability-view"
                  href={`/rides/${encodeURIComponent(candidate.rideId)}`}
                  onClick={() => previewRoute(candidate)}
                >
                  OPEN
                </Link>
                <span
                  className={`direction-fit direction-fit-${candidate.directionFit.toLowerCase()}`}
                  aria-label={`Direction fit: ${candidate.directionFit === "GOOD" ? "Good" : "Poor"}`}
                >
                  {candidate.directionFit === "GOOD" ? "Good" : "Poor"}
                </span>
                <button
                  type="button"
                  className="availability-join"
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation();
                    request(candidate);
                  }}
                >
                  JOIN
                </button>
              </article>
            ))}
          </div>
        </>
      )}
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
        ? "Rider accepted"
        : ride.status === "RIDE_ACTIVE"
          ? "Heading to pickup"
          : ride.status === "CO_RIDE_ACTIVE"
            ? "Co-ride in progress"
            : ride.status === "COMPLETED"
              ? "Co-ride complete"
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
        {driver ? "Your published ride" : "Your ride request"}
      </h1>
      {statusTitle ? <h2 className="status-heading">{statusTitle}</h2> : null}
      <div className="ride-summary">
        <span>{ride.driverAlias}</span>
        <strong>A${ride.priceAud}</strong>
        <small>{prettyTime(ride.scheduledDepartureAt)}</small>
      </div>
      {driver && ride.requests?.length ? (
        <section className="request-stack">
          {ride.requests.map((item) => (
            <article key={item.requestId} className="request-card">
              <strong>{item.riderAlias}</strong>
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
                ? "Ask the rider to share a fresh location."
                : ride.status === "ACCEPTED"
                  ? "The driver will become visible after they begin the ride."
                  : "Waiting for a fresh location."}
            </p>
          )}
          <button className="secondary" disabled={busy} onClick={onLocation}>
            SHARE FRESH LOCATION
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
            BEGIN CO-RIDE
          </button>
        </section>
      ) : null}
      {ride.status === "CO_RIDE_ACTIVE" && !driver ? (
        <section className="payment-card">
          <h2>Payment handoff</h2>
          {ride.payId ? (
            <>
              <p>PayID is now visible only to you.</p>
              <code>{ride.payId}</code>
              <button
                className="secondary"
                onClick={() =>
                  void navigator.clipboard?.writeText(ride.payId ?? "")
                }
              >
                COPY PAYID
              </button>
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
                  `Cocowheels co-ride ${routeReference(ride.rideId)}`,
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
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              onAction(`/api/rides/${ride.rideId}/complete`, { method: "CASH" })
            }
          >
            COMPLETE · CASH
          </button>
          <small>
            Cocowheels records your chosen handoff only. It never verifies a
            bank payment.
          </small>
        </section>
      ) : null}
      {ride.status === "COMPLETED" ? (
        <section className="complete-card">
          <p>Private completed record</p>
          <strong>
            {ride.paymentHandoffMethod === "PAYID"
              ? "PayID handoff selected"
              : "Cash handoff selected"}
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
