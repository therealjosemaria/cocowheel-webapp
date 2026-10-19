"use client";

import { useId, useRef, useState } from "react";
import { ApiError, apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import type { Ride } from "@/lib/client-types";
import { useDialogFocus } from "@/lib/use-dialog-focus";

function updated() {
  window.dispatchEvent(new Event("cocowheels:ride-updated"));
  window.dispatchEvent(new Event("focus"));
}

export function Message({ text, close }: { text: string; close: () => void }) {
  const dialog = useRef<HTMLElement | null>(null);
  useDialogFocus(dialog, close);
  return (
    <div className="cancel-prompt-backdrop">
      <section
        ref={dialog}
        tabIndex={-1}
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
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const codeId = useId();
  const code = digits.join("");
  function enterDigits(index: number, value: string) {
    const numbers = value.replace(/\D/g, "").slice(0, 4 - index);
    if (value && !numbers) return;
    setDigits((previous) => {
      const next = [...previous];
      if (!numbers) next[index] = "";
      else
        [...numbers].forEach((digit, offset) => {
          next[index + offset] = digit;
        });
      return next;
    });
    if (numbers) inputs.current[Math.min(index + numbers.length, 3)]?.focus();
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (
    !["ACCEPTED", "RIDE_ACTIVE"].includes(ride.status) ||
    (!driver && ride.request?.status !== "ACCEPTED")
  )
    return null;
  async function submit() {
    if (busy || (driver && !digits.every((digit) => /^[0-9]$/.test(digit))))
      return;
    setBusy(true);
    try {
      await cocowheelsApi(
        `/api/rides/${encodeURIComponent(ride.rideId)}/${driver ? "co-ride/confirm" : "pickup-code"}`,
        {
          method: "POST",
          body: JSON.stringify(driver ? { code } : {}),
        },
      );
      setDigits(["", "", "", ""]);
      updated();
    } catch (reason) {
      const messages: Record<string, string> = {
        CO_RIDE_CODE_INVALID: "That code doesn’t match. Try again.",
        CO_RIDE_CODE_EXPIRED: "Ask the rider for a new pickup code.",
        CO_RIDE_CODE_LOCKED: "Too many attempts. Ask the rider for a new code.",
        CO_RIDE_CODE_RATE_LIMITED: "Please wait a moment before trying again.",
      };
      setError(
        apiErrorMessage(
          reason,
          reason instanceof ApiError
            ? (messages[reason.code] ??
                "We couldn’t confirm pickup. Please try again.")
            : "Please try again.",
        ),
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
          <label className="pickup-code-instruction" htmlFor={`${codeId}-0`}>
            Enter the rider’s pickup code.
          </label>
          <div className="pickup-code-entry">
            <div
              className="pickup-code-input"
              role="group"
              aria-label="Four-digit pickup code"
            >
              {Array.from({ length: 4 }, (_, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputs.current[index] = element;
                  }}
                  id={`${codeId}-${index}`}
                  aria-label={`Pickup code digit ${index + 1}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]"
                  maxLength={4}
                  required
                  disabled={busy}
                  value={digits[index]}
                  onFocus={(event) => event.currentTarget.select()}
                  onClick={(event) => event.currentTarget.select()}
                  onChange={(event) => enterDigits(index, event.target.value)}
                  onPaste={(event) => {
                    event.preventDefault();
                    enterDigits(index, event.clipboardData.getData("text"));
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Backspace" &&
                      !digits[index] &&
                      index > 0
                    ) {
                      event.preventDefault();
                      enterDigits(index - 1, "");
                      inputs.current[index - 1]?.focus();
                    } else if (
                      event.key === "ArrowLeft" ||
                      event.key === "ArrowRight"
                    ) {
                      event.preventDefault();
                      inputs.current[
                        Math.max(
                          0,
                          Math.min(
                            3,
                            index + (event.key === "ArrowLeft" ? -1 : 1),
                          ),
                        )
                      ]?.focus();
                    }
                  }}
                />
              ))}
            </div>
            <button className="primary" disabled={busy || code.length !== 4}>
              {busy ? "CONFIRMING…" : "CONFIRM PICKUP"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="pickup-code-instruction">
            Share this code with your driver at pickup.
          </p>
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
      };
      const message =
        reason instanceof ApiError ? messages[reason.code] : undefined;
      if (message) setWarning(message);
      else
        setError(
          apiErrorMessage(
            reason,
            reason instanceof ApiError &&
              reason.code === "COMPLETION_PICKUP_UNCONFIRMED"
              ? "The driver must confirm pickup before completing the ride."
              : "We couldn’t complete the ride. Please try again.",
          ),
        );
    } finally {
      setBusy(false);
    }
  }
  if (ride.status !== "CO_RIDE_ACTIVE" || !ride.pickupEstablished) return null;
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
                className="primary"
                disabled={busy}
                onClick={() => void complete(true)}
              >
                {busy ? "COMPLETING…" : "COMPLETE RIDE"}
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setWarning(null)}
              >
                GO BACK
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {error ? <Message text={error} close={() => setError(null)} /> : null}
    </>
  );
}
