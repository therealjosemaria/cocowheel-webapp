"use client";

import { useId, useRef, useState } from "react";
import type { RatingSummary, RideRatingState } from "@/lib/rating-types";
import { ApiError, apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import { Message } from "./ride-journey-controls";

export function RatingBadge({ summary }: { summary?: RatingSummary }) {
  if (!summary) return null;
  return (
    <span
      className="rating-summary"
      aria-label={`${summary.average.toFixed(1)} out of 5 from ${summary.count} ratings`}
    >
      <span aria-hidden="true">★</span> {summary.average.toFixed(1)} (
      {summary.count})
    </span>
  );
}

export default function RideRating({
  rideId,
  state,
}: {
  rideId: string;
  state?: RideRatingState;
}) {
  const id = useId();
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!state || (!state.canRate && !state.submitted && !submitted)) return null;
  async function submit(value: number) {
    if (sending.current || submitted || state?.submitted || !state?.canRate)
      return;
    sending.current = true;
    setScore(value);
    setBusy(true);
    try {
      await cocowheelsApi(`/api/rides/${encodeURIComponent(rideId)}/ratings`, {
        method: "POST",
        body: JSON.stringify({ score: value }),
      });
      setSubmitted(true);
      window.dispatchEvent(new Event("cocowheels:ride-updated"));
      window.dispatchEvent(new Event("focus"));
    } catch (reason) {
      const messages: Record<string, string> = {
        RATING_WINDOW_CLOSED: "The seven-day rating window has closed.",
        RATING_ALREADY_SUBMITTED: "You’ve already rated this ride.",
        RATING_UNAVAILABLE: "This ride isn’t eligible for a rating.",
      };
      setError(
        apiErrorMessage(
          reason,
          reason instanceof ApiError
            ? (messages[reason.code] ??
                "We couldn’t save your rating. Please try again.")
            : "We couldn’t save your rating. Please try again.",
        ),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="ride-rating" aria-label="Rate your ride">
      {submitted || state.submitted ? (
        <p role="status">Thanks for rating your ride.</p>
      ) : (
        <div role="group" aria-labelledby={id} aria-busy={busy}>
          <h2 id={id}>
            How was your {state.targetRole === "DRIVER" ? "driver" : "rider"}?
          </h2>
          <div className="rating-stars">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                onClick={() => void submit(value)}
                aria-label={`Rate ${value} ${value === 1 ? "star" : "stars"}`}
                aria-pressed={score === value}
                className={
                  value <= score ? "rating-star selected" : "rating-star"
                }
              >
                <span aria-hidden="true">★</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <Message text={error} close={() => setError(null)} />}
    </section>
  );
}
