"use client";
import ContributionChoice from "./contribution-choice";
import { fareLabel } from "@/lib/fare";
import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useRouter } from "next/navigation";
import { cocowheelsApi, ApiError, apiErrorMessage } from "@/lib/api-client";
import { WEEKDAYS, scheduleWindow, type UsualRoute } from "@/lib/usual-route";
import type { Pin, Ride, Candidate } from "@/lib/client-types";
import {
  saveRiderPreviewRoute,
  saveRiderSearchDraft,
} from "@/lib/ride-preview-cache";
import { payIdInputError, PAYID_MAX_LENGTH } from "@/lib/input-validation";
import { PlaceSearch } from "./home-client";
import DepartureChoice from "./departure-choice";
import { Message } from "./ride-journey-controls";
import RideFieldLabel from "./ride-field-label";

export default function UsualRouteClient({ match }: { match: string | null }) {
  const router = useRouter();
  const [saved, setSaved] = useState<UsualRoute | null>(null);
  const [origin, setOrigin] = useState<Pin>();
  const [destination, setDestination] = useState<Pin>();
  const [days, setDays] = useState<number[]>([]);
  const [minute, setMinute] = useState("");
  const [alerts, setAlerts] = useState(false);
  const [fare, setFare] = useState("5");
  const [contribution, setContribution] = useState(false);
  const [payId, setPayId] = useState("");
  const [payIdType, setPayIdType] = useState<UsualRoute["payIdType"]>("MOBILE");
  const [leaving, setLeaving] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [generation] = useState(() => ({ value: 0 }));
  useEffect(() => {
    let live = true;
    const load = () => {
      const current = ++generation.value;
      setLoading(true);
      setLoadFailed(false);
      setConfirmRemove(false);
      setVerified(false);
      setSaved(null);
      setOrigin(undefined);
      setDestination(undefined);
      setPayId("");
      setDays([]);
      setMinute("");
      setAlerts(false);
      setFare("5");
      setContribution(false);
      setPayIdType("MOBILE");
      void cocowheelsApi<{
        route: UsualRoute | null;
        alertsAvailable: boolean;
      }>("/api/usual-route")
        .then((result) => {
          if (live && current === generation.value) {
            setSaved(result.route);
            if (result.route) {
              setContribution(result.route.priceAud > 0);
              setFare(String(result.route.priceAud || 5));
              setPayId(result.route.payId);
              setPayIdType(result.route.payIdType);
            }
            setAvailable(result.alertsAvailable);
            setVerified(true);
          }
        })
        .catch((reason) => {
          if (live && current === generation.value) {
            setVerified(false);
            if (!(reason instanceof ApiError && reason.status === 401)) {
              setLoadFailed(true);
              setError(
                apiErrorMessage(
                  reason,
                  "We couldn’t load your usual route. Please try again.",
                ),
              );
            }
          }
        })
        .finally(() => {
          if (live && current === generation.value) setLoading(false);
        });
    };
    void Promise.resolve().then(() => {
      if (live) load();
    });
    window.addEventListener("cocowheels:identity-changed", load);
    return () => {
      live = false;
      ++generation.value;
      window.removeEventListener("cocowheels:identity-changed", load);
    };
  }, [generation, reload]);
  const fail = (reason: unknown) => {
    const code = reason instanceof ApiError ? reason.code : "";
    setError(
      code === "ROLE_CHANGE_REQUIRES_TERMINATION"
        ? "To offer a ride, first withdraw or end your rider request."
        : code === "OPEN_ITEM_EXISTS"
          ? "You already have an active ride. Open it from Profile."
          : code === "RIDE_UNAVAILABLE"
            ? "This ride is no longer available."
            : code === "PAYID_REQUIRED"
              ? "Add your PayID before offering a ride."
              : apiErrorMessage(
                  reason,
                  "We couldn’t complete that action. Please try again.",
                ),
    );
  };
  async function persist(route: UsualRoute) {
    const current = generation.value;
    const result = await cocowheelsApi<{ route: UsualRoute }>(
      "/api/usual-route",
      { method: "POST", body: JSON.stringify(route) },
      true,
    );
    if (current === generation.value) setSaved(result.route);
  }
  async function save() {
    if (!origin || !destination) {
      setError("Choose your origin and destination from the search results.");
      return;
    }
    if (alerts && (!days.length || !minute)) {
      setError("Select your travel days and a time for matching emails.");
      return;
    }
    if (Boolean(days.length) !== Boolean(minute)) {
      setError(
        "Choose both travel days and a time, or leave both empty if you only want to offer rides.",
      );
      return;
    }
    const payError = contribution ? payIdInputError(payId, payIdType) : null;
    if (payError) {
      setError(payError);
      return;
    }
    if (
      contribution &&
      (!Number.isInteger(Number(fare)) ||
        Number(fare) < 5 ||
        Number(fare) > 10000)
    ) {
      setError("Use a whole-dollar fare from $5 to $10,000.");
      return;
    }
    setBusy(true);
    try {
      const [h, m] = minute.split(":").map(Number);
      await persist({
        origin,
        destination,
        days,
        minute: minute ? h * 60 + m : null,
        alerts,
        priceAud: contribution ? Number(fare) : 0,
        payId: contribution ? payId : "",
        payIdType,
      });
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }
  async function offer() {
    if (!saved) return;
    if (
      (contribution ? Number(fare) : 0) !== saved.priceAud ||
      (contribution &&
        (payId.trim() !== saved.payId || payIdType !== saved.payIdType))
    ) {
      setError("Save your payment preferences before offering a ride.");
      return;
    }
    if (saved.priceAud > 0 && !saved.payId) {
      setError("Add your preferred PayID below before offering a ride.");
      return;
    }
    setBusy(true);
    const current = generation.value;
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("GPS"));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 12000,
          });
        },
      ).catch(() => {
        throw new Error("GPS");
      });
      if (current !== generation.value) return;
      const result = await cocowheelsApi<{ ride: Ride }>(
        "/api/usual-route/offer",
        {
          method: "POST",
          body: JSON.stringify({
            origin: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            capturedAt: new Date(position.timestamp).toISOString(),
            accuracyMeters: position.coords.accuracy,
            departureMinutes: leaving,
          }),
        },
        true,
      );
      if (current !== generation.value) return;
      window.dispatchEvent(new Event("cocowheels:ride-updated"));
      router.push(`/activity/${encodeURIComponent(result.ride.rideId)}`);
    } catch (reason) {
      if (reason instanceof Error && reason.message === "GPS")
        setError(
          "Location wasn’t available. Allow location access and try again. No ride was offered.",
        );
      else fail(reason);
    } finally {
      setBusy(false);
    }
  }
  async function review() {
    if (!saved || !match) return;
    setBusy(true);
    const current = generation.value;
    try {
      const { ride } = await cocowheelsApi<{ ride: Ride }>(
        `/api/rides/${encodeURIComponent(match)}/preview`,
      );
      const departure = new Date(
        Math.max(Date.now(), Date.parse(ride.scheduledDepartureAt)),
      ).toISOString();
      const { candidates } = await cocowheelsApi<{ candidates: Candidate[] }>(
        "/api/search",
        {
          method: "POST",
          body: JSON.stringify({
            pickup: saved.origin,
            destination: saved.destination,
            requestedDepartureAt: departure,
          }),
        },
        true,
      );
      const candidate = candidates.find((c) => c.rideId === match);
      if (current !== generation.value) return;
      if (!candidate) throw new ApiError("RIDE_UNAVAILABLE", 409);
      saveRiderSearchDraft(saved.origin, saved.destination, departure);
      saveRiderPreviewRoute(
        match,
        saved.origin,
        saved.destination,
        candidate.directionFit,
      );
      router.push(`/rides/${encodeURIComponent(match)}`);
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="activity-page">
      <div className="activity-panel usual-route-panel">
        <h1 className="page-title">My usual route</h1>
        <div className="usual-route-body">
          {loading ? (
            <p>Loading…</p>
          ) : loadFailed ? (
            <>
              <p>Your usual route couldn’t be loaded. Please try again.</p>
              <button
                className="secondary"
                onClick={() => setReload((value) => value + 1)}
              >
                Try again
              </button>
            </>
          ) : !verified ? (
            <>
              <p>Sign in to save your private route.</p>
              <button
                className="primary"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("cocowheels:verify-university"),
                  )
                }
              >
                Verify UniKey
              </button>
            </>
          ) : saved ? (
            <>
              <p className="usual-route-hint">
                Your routine is private. Only rides you offer are visible to
                others.
              </p>
              <dl className="ride-preview-fields">
                <div>
                  <dt>
                    <RideFieldLabel icon="from">Where from?</RideFieldLabel>
                  </dt>
                  <dd>{saved.origin.label}</dd>
                </div>
                <div>
                  <dt>
                    <RideFieldLabel icon="to">Where to?</RideFieldLabel>
                  </dt>
                  <dd>{saved.destination.label}</dd>
                </div>
              </dl>
              {match && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void review()}
                >
                  Review matching ride
                </button>
              )}
              <section className="usual-route-section">
                <h2>
                  <RideFieldLabel icon="rider">Find a ride</RideFieldLabel>
                </h2>
                {saved.minute !== null && saved.days.length ? (
                  <>
                    <p>
                      {saved.days.map((d) => WEEKDAYS[d - 1]).join(", ")}
                      <br />
                      {scheduleWindow(saved.minute)}
                    </p>
                    <button
                      className="secondary"
                      disabled={busy || (!saved.alerts && !available)}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await persist({ ...saved, alerts: !saved.alerts });
                        } catch (reason) {
                          fail(reason);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {saved.alerts
                        ? "Mute email alerts"
                        : "Enable email alerts"}
                    </button>
                  </>
                ) : (
                  <p>
                    Replace your saved route to add travel days and a time for
                    rider alerts.
                  </p>
                )}
                {!available && (
                  <p className="usual-route-hint">
                    Matching emails aren’t available yet. Your route can still
                    be saved.
                  </p>
                )}
              </section>
              <section className="usual-route-section">
                <h2>
                  <RideFieldLabel icon="driver">Offer a ride</RideFieldLabel>
                </h2>
                <p className="usual-route-hint">
                  Use your current location and saved destination. Offering
                  30–60 minutes ahead gives riders more time to join.
                </p>
                <p>
                  {fareLabel(saved.priceAud)}
                  {saved.priceAud > 0 ? " · PayID" : " ride"}
                </p>
                <ContributionChoice
                  checked={contribution}
                  onChange={setContribution}
                  fare={fare}
                  controls={
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={async () => {
                        const issue = contribution
                          ? payIdInputError(payId, payIdType)
                          : null;
                        if (contribution && (!payId.trim() || issue)) {
                          setError(issue ?? "Enter your PayID.");
                          return;
                        }
                        if (
                          contribution &&
                          (!Number.isInteger(Number(fare)) ||
                            Number(fare) < 5 ||
                            Number(fare) > 10000)
                        ) {
                          setError(
                            "Use a whole-dollar fare from $5 to $10,000.",
                          );
                          return;
                        }
                        setBusy(true);
                        try {
                          await persist({
                            ...saved,
                            priceAud: contribution ? Number(fare) : 0,
                            payId: contribution ? payId : "",
                            payIdType,
                          });
                        } catch (reason) {
                          fail(reason);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Save payment preferences
                    </button>
                  }
                >
                  <PaymentFields
                    fare={fare}
                    setFare={setFare}
                    payId={payId}
                    setPayId={setPayId}
                    type={payIdType}
                    setType={setPayIdType}
                  />
                </ContributionChoice>
                <DepartureChoice value={leaving} onChange={setLeaving} />
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void offer()}
                >
                  {busy ? "Please wait…" : "OFFER A RIDE"}
                </button>
              </section>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setConfirmRemove(true)}
              >
                Replace saved route
              </button>
              {confirmRemove && (
                <RemoveRoutePrompt
                  busy={busy}
                  close={() => setConfirmRemove(false)}
                  confirm={async () => {
                    const current = generation.value;
                    setBusy(true);
                    try {
                      await cocowheelsApi(
                        "/api/usual-route/remove",
                        { method: "POST", body: "{}" },
                        true,
                      );
                      if (current === generation.value) {
                        setSaved(null);
                        setContribution(false);
                        setFare("5");
                        setPayId("");
                        setPayIdType("MOBILE");
                        setConfirmRemove(false);
                      }
                    } catch (reason) {
                      fail(reason);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              )}
            </>
          ) : (
            <>
              <p className="usual-route-hint">
                Save one route. Use it to offer a ride or receive matching-ride
                emails.
              </p>
              <h2>
                <RideFieldLabel icon="from">Where from?</RideFieldLabel>
              </h2>
              <PlaceSearch
                placeholder="Search origin"
                countryCode="au"
                choose={setOrigin}
              />
              {origin && (
                <p className="usual-route-hint">Selected: {origin.label}</p>
              )}
              <h2>
                <RideFieldLabel icon="to">Where to?</RideFieldLabel>
              </h2>
              <PlaceSearch
                placeholder="Search destination"
                countryCode="au"
                bias={origin}
                choose={setDestination}
              />
              {destination && (
                <p className="usual-route-hint">
                  Selected: {destination.label}
                </p>
              )}
              <fieldset className="usual-days">
                <legend>Rider travel days</legend>
                <div>
                  {WEEKDAYS.map((day, i) => (
                    <button
                      type="button"
                      className="secondary"
                      key={day}
                      aria-pressed={days.includes(i + 1)}
                      onClick={() =>
                        setDays((old) =>
                          old.includes(i + 1)
                            ? old.filter((d) => d !== i + 1)
                            : [...old, i + 1],
                        )
                      }
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="usual-route-hint">
                Days and time are required for rider alerts, not for offering
                rides.
              </p>
              <label className="field">
                Around{" "}
                <input
                  type="time"
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                />
              </label>
              {minute && (
                <p className="usual-route-hint">
                  {scheduleWindow(
                    Number(minute.slice(0, 2)) * 60 + Number(minute.slice(3)),
                  )}
                </p>
              )}
              <label className="usual-alert-choice">
                <input
                  type="checkbox"
                  checked={alerts}
                  disabled={!available}
                  onChange={(e) => setAlerts(e.target.checked)}
                />
                Email me matching rides
              </label>
              <p className="usual-route-hint">
                {available
                  ? "Alerts require days and a time. One email per matching offer; delivery may be delayed. Mute anytime."
                  : "Matching emails aren’t available yet. You can save your route and enable alerts later."}
              </p>
              <ContributionChoice
                checked={contribution}
                onChange={setContribution}
                fare={fare}
              >
                <PaymentFields
                  fare={fare}
                  setFare={setFare}
                  payId={payId}
                  setPayId={setPayId}
                  type={payIdType}
                  setType={setPayIdType}
                />
              </ContributionChoice>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy ? "Saving…" : "Save route"}
              </button>
            </>
          )}
        </div>
        {error && <Message text={error} close={() => setError(null)} />}
      </div>
    </section>
  );
}
function RemoveRoutePrompt({
  busy,
  close,
  confirm,
}: {
  busy: boolean;
  close: () => void;
  confirm: () => Promise<void>;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, close, busy);
  return (
    <div className="cancel-prompt-backdrop">
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Replace saved route"
        className="cancel-prompt"
      >
        <p>
          Remove this saved route and its alerts? Existing rides and history
          won’t change.
        </p>
        <div className="cancel-prompt-actions">
          <button className="secondary" disabled={busy} onClick={close}>
            KEEP IT
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => void confirm()}
          >
            REMOVE SAVED ROUTE
          </button>
        </div>
      </section>
    </div>
  );
}
function PaymentFields({
  fare,
  setFare,
  payId,
  setPayId,
  type,
  setType,
}: {
  fare: string;
  setFare: (s: string) => void;
  payId: string;
  setPayId: (s: string) => void;
  type: UsualRoute["payIdType"];
  setType: (s: UsualRoute["payIdType"]) => void;
}) {
  return (
    <div className="usual-payment">
      <label className="field">
        Fare (A$)
        <input
          type="number"
          min="5"
          max="10000"
          step="1"
          value={fare}
          onChange={(e) => setFare(e.target.value)}
        />
      </label>
      <fieldset className="payid-field">
        <legend>Your PayID</legend>
        <div
          className="payid-type-options"
          role="radiogroup"
          aria-label="PayID type"
        >
          {(["MOBILE", "EMAIL", "OTHER"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              className={type === t ? "active" : undefined}
              onClick={() => setType(t)}
            >
              {t === "MOBILE" ? "Mobile" : t === "EMAIL" ? "Email" : "Other"}
            </button>
          ))}
        </div>
        <input
          aria-label="Your PayID"
          value={payId}
          maxLength={PAYID_MAX_LENGTH[type]}
          type={type === "EMAIL" ? "email" : type === "MOBILE" ? "tel" : "text"}
          onChange={(e) => setPayId(e.target.value)}
        />
      </fieldset>
    </div>
  );
}
