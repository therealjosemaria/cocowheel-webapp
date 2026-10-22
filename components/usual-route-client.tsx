"use client";
import ContributionChoice from "./contribution-choice";
import PaymentFields from "./payment-fields";
import { fareLabel, validFare, CONTRIBUTION_ERROR } from "@/lib/fare";
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
import { payIdInputError } from "@/lib/input-validation";
import { RouteFields } from "./route-fields";
import { readProfileDraft, writeProfileDraft, clearProfileDraft } from "@/lib/profile-draft";
import { Message } from "./ride-journey-controls";
import RideFieldLabel from "./ride-field-label";
import RouteSchedule from "./route-schedule";

export default function UsualRouteClient({ match }: { match: string | null }) {
  const router = useRouter();
  const [saved, setSaved] = useState<UsualRoute | null>(null);
  const [origin, setOrigin] = useState<Pin>();
  const [destination, setDestination] = useState<Pin>();
  const [draftText, setDraftText] = useState({ origin: "", destination: "" });
  const [draftOwner, setDraftOwner] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [minute, setMinute] = useState("");
  const [alerts, setAlerts] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [fare, setFare] = useState("5");
  const [contribution, setContribution] = useState(false);
  const [payId, setPayId] = useState("");
  const [payIdType, setPayIdType] = useState<UsualRoute["payIdType"]>("MOBILE");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRoute, setEditingRoute] = useState(false);
  const [confirmMute, setConfirmMute] = useState(false);
  const [generation] = useState(() => ({ value: 0 }));
  useEffect(() => {
    let live = true;
    const load = () => {
      const current = ++generation.value;
      setLoading(true);
      setDraftOwner(null);
      setDraftText({ origin: "", destination: "" });
      setLoadFailed(false);
      setEditingRoute(false);
      setConfirmMute(false);
      setVerified(false);
      setSaved(null);
      setOrigin(undefined);
      setDestination(undefined);
      setPayId("");
      setDays([]);
      setMinute("");
      setAlerts(false);
      setEditingSchedule(false);
      setFare("5");
      setContribution(false);
      setPayIdType("MOBILE");
      void Promise.all([cocowheelsApi<{
        route: UsualRoute | null;
        alertsAvailable: boolean;
      }>("/api/usual-route"), cocowheelsApi<{ unikey: string }>("/api/university/session")])
        .then(([result, session]) => {
          if (live && current === generation.value) {
            setDraftOwner(session.unikey);
            setSaved(result.route);
            const draft = result.route ? null : readProfileDraft(session.unikey);
            if (result.route) clearProfileDraft(session.unikey);
            if (draft) {
              setOrigin(draft.origin);
              setDestination(draft.destination);
              setDraftText(draft.text);
              setDays(draft.days);
              setMinute(draft.minute);
            }
            if (result.route) {
              setContribution(result.route.priceAud > 0);
              setFare(String(result.route.priceAud || 5));
              setPayId(result.route.payId);
              setPayIdType(result.route.payIdType);
            }
            setAlerts(result.route?.alerts ?? (result.alertsAvailable && (draft?.alerts ?? false)));
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
  useEffect(() => {
    if (!loading && verified && draftOwner && !saved) {
      writeProfileDraft(draftOwner, { origin, destination, text: draftText, days, minute, alerts });
    }
  }, [loading, verified, draftOwner, saved, origin, destination, draftText, days, minute, alerts]);
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
    if (current === generation.value) {
      setSaved(result.route);
      if (draftOwner) clearProfileDraft(draftOwner);
    }
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
    if (contribution && (Number(fare) <= 0 || !validFare(Number(fare)))) {
      setError(CONTRIBUTION_ERROR);
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
        <h1 className="page-title">Profile</h1>
        <div className="usual-route-body">
          <h2>My usual route</h2>
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
              {editingRoute ? (
                <div className="usual-route-section">
                  <RouteFields origin={origin} destination={destination}
                    setOrigin={setOrigin} setDestination={setDestination} />
                  <button className="primary" disabled={busy || !origin || !destination}
                    onClick={async () => {
                      if (!origin || !destination) return;
                      const current = generation.value;
                      setBusy(true);
                      try {
                        await persist({ ...saved, origin, destination });
                        if (current === generation.value) setEditingRoute(false);
                      } catch (reason) { fail(reason); }
                      finally { setBusy(false); }
                    }}>{busy ? "Saving…" : "Save route"}</button>
                  <button className="secondary" disabled={busy}
                    onClick={() => setEditingRoute(false)}>Cancel</button>
                </div>
              ) : (
                <button className="secondary" disabled={busy} onClick={() => {
                  setOrigin(saved.origin);
                  setDestination(saved.destination);
                  setEditingSchedule(false);
                  setEditingRoute(true);
                }}>Edit route</button>
              )}
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
                  <RideFieldLabel icon="rider">Matching ride alerts</RideFieldLabel>
                </h2>
                {saved.anyTime || (saved.minute !== null && saved.days.length) ? (
                  <>
                    <p>
                      {saved.anyTime ? "Any day, any time" : <>{saved.days.map((d) => WEEKDAYS[d - 1]).join(", ")}<br />{scheduleWindow(saved.minute!)}</>}
                    </p>
                    <button
                      className="secondary"
                      disabled={busy || (!saved.alerts && !available)}
                      onClick={async () => {
                        if (saved.alerts) {
                          setConfirmMute(true);
                          return;
                        }
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
                    Add a schedule for matching ride emails.
                  </p>
                )}
                {editingSchedule ? <RouteSchedule route={saved} busy={busy} close={() => setEditingSchedule(false)} save={async (route) => {
                  setBusy(true);
                  try { await persist(route); setEditingSchedule(false); }
                  catch (reason) { fail(reason); }
                  finally { setBusy(false); }
                }} /> : <button className="secondary" disabled={busy} onClick={() => { setEditingRoute(false); setEditingSchedule(true); }}>Edit schedule</button>}
                {!available && (
                  <p className="usual-route-hint">
                    Matching emails aren’t available yet. Your route can still
                    be saved.
                  </p>
                )}
              </section>
              <section className="usual-route-section">
                <h2>
                  <RideFieldLabel icon="driver">Payment preferences</RideFieldLabel>
                </h2>
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
                          (Number(fare) <= 0 || !validFare(Number(fare)))
                        ) {
                          setError(CONTRIBUTION_ERROR);
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
              </section>
            </>
          ) : (
            <>
              <RouteFields origin={origin} destination={destination}
                setOrigin={setOrigin} setDestination={setDestination}
                draftText={draftText} onDraftText={(field, text) => setDraftText((old) => ({ ...old, [field]: text }))} />
              <fieldset className="usual-days" aria-label="Travel days">
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
              <div className="field usual-route-time">
                <input
                  type="time"
                  aria-label="Usual departure time"
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                />
              </div>
              <label className="usual-alert-choice">
                <input
                  type="checkbox"
                  checked={alerts}
                  disabled={!available}
                  onChange={(e) =>
                    e.target.checked ? setAlerts(true) : setConfirmMute(true)
                  }
                />
                Email me matching rides
              </label>
              {!available && (
                <p className="usual-route-hint">
                  Matching emails aren’t available yet.
                </p>
              )}
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
        {confirmMute && (
          <MuteAlertsPrompt
            busy={busy}
            close={() => setConfirmMute(false)}
            confirm={async () => {
              setBusy(true);
              try {
                if (saved) await persist({ ...saved, alerts: false });
                else setAlerts(false);
                setConfirmMute(false);
              } catch (reason) {
                fail(reason);
                setConfirmMute(false);
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
        {error && <Message text={error} close={() => setError(null)} />}
      </div>
    </section>
  );
}
function MuteAlertsPrompt({
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
        aria-label="Turn off matching emails"
        className="cancel-prompt"
      >
        <p>You won’t receive matching ride emails while this is off.</p>
        <div className="cancel-prompt-actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() => void confirm()}
          >
            TURN OFF EMAILS
          </button>
          <button className="secondary" disabled={busy} onClick={close}>
            GO BACK
          </button>
        </div>
      </section>
    </div>
  );
}
