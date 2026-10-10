"use client";
import { useEffect, useRef, useState } from "react";

type Pending = { resolve: () => void; reject: () => void };
export default function UniversityVerification() {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<Pending[]>([]);
  const [unikey, setUniKey] = useState("");
  const [challenge, setChallenge] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
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
  }, []);
  const close = () => {
    dialog.current?.close();
    pending.current.splice(0).forEach((item) => item.reject());
    setChallenge("");
    setCode("");
    setError("");
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/university/${challenge ? "verify" : "code"}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-Cocowheels-Auth": "1",
          },
          body: JSON.stringify(
            challenge ? { challengeId: challenge, code } : { unikey },
          ),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        const messages: Record<string, string> = {
          INVALID_UNIKEY: "Enter your UniKey, for example abcd1234.",
          VERIFICATION_INVALID:
            "That code is invalid or expired. Try again or request a new code.",
          VERIFICATION_RATE_LIMITED:
            "Too many attempts. Please try again in 15 minutes.",
          EMAIL_NOT_CONFIGURED:
            "Email verification isn’t available yet. Please try again later.",
          EMAIL_SEND_FAILED:
            "We couldn’t send your code. Please try again shortly.",
        };
        throw new Error(
          messages[result.error] ?? "We couldn’t verify you. Please try again.",
        );
      }
      if (!challenge) {
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
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to connect.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="university-dialog"
      aria-label={challenge ? "Enter your code" : "UniKey verification"}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <form onSubmit={submit} className="university-form">
        {challenge && <h2>Enter your code</h2>}
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
        ) : (
          <>
            <label>
              <input
                key="unikey"
                aria-label="UniKey"
                placeholder="UniKey"
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
              We’ll email a code to your university inbox. Your UniKey will be
              visible to other participants.
            </p>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Please wait…" : challenge ? "Verify" : "Send code"}
        </button>
        {challenge && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              setChallenge("");
              setCode("");
              setError("");
            }}
          >
            Request a new code
          </button>
        )}
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={close}
        >
          Cancel
        </button>
      </form>
    </dialog>
  );
}
