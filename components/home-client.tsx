"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Candidate, Pin, Ride } from "@/lib/client-types";

const JourneyMap = dynamic(() => import("./journey-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});
type Role = "DRIVER" | "RIDER";
type FormPin = "origin" | "destination" | "pickup" | "riderDestination";
const localDateTime = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
const defaultTime = () => localDateTime(new Date());
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
    ? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`
    : "Place a pin on the map";
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
  const [pinTarget, setPinTarget] = useState<FormPin>("origin");
  const [riderTime, setRiderTime] = useState(defaultTime);
  const [leaveNow, setLeaveNow] = useState(true);
  const [price, setPrice] = useState("10");
  const [payId, setPayId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [code, setCode] = useState("");
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
        setRole(result.current.role);
        setRide(result.current.ride);
        setScreen("HOME");
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
    setPinTarget(roleChoice === "DRIVER" ? "destination" : "pickup");
    setScreen(roleChoice === "DRIVER" ? "DRIVER" : "RIDER");
    setError(null);
    if (roleChoice === "DRIVER") requestCurrentLocation("origin", false);
  }
  function setPin(pin: Pin) {
    if (pinTarget === "origin")
      setDriverPins((state) => ({ ...state, origin: pin }));
    if (pinTarget === "destination")
      setDriverPins((state) => ({ ...state, destination: pin }));
    if (pinTarget === "pickup")
      setRiderPins((state) => ({ ...state, pickup: pin }));
    if (pinTarget === "riderDestination")
      setRiderPins((state) => ({ ...state, destination: pin }));
  }
  function requestCurrentLocation(target: FormPin, selectTarget = true) {
    if (selectTarget) setPinTarget(target);
    if (!navigator.geolocation) {
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
          setDriverPins((state) => ({ ...state, origin: pin }));
          setPinTarget("destination");
        }
        if (target === "pickup") {
          setRiderPins((state) => ({ ...state, pickup: pin }));
          setPinTarget("pickup");
        }
        setBusy(false);
      },
      () => {
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
      setError("Place both departure and destination pins first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await cocowheelsApi<{ ride: Ride }>("/api/rides", {
        method: "POST",
        body: JSON.stringify({
          origin: driverPins.origin,
          destination: driverPins.destination,
          scheduledDepartureAt: new Date().toISOString(),
          priceAud: Number(price),
          payId,
        }),
      });
      setRide(result.ride);
      setRole("DRIVER");
      setScreen("HOME");
    } catch (reason) {
      setError(humanError(reason));
    } finally {
      setBusy(false);
    }
  }
  async function search() {
    if (!riderPins.pickup || !riderPins.destination) {
      setError("Place pickup and destination pins first.");
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
            pickup: riderPins.pickup,
            destination: riderPins.destination,
            requestedDepartureAt: new Date(
              leaveNow ? Date.now() : riderTime,
            ).toISOString(),
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
            pickup: riderPins.pickup,
            destination: riderPins.destination,
            requestedDepartureAt: new Date(
              leaveNow ? Date.now() : riderTime,
            ).toISOString(),
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
    if (!ride) return;
    setBusy(true);
    setError(null);
    try {
      const result = await cocowheelsApi<{ ride: Ride }>(path, {
        method: path.includes("/requests/") ? "PATCH" : "POST",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      setRide(result.ride);
      setServiceAvailable(true);
    } catch (reason) {
      setError(humanError(reason));
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
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {ride ? (
        status
      ) : screen === "HOME" ? (
        <Home onBegin={begin} />
      ) : screen === "DRIVER" ? (
        <DriverForm
          pins={driverPins}
          target={pinTarget}
          setTarget={setPinTarget}
          setPin={setPin}
          onCurrent={requestCurrentLocation}
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
          onCurrent={requestCurrentLocation}
          time={riderTime}
          setTime={setRiderTime}
          leaveNow={leaveNow}
          setLeaveNow={setLeaveNow}
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

function Home({ onBegin }: { onBegin: (role: Role) => void }) {
  return (
    <div className="role-choice">
      <button className="role-card" onClick={() => onBegin("DRIVER")}>
        I’m driving
      </button>
      <button className="role-card" onClick={() => onBegin("RIDER")}>
        I need a ride
      </button>
    </div>
  );
}
function TimeInput({
  leaveNow,
  setLeaveNow,
  time,
  setTime,
}: {
  leaveNow: boolean;
  setLeaveNow: (value: boolean) => void;
  time: string;
  setTime: (value: string) => void;
}) {
  return (
    <fieldset className="time-choice">
      <legend>Departure timing</legend>
      <label>
        <input
          type="radio"
          checked={leaveNow}
          onChange={() => setLeaveNow(true)}
        />{" "}
        Leave now
      </label>
      <label>
        <input
          type="radio"
          checked={!leaveNow}
          onChange={() => setLeaveNow(false)}
        />{" "}
        Plan a time
      </label>
      {!leaveNow ? (
        <input
          aria-label="Planned departure time"
          type="datetime-local"
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
      ) : null}
    </fieldset>
  );
}
function PinControls({
  target,
  setTarget,
  setPin,
  onCurrent,
  pins,
  driver,
}: {
  target: FormPin;
  setTarget: (target: FormPin) => void;
  setPin: (pin: Pin) => void;
  onCurrent: (target: FormPin, selectTarget?: boolean) => void;
  pins: { origin?: Pin; destination?: Pin; pickup?: Pin };
  driver: boolean;
}) {
  const first = driver ? "origin" : "pickup";
  const second = driver ? "destination" : "riderDestination";
  return (
    <>
      <div className="pin-tabs">
        <button
          className={target === first ? "active" : ""}
          onClick={() => (driver ? onCurrent(first) : setTarget(first))}
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
          {locationText(driver ? pins.origin : pins.pickup)}
        </p>
        <p>
          <strong>{driver ? "Final destination" : "Destination"}</strong>
          {locationText(pins.destination)}
        </p>
      </div>
      <JourneyMap
        pins={
          [driver ? pins.origin : pins.pickup, pins.destination].filter(
            Boolean,
          ) as Pin[]
        }
        onPick={setPin}
      />
      <p className="map-help">
        {driver && target === "destination"
          ? "Tap the map to place the final destination."
          : "Tap the map to place the selected pin. A pin is the source of truth."}
      </p>
      {!driver ? (
        <button
          type="button"
          className="secondary"
          onClick={() => onCurrent(first)}
        >
          Use my current location for pickup
        </button>
      ) : null}
    </>
  );
}
function DriverForm(props: {
  pins: { origin?: Pin; destination?: Pin };
  target: FormPin;
  setTarget: (target: FormPin) => void;
  setPin: (pin: Pin) => void;
  onCurrent: (target: FormPin, selectTarget?: boolean) => void;
  price: string;
  setPrice: (value: string) => void;
  payId: string;
  setPayId: (value: string) => void;
  submit: () => void;
  busy: boolean;
}) {
  return (
    <div className="form-page">
      <p className="eyebrow">I’m driving</p>
      <h1>Publish your planned ride</h1>
      <PinControls
        target={props.target}
        setTarget={props.setTarget}
        setPin={props.setPin}
        onCurrent={props.onCurrent}
        pins={props.pins}
        driver
      />
      <label className="field">
        Price <span>AUD, whole dollars</span>
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
  target: FormPin;
  setTarget: (target: FormPin) => void;
  setPin: (pin: Pin) => void;
  onCurrent: (target: FormPin, selectTarget?: boolean) => void;
  time: string;
  setTime: (value: string) => void;
  leaveNow: boolean;
  setLeaveNow: (value: boolean) => void;
  submit: () => void;
  busy: boolean;
}) {
  return (
    <div className="form-page">
      <p className="eyebrow">I need a ride</p>
      <h1>Find a planned ride</h1>
      <p className="intro">
        Pick your journey, then compare fixed-price offers.
      </p>
      <PinControls
        target={props.target}
        setTarget={props.setTarget}
        setPin={props.setPin}
        onCurrent={props.onCurrent}
        pins={props.pins}
        driver={false}
      />
      <TimeInput
        leaveNow={props.leaveNow}
        setLeaveNow={props.setLeaveNow}
        time={props.time}
        setTime={props.setTime}
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
  onAction: (path: string, body?: unknown) => Promise<void>;
  onLocation: () => void;
}) {
  const driver = role === "DRIVER";
  const request = ride.request;
  const canCancel = ![
    "CO_RIDE_ACTIVE",
    "COMPLETED",
    "CANCELLED",
    "EXPIRED",
  ].includes(ride.status);
  const location = driver ? ride.riderLocation : ride.driverLocation;
  return (
    <div className="status-page">
      <p className="eyebrow">
        {driver ? "Your published ride" : "Your ride request"}
      </p>
      <h1>
        {ride.status === "PUBLISHED"
          ? "Waiting for a rider"
          : ride.status === "REQUESTED" && driver
            ? "Rider requests"
            : ride.status === "ACCEPTED"
              ? "Rider accepted"
              : ride.status === "RIDE_ACTIVE"
                ? "Heading to pickup"
                : ride.status === "CO_RIDE_ACTIVE"
                  ? "Co-ride in progress"
                  : ride.status === "COMPLETED"
                    ? "Co-ride complete"
                    : ride.status === "CANCELLED"
                      ? "Ride cancelled"
                      : "Ride expired"}
      </h1>
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
          onClick={() =>
            onAction(
              ride.status === "REQUESTED" && !driver
                ? `/api/rides/${ride.rideId}/request/cancel`
                : `/api/rides/${ride.rideId}/cancel`,
            )
          }
        >
          {ride.status === "REQUESTED" && !driver
            ? "WITHDRAW REQUEST"
            : "CANCEL RIDE"}
        </button>
      ) : null}
    </div>
  );
}
