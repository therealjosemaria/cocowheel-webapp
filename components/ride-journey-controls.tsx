"use client";

import { useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Ride } from "@/lib/client-types";

function updated() {
  window.dispatchEvent(new Event("cocowheels:ride-updated"));
  window.dispatchEvent(new Event("focus"));
}

function Message({ text, close }: { text: string; close: () => void }) {
  return (
    <div className="cancel-prompt-backdrop">
      <section
        className="cancel-prompt"
        role="dialog"
        aria-modal="true"
        aria-label="Ride update"
      >
        <p>{text}</p>
        <button className="primary" onClick={close}>
          OKAY
        </button>
      </section>
    </div>
  );
}

export function PickupConfirmation({
  ride,
  driver,
}: {
  ride: Ride;
  driver: boolean;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (
    !["ACCEPTED", "RIDE_ACTIVE"].includes(ride.status) ||
    (!driver && ride.request?.status !== "ACCEPTED")
  )
    return null;
  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      await cocowheelsApi(
        `/api/rides/${encodeURIComponent(ride.rideId)}/${driver ? "co-ride/confirm" : "pickup-code"}`,
        {
          method: "POST",
          body: JSON.stringify(driver ? { code } : {}),
        },
      );
      setCode("");
      updated();
    } catch (reason) {
      const messages: Record<string, string> = {
        CO_RIDE_CODE_INVALID: "That code doesn’t match. Try again.",
        CO_RIDE_CODE_EXPIRED: "Ask the rider for a new pickup code.",
        CO_RIDE_CODE_LOCKED: "Too many attempts. Ask the rider for a new code.",
        CO_RIDE_CODE_RATE_LIMITED: "Please wait a moment before trying again.",
      };
      setError(
        reason instanceof ApiError
          ? (messages[reason.code] ??
              "We couldn’t confirm pickup. Please try again.")
          : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pickup-confirmation">
      {driver ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="pickup-code">Rider’s pickup code</label>
          <div className="pickup-code-entry">
            <input
              id="pickup-code"
              aria-label="Four-digit pickup code"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
            />
            <button className="primary" disabled={busy || code.length !== 4}>
              {busy ? "CONFIRMING…" : "CONFIRM PICKUP"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p>Share this code with your driver at pickup.</p>
          {ride.coRideCode ? (
            <strong
              className="pickup-code-display"
              aria-label={`Pickup code ${ride.coRideCode.split("").join(" ")}`}
            >
              {ride.coRideCode.split("").map((digit, index) => (
                <span key={index} aria-hidden="true">
                  {digit}
                </span>
              ))}
            </strong>
          ) : null}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy
              ? "UPDATING…"
              : ride.coRideCode
                ? "NEW CODE"
                : "GET PICKUP CODE"}
          </button>
        </>
      )}
      {error ? <Message text={error} close={() => setError(null)} /> : null}
    </section>
  );
}

export function CompleteRide({ ride }: { ride: Ride }) {
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function complete(confirmAnyway = false) {
    if (busy) return;
    setBusy(true);
    try {
      await cocowheelsApi(
        `/api/rides/${encodeURIComponent(ride.rideId)}/complete`,
        { method: "POST", body: JSON.stringify({ confirmAnyway }) },
      );
      setWarning(null);
      updated();
    } catch (reason) {
      const messages: Record<string, string> = {
        COMPLETION_NOT_AT_DROPOFF:
          "You don’t appear to be at the drop-off yet. Complete the ride anyway?",
        COMPLETION_LOCATION_UNAVAILABLE:
          "We can’t confirm your current location. Complete the ride anyway?",
        COMPLETION_PICKUP_UNCONFIRMED:
          "Pickup hasn’t been confirmed. Complete the ride anyway?",
      };
      const message =
        reason instanceof ApiError ? messages[reason.code] : undefined;
      if (message) setWarning(message);
      else setError("We couldn’t complete the ride. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="primary"
        disabled={busy}
        onClick={() => void complete()}
      >
        {busy ? "COMPLETING…" : "COMPLETE RIDE"}
      </button>
      {warning ? (
        <div className="cancel-prompt-backdrop">
          <section
            className="cancel-prompt"
            role="dialog"
            aria-modal="true"
            aria-label="Complete ride"
          >
            <p>{warning}</p>
            <div className="cancel-prompt-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setWarning(null)}
              >
                GO BACK
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void complete(true)}
              >
                {busy ? "COMPLETING…" : "COMPLETE RIDE"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {error ? <Message text={error} close={() => setError(null)} /> : null}
    </>
  );
}
