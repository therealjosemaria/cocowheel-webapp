"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import {
  conversationTarget,
  type Conversation,
  type ConversationSummary,
} from "@/lib/messaging-types";
import { Message } from "./ride-journey-controls";

// Never replay a private message after signing in as a different account.
const chatApi = <T,>(path: string, init: RequestInit = {}) =>
  cocowheelsApi<T>(path, init, true);

export function ReportConcern({ rideId }: { rideId: string }) {
  return (
    <div className="ride-report">
      <a
        href={`mailto:jmos0905@uni.sydney.edu.au?subject=${encodeURIComponent(`GUMWHEEL ride concern: ${rideId}`)}`}
      >
        Report a concern
      </a>
      <span>Opens email. Not an emergency service.</span>
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
  const confirm = useRef<HTMLDialogElement | null>(null);
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
      if (location.hash === `#${target}`) setOpen(true);
    };
    const requested = (event: Event) => {
      if ((event as CustomEvent<string>).detail === target) setOpen(true);
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
      confirm.current?.close();
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
  }, [target, invalidate]);
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
  async function stop() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    const currentGeneration = generation.current;
    try {
      await chatApi(path + "/stop", { method: "POST", body: "{}" });
      if (generation.current !== currentGeneration) return;
      confirm.current?.close();
      setData((previous) =>
        previous
          ? { ...previous, stopped: true }
          : { messages: [], stopped: true },
      );
      setDraft("");
      refreshNotices();
    } catch (reason) {
      if (generation.current !== currentGeneration) return;
      confirm.current?.close();
      setError(
        apiErrorMessage(
          reason,
          "We couldn’t stop messaging. Please try again.",
        ),
      );
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
                      onClick={() =>
                        setDraft(
                          "Hi! Where should we meet, and what’s your car’s number plate?",
                        )
                      }
                    >
                      Hi! Where should we meet, and what’s your car’s number
                      plate?
                    </button>
                  ) : null}
                  <label>
                    Message
                    <textarea
                      value={draft}
                      maxLength={1000}
                      rows={3}
                      required
                      onChange={(e) => setDraft(e.target.value)}
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
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => confirm.current?.showModal()}
                    >
                      Stop messaging
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
          <div className="message-footer">
            <a className="message-ride-actions" href="#ride-actions">
              Ride actions
            </a>
            <ReportConcern rideId={rideId} />
          </div>
        </div>
      ) : null}
      <dialog
        ref={confirm}
        className="cancel-prompt message-stop-dialog"
        aria-label="Stop messaging"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <p>Stop messages for this request? Your ride will stay unchanged.</p>
        <div className="cancel-prompt-actions">
          <button
            className="secondary"
            disabled={busy}
            onClick={() => confirm.current?.close()}
          >
            KEEP MESSAGING
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => void stop()}
          >
            STOP MESSAGING
          </button>
        </div>
      </dialog>
      {error ? <Message text={error} close={() => setError(null)} /> : null}
    </details>
  );
}
