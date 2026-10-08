"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import CancelPrompt from "./cancel-prompt";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Candidate, Pin, Ride } from "@/lib/client-types";

const JourneyMap = dynamic(() => import("./journey-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});
type Role = "DRIVER" | "RIDER";
type FormPin = "origin" | "destination" | "pickup" | "riderDestination";
type PinTarget = FormPin | null;
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
const humanError = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : "REQUEST_FAILED";
  const messages: Record<string, string> = {
    SERVICE_UNAVAILABLE:
      "Trying to reconnect. Your last known ride is still safe on the server.",
    OPEN_ITEM_EXISTS:
      "Finish or cancel your current item before changing role.",
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

export default function HomeClient() {
  const [screen, setScreen] = useState<"HOME" | "DRIVER" | "RIDER" | "RESULTS">(
    "HOME",
  );
  const [role, setRole] = useState<Role | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [homeCurrent, setHomeCurrent] = useState<{
    role: Role;
    ride: Ride;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(
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
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [locationPromptTarget, setLocationPromptTarget] =
    useState<"origin" | "pickup" | null>(null);
  const [locatingTarget, setLocatingTarget] = useState<FormPin | null>(null);
  const [allowManualDeparture, setAllowManualDeparture] = useState(false);
  const [driverRoute, setDriverRoute] = useState<{
    coordinates: string;
    points: Pin[];
  } | null>(null);
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

  async function refreshCurrent() {
    try {
      const result = await cocowheelsApi<{
        current: { role: Role; ride: Ride } | null;
      }>("/api/current");
      setServiceAvailable(true);
      if (result.current) {
        setHomeCurrent(result.current);
        setScreen("HOME");
      } else {
        setHomeCurrent(null);
      }
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setServiceAvailable(true);
        return;
      }
      setServiceAvailable(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void refreshCurrent(), 0);
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

  function begin(roleChoice: Role) {
    if (ride) return;
    setRole(roleChoice);
    setPinTarget(null);
    if (roleChoice === "DRIVER") setAllowManualDeparture(false);
    setScreen(roleChoice === "DRIVER" ? "DRIVER" : "RIDER");
    setError(null);
  }
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
      void cocowheelsApi<{ label: string | null }>("/api/place-label", {
        method: "POST",
        body: JSON.stringify({ pin: canonicalPin(pin) }),
      })
        .then(({ label }) => {
          if (!label || placeLookupIds.current[target] !== requestId) return;
          setPinForTarget(target, { ...pin, label });
        })
        .catch(() => undefined);
    }
  }, [placePins]);
  const originLatitude = driverPins.origin?.latitude;
  const originLongitude = driverPins.origin?.longitude;
  const destinationLatitude = driverPins.destination?.latitude;
  const destinationLongitude = driverPins.destination?.longitude;
  const driverRouteInput = useMemo(() => {
    if (
      originLatitude === undefined ||
      originLongitude === undefined ||
      destinationLatitude === undefined ||
      destinationLongitude === undefined
    )
      return null;
    return {
      origin: { latitude: originLatitude, longitude: originLongitude },
      destination: {
        latitude: destinationLatitude,
        longitude: destinationLongitude,
      },
    };
  }, [
    destinationLatitude,
    destinationLongitude,
    originLatitude,
    originLongitude,
  ]);
  const driverRouteCoordinates = driverRouteInput
    ? `${driverRouteInput.origin.latitude}:${driverRouteInput.origin.longitude}|${driverRouteInput.destination.latitude}:${driverRouteInput.destination.longitude}`
    : "";
  useEffect(() => {
    if (!driverRouteInput) return;
    void cocowheelsApi<{ points: Pin[] }>("/api/route-preview", {
      method: "POST",
      body: JSON.stringify(driverRouteInput),
    })
      .then(({ points }) => {
        if (points.length >= 2)
          setDriverRoute({ coordinates: driverRouteCoordinates, points });
      })
      .catch(() => undefined);
  }, [driverRouteCoordinates, driverRouteInput]);
  const activeDriverRoute =
    driverRoute?.coordinates === driverRouteCoordinates
      ? driverRoute.points
      : null;
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
    riderRoute?.coordinates === riderRouteCoordinates ? riderRoute.points : null;
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
        "This browser cannot provide location. Place a pin on the map instead.",
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
          "Location wasn’t available. You can place a pin manually on the map.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }
  async function publish() {
    if (!driverPins.origin || !driverPins.destination) {
      setError("Select both your departure and final destination.");
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
        }),
      });
      window.location.assign("/activity");
    } catch (reason) {
      setError(humanError(reason));
    } finally {
      setBusy(false);
    }
  }
  async function search() {
    if (!riderPins.pickup || !riderPins.destination) {
      setError("Select both pickup and destination locations.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await cocowheelsApi<{ candidates: Candidate[] }>(
        "/api/search",
        {
          method: "POST",
          body: JSON.stringify({
            pickup: canonicalPin(riderPins.pickup),
            destination: canonicalPin(riderPins.destination),
            requestedDepartureAt: new Date().toISOString(),
          }),
        },
      );
      setCandidates(result.candidates);
      setSelected(result.candidates[0]?.rideId ?? null);
      setScreen("RESULTS");
    } catch (reason) {
      setError(humanError(reason));
    } finally {
      setBusy(false);
    }
  }
  async function requestSelected() {
    if (!selectedCandidate || !riderPins.pickup || !riderPins.destination)
      return;
    setBusy(true);
    setError(null);
    try {
      const result = await cocowheelsApi<{ ride: Ride }>(
        `/api/rides/${encodeURIComponent(selectedCandidate.rideId)}/requests`,
        {
          method: "POST",
          body: JSON.stringify({
            pickup: canonicalPin(riderPins.pickup),
            destination: canonicalPin(riderPins.destination),
            requestedDepartureAt: new Date().toISOString(),
          }),
        },
      );
      setRide(result.ride);
      setRole("RIDER");
      setScreen("HOME");
    } catch (reason) {
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
    <section className="page-content">
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
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {ride ? (
        status
      ) : screen === "HOME" ? (
        <Home
          current={homeCurrent}
          onBegin={begin}
          onContinue={() => {
            if (!homeCurrent) return;
            setRole(homeCurrent.role);
            setRide(homeCurrent.ride);
            setHomeCurrent(null);
          }}
        />
      ) : screen === "DRIVER" ? (
        <DriverForm
          pins={driverPins}
          target={pinTarget}
          setTarget={setPinTarget}
          setPin={setPin}
          onDepartureRequest={() => setLocationPromptTarget("origin")}
          locatingDeparture={locatingTarget === "origin"}
          allowManualDeparture={allowManualDeparture}
          routePoints={activeDriverRoute}
          price={price}
          setPrice={setPrice}
          payId={payId}
          setPayId={setPayId}
          submit={publish}
          busy={busy}
        />
      ) : screen === "RIDER" ? (
        <RiderForm
          pins={riderPins}
          target={pinTarget}
          setTarget={setPinTarget}
          setPin={setPin}
          onPickupRequest={() => setLocationPromptTarget("pickup")}
          routePoints={activeRiderRoute}
          submit={search}
          busy={busy}
        />
      ) : (
        <Results
          candidates={candidates}
          selected={selected}
          setSelected={setSelected}
          pickup={riderPins.pickup!}
          destination={riderPins.destination!}
          request={requestSelected}
          back={() => setScreen("RIDER")}
          busy={busy}
        />
      )}
    </section>
  );
}

