"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ApiError, apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import type { Pin, Ride } from "@/lib/client-types";
import {
  demandExpiry,
  demandSchedule,
  demandStatusLabel,
  type DemandActivity,
  type DemandRoute,
  type DemandSearch,
  type RiderDemand,
} from "@/lib/rider-demand";
import {
  initialDeparture,
  sydneyInstant,
  sydneyDateTime,
  dateCaption,
  timeCaption,
} from "@/lib/ride-schedule";
import { fareLabel, validFare, CONTRIBUTION_ERROR } from "@/lib/fare";
import { payIdInputError } from "@/lib/input-validation";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { RouteFields } from "./route-fields";
import ScheduleFields from "./schedule-fields";
import RequestRouteMap from "./request-route-map";
import RideFieldLabel, { RideFieldIcon } from "./ride-field-label";
import ParticipantName from "./participant-name";
import PaymentFields from "./payment-fields";
import ContributionChoice from "./contribution-choice";
import { VehiclePlatePrompt } from "./vehicle-details";
import { Message } from "./ride-journey-controls";
import RideStatusText from "./ride-status-text";
import { JourneyUpdateMarker, useJourneyUpdate } from "./journey-update-context";
import { demandJourneyKey, offerTarget } from "@/lib/journey-updates";

const SELF_OFFER_MESSAGE = "You can’t offer a ride to yourself.";
const location = (pin: Pin) =>
  pin.label || `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`;
const departure = (at: string) => {
  const v = sydneyDateTime(at);
  return `${dateCaption(v.date)} · ${timeCaption(v.time)}`;
};
const post = <T,>(path: string, body: unknown, verified = true) =>
  cocowheelsApi<T>(
    path,
    { method: "POST", body: JSON.stringify(body) },
    verified,
  );

export function DemandRouteSummary({
  route,
  showSchedule = true,
}: {
  route: DemandRoute;
  showSchedule?: boolean;
}) {
  return (
    <dl className="activity-card-fields demand-fields">
      <div>
        <dt>
          <RideFieldLabel icon="from">Where from</RideFieldLabel>
        </dt>
        <dd>{location(route.origin)}</dd>
      </div>
      <div>
        <dt>
          <RideFieldLabel icon="to">Where to</RideFieldLabel>
        </dt>
        <dd>{location(route.destination)}</dd>
      </div>
      {showSchedule && (
        <div>
          <dt>
            <RideFieldLabel icon="departure">Departure</RideFieldLabel>
          </dt>
          <dd>{demandSchedule(route)}</dd>
        </div>
      )}
    </dl>
  );
}

function DemandPrompt({
  label,
  children,
  busy,
  close,
  confirm,
  action,
  destructive = false,
  cancelLabel = "Go back",
}: {
  label: string;
  children: ReactNode;
  busy: boolean;
  close: () => void;
  confirm: () => void;
  action: string;
  destructive?: boolean;
  cancelLabel?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, close, busy);
  return createPortal(
    <div className="cancel-prompt-backdrop">
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="cancel-prompt demand-prompt"
      >
        <p>{label}</p>
        {children}
        <div className="cancel-prompt-actions">
          {destructive && <button className="secondary" disabled={busy} onClick={close}>Go back</button>}
          <button className={destructive ? "danger" : "primary"} disabled={busy} onClick={confirm}>
            {busy ? "Saving…" : action}
          </button>
          {!destructive && <button className="secondary" disabled={busy} onClick={close}>{cancelLabel}</button>}
        </div>
      </section>
    </div>,
    document.body,
  );
}

export async function openLiftRequestId() {
  const data = await cocowheelsApi<DemandActivity>("/api/rider-demands");
  const request = data.requests.find((item) => item.status === "OPEN");
  if (!request) throw new Error("Your post changed. Please try again.");
  return request.id;
}

export function LiftRequestSwitchPrompt(props: { busy: boolean; close: () => void; confirm: () => void }) {
  return <DemandPrompt label="Withdraw your post and offer a ride?" action="Withdraw & offer" destructive {...props}>{null}</DemandPrompt>;
}

