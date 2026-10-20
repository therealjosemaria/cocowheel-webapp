"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import {
  conversationTarget,
  MESSAGE_STARTER,
  type Conversation,
  type ConversationSummary,
} from "@/lib/messaging-types";
import { Message } from "./ride-journey-controls";
import { SUPPORT_LABEL, supportWhatsAppUrl } from "@/lib/support";

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
        <svg
          className="ride-report-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.3-4.8A8.5 8.5 0 1 1 20.5 11.7Z" />
          <path d="m8.1 7.5 1.5-.2 1 2.4-1.1 1.1a7.2 7.2 0 0 0 3.7 3.7l1.1-1.1 2.4 1-.2 1.5c-.1.7-.8 1.1-1.5 1-4.2-.6-7.4-3.8-8-8-.1-.7.4-1.3 1.1-1.4Z" />
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
  const suggestOnLoad = useRef(false);
  const draftTouched = useRef(false);
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
        if (suggestOnLoad.current) {
          suggestOnLoad.current = false;
          if (
            !draftTouched.current &&
            !result.stopped &&
            !result.messages.length
          )
            setDraft(MESSAGE_STARTER);
        }
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
      if (location.hash === `#${target}`) setOpen(true);
      const url = new URL(location.href);
      if (
        rider &&
        !summary.stopped &&
        url.searchParams.get("compose") === "1" &&
        (!url.searchParams.has("request") ||
          url.searchParams.get("request") === summary.requestId)
      ) {
        suggestOnLoad.current = true;
        setOpen(true);
        url.searchParams.delete("compose");
        window.history.replaceState(window.history.state, "", url);
      }
    };
    const requested = (event: Event) => {
      if ((event as CustomEvent<string>).detail === target) setOpen(true);
    };
    const initial = setTimeout(follow, 0);
    const clear = () => {
      invalidate();
      suggestOnLoad.current = false;
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
                  {rider && !draft && !data?.messages.length ? (
                    <button
                      type="button"
                      className="secondary message-suggestion"
                      onClick={() => setDraft(MESSAGE_STARTER)}
                    >
                      {MESSAGE_STARTER}
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
                        draftTouched.current = true;
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