function Home({
  current,
  onBegin,
  onContinue,
}: {
  current: { role: Role; ride: Ride } | null;
  onBegin: (role: Role) => void;
  onContinue: () => void;
}) {
  return (
    <div className="role-choice">
      <button
        className="role-card"
        disabled={Boolean(current)}
        onClick={() => onBegin("DRIVER")}
      >
        Offer a ride
      </button>
      <button
        className="role-card"
        disabled={Boolean(current)}
        onClick={() => onBegin("RIDER")}
      >
        Find a ride
      </button>
      {current ? (
        <button type="button" className="home-current-ride" onClick={onContinue}>
          <strong>
            {current.role === "DRIVER"
              ? "Continue offering a ride"
              : "Continue ride request"}
          </strong>
          <code>Ride ID · {current.ride.rideId}</code>
        </button>
      ) : null}
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
          Cocowheels will use your current location as the {departure
            ? "default departure point"
            : "pickup location"}.
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
      <div className="pin-tabs">
        <button
          className={target === first ? "active" : ""}
          disabled={driver && locatingDeparture}
          onClick={() =>
            driver ? onDepartureRequest() : onPickupRequest?.()
          }
        >
          {driver ? "Departure" : "Pickup"}
        </button>
        <button
          className={target === second ? "active" : ""}
          onClick={() => setTarget(second)}
        >
          {driver ? "Final destination" : "Destination"}
        </button>
      </div>
      <div className="pin-summary">
        <p>
          <strong>{driver ? "Departure" : "Pickup"}</strong>
          {driver && locatingDeparture
            ? "Finding your current location…"
            : driver && !pins.origin
              ? "Select Departure to use your current location."
              : !driver && !pins.pickup
                ? "Select Pickup or use your current location."
              : locationText(driver ? pins.origin : pins.pickup)}
        </p>
        <p>
          <strong>{driver ? "Final destination" : "Destination"}</strong>
          {pins.destination
            ? locationText(pins.destination)
            : `Select ${driver ? "Final destination" : "Destination"}.`}
        </p>
      </div>
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
    </>
  );
}
function DriverForm(props: {
  pins: { origin?: Pin; destination?: Pin };
  target: PinTarget;
  setTarget: (target: PinTarget) => void;
  setPin: (pin: Pin) => void;
  onDepartureRequest: () => void;
  locatingDeparture: boolean;
  allowManualDeparture: boolean;
  routePoints?: Pin[] | null;
  price: string;
  setPrice: (value: string) => void;
  payId: string;
  setPayId: (value: string) => void;
  submit: () => void;
  busy: boolean;
}) {
  return (
    <div className="form-page">
      <h1 className="page-title">Offer a ride</h1>
      <PinControls
        target={props.target}
        setTarget={props.setTarget}
        setPin={props.setPin}
        onDepartureRequest={props.onDepartureRequest}
        locatingDeparture={props.locatingDeparture}
        allowManualDeparture={props.allowManualDeparture}
        routePoints={props.routePoints}
        pins={props.pins}
        driver
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
      <label className="field">
        Your PayID
        <input
          placeholder="Mobile, email, or other identifier"
          value={props.payId}
          onChange={(event) => props.setPayId(event.target.value)}
        />
      </label>
      <button className="primary" disabled={props.busy} onClick={props.submit}>
        {props.busy ? "Publishing…" : "PUBLISH RIDE"}
      </button>
    </div>
  );
}
function RiderForm(props: {
  pins: { pickup?: Pin; destination?: Pin };
  target: PinTarget;
  setTarget: (target: PinTarget) => void;
  setPin: (pin: Pin) => void;
  onPickupRequest: () => void;
  routePoints?: Pin[] | null;
  submit: () => void;
  busy: boolean;
}) {
  return (
    <div className="form-page">
      <h1 className="page-title">Find a ride</h1>
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
      />
      <button className="primary" disabled={props.busy} onClick={props.submit}>
        {props.busy ? "Searching…" : "FIND RIDES"}
      </button>
    </div>
  );
}
function Results({
  candidates,
  selected,
  setSelected,
  pickup,
  destination,
  request,
  back,
  busy,
}: {
  candidates: Candidate[];
  selected: string | null;
  setSelected: (id: string) => void;
  pickup: Pin;
  destination: Pin;
  request: () => void;
  back: () => void;
  busy: boolean;
}) {
  const active = candidates.find((candidate) => candidate.rideId === selected);
  return (
    <div className="results">
      <button className="text-button" onClick={back}>
        ← Edit journey
      </button>
      <p className="eyebrow">Compatible planned rides</p>
      <h1>Choose one offer</h1>
      {candidates.length === 0 ? (
        <div className="empty">
          <h2>No planned rides yet</h2>
          <p>
            Try another time or check again soon. Cocowheels does not invent
            routes or drivers.
          </p>
        </div>
      ) : (
        <>
          <div className="candidate-list">
            {candidates.map((candidate) => (
              <button
                key={candidate.rideId}
                className={`candidate ${candidate.rideId === selected ? "selected" : ""}`}
                onClick={() => setSelected(candidate.rideId)}
              >
                <span>
                  <strong>{candidate.driverAlias}</strong>
                  <small>
                    {prettyTime(candidate.scheduledDepartureAt)} ·{" "}
                    {candidate.directionFit === "GOOD"
                      ? "Good fit"
                      : "Poor fit"}
                  </small>
                </span>
                <b>A${candidate.priceAud}</b>
              </button>
            ))}
          </div>
          <JourneyMap
            pins={[pickup, destination]}
            lines={candidates
              .map((candidate) => ({
                points: candidate.redactedCorridor,
                color: candidate.rideId === selected ? "#ef476f" : "#073b4c",
                muted: candidate.rideId !== selected,
              }))
              .concat(
                active
                  ? [
                      {
                        points: [pickup, destination] as [Pin, Pin],
                        color: "#ff6b35",
                        muted: false,
                      },
                    ]
                  : [],
              )}
          />
          <p className="map-help">
            The map shows simple planned direction lines, not road routes or
            navigation.
          </p>
          <button
            className="primary"
            disabled={!active || busy}
            onClick={request}
          >
            {busy
              ? "Requesting…"
              : `REQUEST TO JOIN · A$${active?.priceAud ?? ""}`}
          </button>
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
      <p className="eyebrow">
        {driver ? "Your published ride" : "Your ride request"}
      </p>
      {statusTitle ? <h1>{statusTitle}</h1> : null}
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
                  `Cocowheels co-ride ${ride.rideId}`,
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
          <small>Ride reference: {ride.rideId}</small>
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