export function PostRideRequest({ route }: { route: DemandRoute }) {
  const [review, setReview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [replacement, setReplacement] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const reset = () => {
      setSaved(false);
      setReview(false);
      setReplacement(null);
    };
    window.addEventListener("cocowheels:identity-changed", reset);
    return () =>
      window.removeEventListener("cocowheels:identity-changed", reset);
  }, []);
  async function save(replaceDemandId?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await post("/api/rider-demands", { ...route, ...(replaceDemandId ? { replaceDemandId } : {}) }, false);
      window.dispatchEvent(new Event("cocowheels:identity-changed"));
      setReview(false);
      setSaved(true);
    } catch (reason) {
      setReview(false);
      setReplacement(null);
      if (reason instanceof ApiError && reason.code === "DEMAND_ALREADY_OPEN") {
        try {
          setReplacement(await openLiftRequestId());
        } catch (lookupError) {
          setError(apiErrorMessage(lookupError));
        }
      } else setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {saved ? (
        <Link className="text-button" href="/activity#ride-requests">
          View your post
        </Link>
      ) : (
        <button className="text-button" onClick={() => setReview(true)}>
          Request this journey
        </button>
      )}
      {review && (
        <DemandPrompt
          label="Request this journey"
          action="Request"
          busy={busy}
          close={() => setReview(false)}
          confirm={() => void save()}
        >
          <DemandRouteSummary route={route} />
          <p className="save-route-profile-note">
            Drivers can see these addresses and offer you a ride.
            <br />
            Visible until {departure(demandExpiry(route))}. Manage offers in
            Activity.
          </p>
        </DemandPrompt>
      )}
      {error &&
        createPortal(
          <Message text={error} close={() => setError(null)} />,
          document.body,
        )}
      {replacement && <DemandPrompt label="Replace your ride request?" action="Replace" cancelLabel="Cancel" busy={busy} close={() => setReplacement(null)} confirm={() => void save(replacement)}>
        <DemandRouteSummary route={route} />
      </DemandPrompt>}
    </>
  );
}

