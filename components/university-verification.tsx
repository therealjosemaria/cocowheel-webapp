"use client";
import {
  codeCooldownLabel,
  verificationWaitMessage,
} from "@/lib/verification-message";
import { useCodeCooldown } from "@/lib/use-code-cooldown";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiErrorMessage, requestJson } from "@/lib/api-transport";

type Pending = { resolve: () => void; reject: () => void };
export default function UniversityVerification({ inline = false, onVerified }: {
  inline?: boolean;
  onVerified?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<Pending[]>([]);
  const [unikey, setUniKey] = useState("");
  const [challenge, setChallenge] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cooldown = useCodeCooldown(unikey);
  const sending = useRef(false);
  useEffect(() => {
    if (inline) return;
    const requests = pending.current;
    const open = (event: Event) => {
      const callbacks = (event as CustomEvent<Pending | undefined>).detail;
      if (callbacks) pending.current.push(callbacks);
      setError("");
      dialog.current?.showModal();
    };
    window.addEventListener("cocowheels:verify-university", open);
    return () => {
      window.removeEventListener("cocowheels:verify-university", open);
      requests.splice(0).forEach((item) => item.reject());
    };
  }, [inline]);
  const close = () => {
    dialog.current?.close();
    pending.current.splice(0).forEach((item) => item.reject());
    setChallenge("");
    setCode("");
    setError("");
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || (!challenge && cooldown.remaining > 0)) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<{
        challengeId: string;
        deliveryAddress: string;
      }>(`/api/university/${challenge ? "verify" : "code"}`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Cocowheels-Auth": "1",
        },
        body: JSON.stringify(
          challenge ? { challengeId: challenge, code } : { unikey },
        ),
      });
      if (!challenge) {
        cooldown.start(60);
        setChallenge(result.challengeId);
        setDeliveryAddress(result.deliveryAddress);
        setCode("");
      } else {
        // Verified sessions use HttpOnly cookies, never browser-readable tokens.
        try {
          sessionStorage.removeItem("cocowheels:guest-session");
        } catch {
          /* Cookies still work. */
        }
        window.dispatchEvent(new Event("cocowheels:identity-changed"));
        dialog.current?.close();
        pending.current.splice(0).forEach((item) => item.resolve());
        setChallenge("");
        setCode("");
        onVerified?.();
      }
    } catch (reason) {
      if (
        !challenge &&
        reason instanceof ApiError &&
        reason.code === "VERIFICATION_RATE_LIMITED" &&
        reason.retryAfterSeconds
      ) {
        cooldown.start(reason.retryAfterSeconds);
        setError("");
        return;
      }
      const messages: Record<string, string> = {
        INVALID_UNIKEY: "Enter a valid email address.",
        VERIFICATION_INVALID:
          "That code is invalid or expired. Try again or request a new code.",
        VERIFICATION_RATE_LIMITED: verificationWaitMessage(
          reason instanceof ApiError ? reason.retryAfterSeconds : undefined,
        ),
        EMAIL_NOT_CONFIGURED:
          "Email verification isn’t available yet. Please try again later.",
        EMAIL_SEND_FAILED:
          "We couldn’t send your code. Please try again shortly.",
      };
      setError(
        apiErrorMessage(
          reason,
          reason instanceof ApiError
            ? (messages[reason.code] ??
                "We couldn’t verify you. Please try again.")
            : "We couldn’t verify you. Please try again.",
        ),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const form = (
      <form onSubmit={submit} className="university-form">
        {challenge && !inline && <h2>Enter your code</h2>}
        {inline && <label>
          Email
          <input aria-label="Email" placeholder="Email" inputMode="email"
            autoCapitalize="none" autoComplete="username" spellCheck={false}
            maxLength={254} value={unikey} readOnly={Boolean(challenge)}
            onChange={(event) => setUniKey(event.target.value.toLowerCase())} required />
        </label>}
        {challenge ? (
          <>
            <p>Sent to {deliveryAddress}</p>
            <label>
              Verification code
              <input
                key="code"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </label>
          </>
        ) : !inline ? (
          <>
            <label>
              <input
                key="unikey"
                aria-label="Email"
                placeholder="Email"
                inputMode="email"
                autoFocus
                autoCapitalize="none"
                autoComplete="username"
                spellCheck={false}
                maxLength={254}
                value={unikey}
                onChange={(e) => setUniKey(e.target.value.toLowerCase())}
                required
              />
            </label>
            <p>
              We’ll email you a sign-in code. Your email stays private.
            </p>
          </>
        ) : null}
        {error && <p role="alert">{error}</p>}
        <button
          className="primary"
          disabled={busy || (!challenge && cooldown.remaining > 0)}
        >
          {busy ? "Please wait…" : challenge ? "Verify" : "Send code"}
          {!busy && !challenge && cooldown.remaining > 0 && (
            <span className="code-cooldown">{` in ${codeCooldownLabel(cooldown.remaining)}`}</span>
          )}
        </button>
        {challenge && (
          <button
            type="button"
            className="secondary"
            disabled={busy || cooldown.remaining > 0}
            onClick={() => {
              setChallenge("");
              setCode("");
              setError("");
            }}
          >
            Request a new code
            {cooldown.remaining > 0 && (
              <span className="code-cooldown">{` in ${codeCooldownLabel(cooldown.remaining)}`}</span>
            )}
          </button>
        )}
        {!inline && <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={close}
        >
          Cancel
        </button>}
      </form>
  );
  if (inline) return form;
  return (
    <dialog
      ref={dialog}
      className="university-dialog"
      aria-label={challenge ? "Enter your code" : "Email verification"}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      {form}
    </dialog>
  );
}
