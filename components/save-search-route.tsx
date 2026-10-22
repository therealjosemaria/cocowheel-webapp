"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import { sameRoute, type UsualRoute } from "@/lib/usual-route";
import type { Pin } from "@/lib/client-types";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { Message } from "./ride-journey-controls";

export default function SaveSearchRoute({
  origin,
  destination,
}: {
  origin: Pin;
  destination: Pin;
}) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<"replace" | "notify" | null>(null);
  const [existing, setExisting] = useState<UsualRoute | null>(null);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef({ value: 0, mounted: true });
  useEffect(() => {
    const lifecycle = generation.current;
    lifecycle.mounted = true;
    const reset = () => {
      lifecycle.value++;
      setSaved(false);
      setPrompt(null);
      setError(null);
      setBusy(false);
    };
    window.addEventListener("cocowheels:identity-changed", reset);
    return () => {
      lifecycle.mounted = false;
      lifecycle.value++;
      window.removeEventListener("cocowheels:identity-changed", reset);
    };
  }, []);
  const fail = (reason: unknown) =>
    setError(
      reason instanceof ApiError && reason.code === "USUAL_ROUTE_CHANGED"
        ? "Your route settings changed. Please save again."
        : reason instanceof ApiError && reason.code === "ALERTS_UNAVAILABLE"
          ? "Matching emails aren’t available yet. Your route is saved."
          : apiErrorMessage(
              reason,
              "We couldn’t save that change. Please try again.",
            ),
    );
  async function persist(
    expected: UsualRoute | null,
    notify: boolean,
    canNotify: boolean,
  ) {
    const current = generation.current.value;
    setBusy(true);
    try {
      const result = await cocowheelsApi<{ route: UsualRoute }>(
        "/api/usual-route/from-search",
        {
          method: "POST",
          body: JSON.stringify({ origin, destination, expected, notify }),
        },
        true,
      );
      if (current !== generation.current.value) return;
      setExisting(result.route);
      setSaved(true);
      setPrompt(!result.route.alerts && canNotify && !notify ? "notify" : null);
    } catch (reason) {
      if (current !== generation.current.value) return;
      setPrompt(null);
      setSaved(false);
      fail(reason);
    } finally {
      if (current === generation.current.value) setBusy(false);
    }
  }
  async function begin() {
    let current = generation.current.value;
    setBusy(true);
    try {
      // Verify in place before reading private settings; never replay a write under a new identity.
      try {
        await cocowheelsApi("/api/university/session");
      } catch (reason) {
        if (!(reason instanceof ApiError && reason.status === 401))
          throw reason;
        await new Promise<void>((resolve, reject) =>
          window.dispatchEvent(
            new CustomEvent("cocowheels:verify-university", {
              detail: {
                resolve,
                reject: () => reject(new Error("VERIFICATION_CANCELLED")),
              },
            }),
          ),
        );
        if (!generation.current.mounted) return;
        current = generation.current.value;
        setBusy(true); // Read the newly verified account before deciding whether to replace.
      }
      const result = await cocowheelsApi<{
        route: UsualRoute | null;
        alertsAvailable: boolean;
      }>("/api/usual-route");
      if (current !== generation.current.value) return;
      setExisting(result.route);
      setAvailable(result.alertsAvailable);
      if (result.route && !sameRoute(result.route, { origin, destination }))
        setPrompt("replace");
      else if (result.route) {
        setSaved(true);
      } else await persist(null, false, result.alertsAvailable);
    } catch (reason) {
      if (
        current === generation.current.value &&
        !(
          reason instanceof Error && reason.message === "VERIFICATION_CANCELLED"
        )
      )
        fail(reason);
    } finally {
      if (current === generation.current.value) setBusy(false);
    }
  }
  return (
    <div className="save-search-route">
      <button
        type="button"
        className="text-button save-route-button"
        disabled={busy || saved}
        onClick={() => void begin()}
      >
        {busy ? "Saving…" : saved ? "Route saved" : "Save route"}
      </button>
      {prompt && createPortal(
        <SaveRoutePrompt
          key={prompt}
          notify={prompt === "notify"}
          busy={busy}
          close={() => setPrompt(null)}
          confirm={() => void persist(existing, prompt === "notify", available)}
        />,
        document.body,
      )}
      {error && createPortal(<Message text={error} close={() => setError(null)} />, document.body)}
    </div>
  );
}

function SaveRoutePrompt({
  notify,
  busy,
  close,
  confirm,
}: {
  notify: boolean;
  busy: boolean;
  close: () => void;
  confirm: () => void;
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
        aria-label={
          notify
            ? "Would you like to get notified about matching rides?"
            : "Replace your saved route?"
        }
        className="cancel-prompt save-route-prompt"
      >
        <p>
          {notify
            ? "Would you like to get notified about matching rides?"
            : "Replace your saved route?"}
        </p>
        {notify && (
          <p>
            Receive emails when matching rides become available.
            <br />
            Change this anytime in Profile.
          </p>
        )}
        <div className="cancel-prompt-actions">
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={confirm}
          >
            {notify ? "Notify me" : "Replace"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={close}
          >
            {notify ? "Not now" : "Cancel"}
          </button>
        </div>
      </section>
    </div>
  );
}