export function FindRiders({
  origin: seedOrigin,
  destination: seedDestination,
  back,
}: {
  origin?: Pin;
  destination?: Pin;
  back: () => void;
}) {
  const [origin, setOrigin] = useState(seedOrigin);
  const [destination, setDestination] = useState(seedDestination);
  const [date, setDate] = useState("any");
  const [time, setTime] = useState("");
  const [results, setResults] = useState<RiderDemand[] | null>(null);
  const [searched, setSearched] = useState<DemandSearch | null>(null);
  const [selected, setSelected] = useState<RiderDemand | null>(null);
  const [offer, setOffer] = useState<RiderDemand | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function search() {
    setBusy(true);
    try {
      const route = { origin, destination, date, time };
      const data = await post<{ requests: RiderDemand[] }>(
        "/api/rider-demands/search",
        route,
        false,
      );
      setSearched(route);
      setResults(data.requests);
      setSelected(null);
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-page demand-page">
      <div className="demand-heading demand-navigation-heading">
        <button
          type="button"
          className="text-button"
          onClick={
            results
              ? () => {
                  setResults(null);
                  setOffer(null);
                }
              : back
          }
        >
          {results ? "Edit search" : "Back"}
        </button>
        <h1 className="page-title">Journey requests</h1>
      </div>
      {results && searched ? (
        <div className="form-panel-content">
          {(searched.origin || searched.destination || selected) &&
            <RequestRouteMap driver={searched} rider={selected ?? undefined} />}
          {!results.length && (
            <p className="ride-options-empty">
              No matching ride requests.
            </p>
          )}
          {results.map((request) => (
            <article className="activity-card" key={request.id}>
              <ParticipantName name={request.alias} />
              <DemandRouteSummary route={request} />
              <div className="demand-actions driver-request-buttons">
                <button
                  className="secondary"
                  aria-pressed={selected?.id === request.id}
                  onClick={() =>
                    setSelected(selected?.id === request.id ? null : request)
                  }
                >
                  {selected?.id === request.id ? "Hide route" : "Show route"}
                </button>
                <button className="primary" onClick={() => request.isOwn ? setError(SELF_OFFER_MESSAGE) : setOffer(request)}>
                  Offer a ride
                </button>
              </div>
            </article>
          ))}
          {offer && (
            <DemandOfferForm
              request={offer}
              route={{ ...searched, origin: searched.origin ?? offer.origin, destination: searched.destination ?? offer.destination }}
              close={() => setOffer(null)}
            />
          )}
        </div>
      ) : (
        <div className="form-panel-content">
          <RouteFields
            sheet
            allowClear
            origin={origin}
            destination={destination}
            setOrigin={setOrigin}
            setDestination={setDestination}
          />
          <ScheduleFields
            date={date}
            time={time}
            setDate={setDate}
            setTime={setTime}
            optional
          />
          <button
            className="primary"
            disabled={busy}
            onClick={() => void search()}
          >
            {busy ? "Searching…" : "SEARCH"}
          </button>
        </div>
      )}
      {error &&
        createPortal(
          <Message text={error} close={() => setError(null)} />,
          document.body,
        )}
    </div>
  );
}

function DemandOfferForm({
  request,
  route,
  close,
}: {
  request: RiderDemand;
  route: DemandRoute;
  close: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [schedule, setSchedule] = useState(() => {
    const initial = initialDeparture();
    return {
      date: request.date === "any" ? initial.date : request.date,
      time: request.time || initial.time,
    };
  });
  const [contribution, setContribution] = useState(false);
  const [fare, setFare] = useState("1");
  const [payId, setPayId] = useState("");
  const [type, setType] = useState<"MOBILE" | "EMAIL" | "OTHER">("MOBILE");
  const [busy, setBusy] = useState(false);
  const [platePrompt, setPlatePrompt] = useState(false);
  const [liftSwitch, setLiftSwitch] = useState<{ id: string; plate?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useDialogFocus(ref, close, busy, !platePrompt && !liftSwitch);
  async function send(plate?: string, withdrawLiftRequestId?: string) {
    const at = sydneyInstant(schedule.date, schedule.time);
    if (!at || Date.parse(at) <= Date.now()) {
      setPlatePrompt(false);
      setError("Choose a future departure time.");
      return;
    }
    if (contribution && (!validFare(Number(fare)) || Number(fare) <= 0)) {
      setError(CONTRIBUTION_ERROR);
      return;
    }
    const invalidPayId = contribution && payIdInputError(payId, type);
    if (invalidPayId) {
      setError(invalidPayId);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await post(`/api/rider-demands/${request.id}/offer`, {
        origin: route.origin,
        destination: route.destination,
        scheduledDepartureAt: at,
        priceAud: contribution ? Number(fare) : 0,
        withdrawLiftRequestId,
        ...(contribution ? { payId, payIdType: type } : {}),
        ...(plate ? { plate } : {}),
      });
      window.location.assign("/activity#ride-requests");
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "OWN_RIDE_JOIN_NOT_ALLOWED") {
        setPlatePrompt(false);
        setError(SELF_OFFER_MESSAGE);
      } else if (reason instanceof ApiError && reason.code === "LIFT_REQUEST_WITHDRAWAL_REQUIRED") {
        try { setLiftSwitch({ id: await openLiftRequestId(), plate }); }
        catch (error) { setPlatePrompt(false); setError(apiErrorMessage(error)); }
      } else if (
        reason instanceof ApiError &&
        reason.code === "VEHICLE_PLATE_REQUIRED"
      )
        setPlatePrompt(true);
      else if (plate) throw reason;
      else setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return createPortal(
    <>
      {!platePrompt && (
        <div className="cancel-prompt-backdrop">
          <section
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Offer a ride"
            className="cancel-prompt demand-prompt"
          >
            <p>Offer {request.alias} a ride?</p>
            <DemandRouteSummary route={route} showSchedule={false} />
            <p className="save-route-profile-note">
              Requested: {demandSchedule(request)}
            </p>
            <ScheduleFields
              date={schedule.date}
              time={schedule.time}
              setDate={(date) => setSchedule({ ...schedule, date })}
              setTime={(time) => setSchedule({ ...schedule, time })}
            />
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
                type={type}
                setType={setType}
              />
            </ContributionChoice>
            {error && <p role="alert">{error}</p>}
            <div className="cancel-prompt-actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() => void send()}
              >
                {busy ? "Offering…" : "Offer a ride"}
              </button>
              <button className="secondary" disabled={busy} onClick={close}>
                Go back
              </button>
            </div>
          </section>
        </div>
      )}
      {platePrompt && (
        <VehiclePlatePrompt
          submitLabel="Save & offer"
          externalError={error}
          externalBusy={busy}
          close={() => setPlatePrompt(false)}
          confirm={(plate) => send(plate)}
        />
      )}
      {liftSwitch && <LiftRequestSwitchPrompt busy={busy} close={() => setLiftSwitch(null)} confirm={() => { const pending = liftSwitch; setLiftSwitch(null); void send(pending.plate, pending.id).catch(reason => setError(apiErrorMessage(reason))); }} />}
    </>,
    document.body,
  );
}

function RequestedJourneyFields({ request, details = false }: { request: RiderDemand; details?: boolean }) {
  const status = demandStatusLabel(request.status);
  const update = useJourneyUpdate(demandJourneyKey(request.id));
  return <dl className="activity-card-fields">
    <div><dt><RideFieldLabel icon="status">Status</RideFieldLabel></dt>
      <dd className={`activity-status${request.status === "CANCELLED" ? " cancelled" : request.status === "EXPIRED" ? " expired" : ""}`}><RideStatusText label={status} /></dd></div>
    <div><dt><RideFieldLabel icon="from">Where from?</RideFieldLabel></dt><dd>{location(request.origin)}</dd></div>
    <div><dt><RideFieldLabel icon="departure">Departure</RideFieldLabel></dt><dd>{demandSchedule(request)}</dd></div>
    <div><dt><RideFieldLabel icon="to">Where to?</RideFieldLabel></dt><dd>{location(request.destination)}</dd></div>
    {!details && <div className="activity-card-action">
      <dt><RideFieldLabel icon="view">View</RideFieldLabel></dt>
      <dd><Link className="activity-open" href={update?.href ?? `/activity/requests/${encodeURIComponent(request.id)}`}
        aria-label={`Details for journey requested from ${location(request.origin)} to ${location(request.destination)}`}>DETAILS</Link>
        <JourneyUpdateMarker id={demandJourneyKey(request.id)} /></dd>
    </div>}
  </dl>;
}

const ignoreActivity = () => {};
export function RiderDemandDetails({ requestId }: { requestId: string }) {
  return <section className="activity-page"><div className="activity-panel">
    <div className="activity-panel-content demand-detail-content">
      <Link className="text-button" href="/activity">Back</Link>
      <RiderDemandActivity key={requestId} requestId={requestId} onHasActivity={ignoreActivity} />
    </div>
  </div></section>;
}

export function RiderDemandActivity({
  onHasActivity,
  requestId,
}: {
  onHasActivity: (value: boolean) => void;
  requestId?: string;
}) {
  const [data, setData] = useState<DemandActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [cancel, setCancel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const reset = () => {
      setData(null);
      onHasActivity(false);
      setError(null);
      setCancel(null);
      setLoading(true);
      setRevision((v) => v + 1);
    };
    window.addEventListener("cocowheels:identity-changed", reset);
    return () =>
      window.removeEventListener("cocowheels:identity-changed", reset);
  }, [onHasActivity]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const result = await cocowheelsApi<DemandActivity>(
          "/api/rider-demands",
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setData(result);
          onHasActivity(Boolean(result.requests.length || result.sent.length));
          setError(null);
        }
      } catch (reason) {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
          setData(null);
          onHasActivity(false);
          setError(requestId ? apiErrorMessage(reason) : null);
        } else setError(apiErrorMessage(reason));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(() => void load(), 15000);
        }
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [revision, onHasActivity, requestId]);
  async function act(path: string, body: unknown) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await post<{ ride?: Ride }>(path, body);
      setCancel(null);
      setRevision((v) => v + 1);
      if (result.ride) window.location.assign(`/rides/${result.ride.rideId}`);
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  if (requestId && loading) return <div aria-busy="true" />;
  if (!requestId && !data?.requests.length && !data?.sent.length && !error) return null;
  const requests = requestId ? data?.requests.filter(request => request.id === requestId) : data?.requests;
  return (
    <section id="ride-requests" className="demand-activity">
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => setRevision((v) => v + 1)}
          >
            Try again
          </button>
        </p>
      )}
      {requestId && !error && !requests?.length && <p role="status">This journey request is not available.</p>}
      {requests?.map((request) => (
        <article
          className="activity-card"
          key={request.id}
        >
          <span className="activity-role"><RideFieldIcon icon="rider" />Journey requested</span>
          {requestId && <RequestRouteMap rider={request} riderLabel="Your route" />}
          <RequestedJourneyFields request={request} details={Boolean(requestId)} />
          {requestId && request.status === "OPEN" && (
            <p className="save-route-profile-note">
              Visible until {departure(request.expiresAt)}
            </p>
          )}
          {requestId && request.status === "OPEN" && <div className="demand-actions driver-request-buttons demand-single-action">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setCancel(request.id)}
              >
                Withdraw post
              </button>
          </div>}
          {requestId && request.offers.map((offer) => (
            <div className="demand-offer" id={offerTarget(offer.id)} key={offer.id}>
              <ParticipantName name={offer.driverAlias} />
              <p>
                {departure(offer.departureAt)} · {fareLabel(offer.priceAud)}
              </p>
              {offer.status === "PENDING" && request.status === "OPEN" ? (
                <div className="demand-actions driver-request-buttons">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        `/api/rider-demands/offers/${offer.id}/respond`,
                        { decision: "ACCEPT" },
                      )
                    }
                  >
                    Accept ride
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        `/api/rider-demands/offers/${offer.id}/respond`,
                        { decision: "DECLINE" },
                      )
                    }
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <p>{offer.status === "PENDING" ? "Unavailable" : offer.status.toLowerCase()}</p>
              )}
              {offer.status === "ACCEPTED" && (
                <Link className="text-button" href={`/rides/${offer.rideId}`}>
                  View ride
                </Link>
              )}
            </div>
          ))}
          {requestId && request.status === "OPEN" && !request.offers.length && (
            <p className="save-route-profile-note">
              No offers yet. Check back here for replies.
            </p>
          )}
        </article>
      ))}
      {!requestId && data?.sent.map((offer) => (
        <article className="activity-card" key={offer.id}>
          <span className="activity-role"><RideFieldIcon icon="driver" />Journey offered</span>
          <p>
            {departure(offer.departureAt)} ·{" "}
            {offer.status === "PENDING"
              ? "Awaiting reply"
              : offer.status.toLowerCase()}
          </p>
          <Link className="text-button" href={`/rides/${offer.rideId}`}>
            View ride
          </Link>
        </article>
      ))}
      {cancel && (
        <DemandPrompt
          label="Withdraw your post?"
          action="Withdraw post"
          destructive
          busy={busy}
          close={() => setCancel(null)}
          confirm={() => void act(`/api/rider-demands/${cancel}/cancel`, {})}
        >
          <p className="save-route-profile-note">
            Drivers will no longer see your ride request.
          </p>
        </DemandPrompt>
      )}
    </section>
  );
}
