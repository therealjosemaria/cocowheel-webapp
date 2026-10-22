"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import {
  conversationTarget,
  MESSAGE_STARTER,
  DRIVER_MESSAGE_STARTER,
  type Conversation,
  type ConversationSummary,
} from "@/lib/messaging-types";
import { Message } from "./ride-journey-controls";
import { SUPPORT_LABEL, supportWhatsAppUrl } from "@/lib/support";
import { revealDetailsAncestors } from "@/lib/reveal-details";

// Never replay a private message after signing in as a different account.
const chatApi = <T,>(path: string, init: RequestInit = {}) =>
  cocowheelsApi<T>(path, init, true);

export function ReportConcern({ rideId }: { rideId: string }) {
  return (
    <div className="ride-report">
      <a
        href={supportWhatsAppUrl(rideId)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {/* Bootstrap Icons v1.13.1; see docs/licenses/bootstrap-icons.txt. */}
        <svg
          className="ride-report-icon"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232" />
        </svg>
        <span>{SUPPORT_LABEL}</span>
      </a>
    </div>
  );
}
function refreshNotices() {
  window.dispatchEvent(new Event("cocowheels:messages-updated"));
}
export default function RideMessages({
  rideId,
  summary,
  rider,
}: {
  rideId: string;
  summary: ConversationSummary;
  rider: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const starter = rider ? MESSAGE_STARTER : DRIVER_MESSAGE_STARTER;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [readError, setReadError] = useState(false);
  const pending = useRef<{ text: string; clientId: string } | null>(null);
  const sending = useRef(false);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const controller = useRef<AbortController | null>(null);
  const lastRead = useRef(0);
  const tail = useRef<HTMLSpanElement | null>(null);
  const path = `/api/rides/${encodeURIComponent(rideId)}/conversations/${encodeURIComponent(summary.requestId)}`;
  const target = conversationTarget(summary.requestId);
  const unavailable = closed || summary.stopped || data?.stopped;
  const load = useCallback(async () => {
    if (document.visibilityState !== "visible" || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await chatApi<Conversation>(path, {
        signal: abort.signal,
      });
      if (!abort.signal.aborted) {
        setData(result);
        setReadError(false);
      }
    } catch (reason) {
      if (abort.signal.aborted) return;
      if (
        reason instanceof ApiError &&
        [401, 403, 409].includes(reason.status)
      ) {
        setData(null);
        setDraft("");
        setClosed(true);
      } else setReadError(true);
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }, [path]);
  useEffect(() => {
    if (!open || closed) return;
    const initial = setTimeout(() => void load(), 0);
    const refresh = () => void load();
    window.addEventListener("cocowheels:current-updated", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(initial);
      controller.current?.abort();
      controller.current = null;
      window.removeEventListener("cocowheels:current-updated", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [open, closed, load]);
  useEffect(() => {
    const follow = () => {
      if (location.hash === `#${target}`) {
        const element = document.getElementById(target);
        if (element) revealDetailsAncestors(element);
        setOpen(true);
      }
      const url = new URL(location.href);
      if (
        rider &&
        !summary.stopped &&
        url.searchParams.get("compose") === "1" &&
        (!url.searchParams.has("request") ||
          url.searchParams.get("request") === summary.requestId)
      ) {
        url.searchParams.delete("compose");
        window.history.replaceState(window.history.state, "", url);
      }
    };
    const requested = (event: Event) => {
      if ((event as CustomEvent<string>).detail === target) {
        const element = document.getElementById(target);
        if (element) revealDetailsAncestors(element);
        setOpen(true);
      }
    };
    const initial = setTimeout(follow, 0);
    const clear = () => {
      invalidate();
      controller.current?.abort();
      setData(null);
      setDraft("");
      setOpen(false);
      pending.current = null;
      lastRead.current = 0;
      setClosed(true);
    };
    window.addEventListener("hashchange", follow);
    window.addEventListener("cocowheels:open-conversation", requested);
    window.addEventListener("cocowheels:identity-changed", clear);
    return () => {
      invalidate();
      clearTimeout(initial);
      window.removeEventListener("hashchange", follow);
      window.removeEventListener("cocowheels:open-conversation", requested);
      window.removeEventListener("cocowheels:identity-changed", clear);
    };
  }, [target, invalidate, rider, summary.requestId, summary.stopped]);
  const latest = data?.messages.at(-1)?.id ?? 0;
  useEffect(() => {
    if (
      !open ||
      !tail.current ||
      !latest ||
      latest <= lastRead.current ||
      closed
    )
      return;
    let acknowledging = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          !entries[0]?.isIntersecting ||
          document.visibilityState !== "visible" ||
          acknowledging
        )
          return;
        acknowledging = true;
        void chatApi(path + "/read", {
          method: "POST",
          body: JSON.stringify({ lastId: latest }),
        })
          .then(() => {
            lastRead.current = latest;
            refreshNotices();
          })
          .catch(() => {
            acknowledging = false;
          });
      },
      { threshold: 1 },
    );
    observer.observe(tail.current);
    return () => observer.disconnect();
  }, [open, latest, path, closed, data]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || unavailable || !draft.trim()) return;
    sending.current = true;
    setBusy(true);
    const currentGeneration = generation.current;
    const text = draft.trim();
    if (pending.current?.text !== text)
      pending.current = { text, clientId: crypto.randomUUID() };
    try {
      await chatApi(path, {
        method: "POST",
        body: JSON.stringify(pending.current),
      });
      if (generation.current !== currentGeneration) return;
      pending.current = null;
      setDraft("");
      await load();
      refreshNotices();
    } catch (reason) {
      if (generation.current !== currentGeneration) return;
      const messages: Record<string, string> = {
        MESSAGE_RATE_LIMITED:
          "Please wait a minute before sending another message.",
        CONVERSATION_CLOSED: "This conversation has ended.",
        MESSAGING_STOPPED: "Messaging has been stopped.",
        CONVERSATION_FULL: "This conversation has reached its message limit.",
        INVALID_MESSAGE: "Enter a message of up to 1,000 characters.",
      };
      setError(
        apiErrorMessage(
          reason,
          reason instanceof ApiError
            ? (messages[reason.code] ??
                "We couldn’t send your message. Please try again.")
            : "We couldn’t send your message. Please try again.",
        ),
      );
      if (
        reason instanceof ApiError &&
        [
          "CONVERSATION_CLOSED",
          "RIDE_ACCESS_DENIED",
          "UNIVERSITY_VERIFICATION_REQUIRED",
        ].includes(reason.code)
      ) {
        setClosed(true);
        setData(null);
        setDraft("");
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <details
      id={target}
      className="ride-messages"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        {summary.unread
          ? `Messages with ${summary.peer} (${summary.unread} unread)`
          : `Messages with ${summary.peer}`}
      </summary>
      {open ? (
        <div className="ride-message-body">
          {closed ? (
            <p>This conversation has ended.</p>
          ) : (
            <>
              {readError ? (
                <p role="status">
                  Messages couldn’t be refreshed.{" "}
                  <button className="text-button" onClick={() => void load()}>
                    Try again
                  </button>
                </p>
              ) : null}
              {!data && !readError ? (
                <p role="status">Loading messages…</p>
              ) : null}
              <ol
                className="message-list"
                aria-label={`Messages with ${summary.peer}`}
              >
                {data?.messages.map((m, i) => (
                  <li key={m.id} className={m.mine ? "message-mine" : ""}>
                    <span>{m.mine ? "You" : summary.peer}</span>
                    <p>{m.text}</p>
                    <time dateTime={m.createdAt}>
                      {new Date(m.createdAt).toLocaleTimeString("en-AU", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                    {i === data.messages.length - 1 ? (
                      <span
                        ref={tail}
                        className="message-read-marker"
                        aria-hidden="true"
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
              {unavailable ? (
                <p>Messaging has been stopped. Your ride is unchanged.</p>
              ) : (
                <form onSubmit={send}>
                  {data && !draft && !data.messages.length ? (
                    <button
                      type="button"
                      className="secondary message-suggestion"
                      onClick={() => setDraft(starter)}
                    >
                      {starter}
                    </button>
                  ) : null}
                  <label>
                    Message
                    <textarea
                      value={draft}
                      maxLength={1000}
                      rows={3}
                      required
                      onChange={(e) => {
                        setDraft(e.target.value);
                      }}
                      disabled={busy}
                    />
                  </label>
                  <div className="message-actions ride-action-buttons">
                    <button
                      className="primary"
                      disabled={busy || !draft.trim()}
                    >
                      {busy ? "Sending…" : "Send message"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      ) : null}
      {error ? <Message text={error} close={() => setError(null)} /> : null}
    </details>
  );
}
