import type { Db } from "./core";
import type {
  RatingRole,
  RatingSummary,
  RideRatingState,
} from "../lib/rating-types";

export const RATING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_PUBLIC_RATINGS = 5;

type EligibleRide = {
  id: string;
  driver_session_id: string;
  rider_id: string;
  completed_at: string;
  status: string;
  is_sample: number;
  co_ride_started_at: string | null;
};
function participantRide(db: Db, publicId: string, principal: string) {
  const ride = db
    .prepare(
      `SELECT r.id, r.driver_session_id, q.rider_session_id AS rider_id,
    r.completed_at, r.status, r.is_sample, r.co_ride_started_at FROM rides r
    JOIN ride_requests q ON q.id = r.accepted_request_id AND q.ride_id = r.id AND q.status = 'ACCEPTED'
    WHERE r.public_id = ?`,
    )
    .get(publicId) as EligibleRide | undefined;
  if (!ride || ![ride.driver_session_id, ride.rider_id].includes(principal))
    throw new Error("RIDE_ACCESS_DENIED");
  return ride;
}
function eligible(ride: EligibleRide) {
  return (
    ride.status === "COMPLETED" &&
    !ride.is_sample &&
    Boolean(ride.co_ride_started_at && ride.completed_at) &&
    ride.driver_session_id !== ride.rider_id
  );
}
export function rideRatingState(
  db: Db,
  publicId: string,
  principal: string,
  now = new Date(),
): RideRatingState | undefined {
  const ride = participantRide(db, publicId, principal);
  if (!eligible(ride)) return undefined;
  const closesAt = new Date(
    Date.parse(ride.completed_at) + RATING_WINDOW_MS,
  ).toISOString();
  const submitted = Boolean(
    db
      .prepare("SELECT 1 FROM ride_ratings WHERE ride_id = ? AND rater_id = ?")
      .get(ride.id, principal),
  );
  return {
    canRate:
      !submitted &&
      now.getTime() >= Date.parse(ride.completed_at) &&
      now.getTime() < Date.parse(closesAt),
    submitted,
    targetRole: principal === ride.driver_session_id ? "RIDER" : "DRIVER",
    closesAt,
  };
}
export function submitRating(
  db: Db,
  publicId: string,
  principal: string,
  score: unknown,
  now = new Date(),
) {
  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 1 ||
    score > 5
  )
    throw new Error("INVALID_RATING");
  return db
    .transaction(() => {
      const ride = participantRide(db, publicId, principal);
      if (!eligible(ride)) throw new Error("RATING_UNAVAILABLE");
      const existing = db
        .prepare(
          "SELECT score FROM ride_ratings WHERE ride_id = ? AND rater_id = ?",
        )
        .get(ride.id, principal) as { score: number } | undefined;
      // Safe retry after a lost response, without permitting edits or duplicates.
      if (existing) {
        if (existing.score !== score)
          throw new Error("RATING_ALREADY_SUBMITTED");
        return rideRatingState(db, publicId, principal, now);
      }
      const deadline = new Date(
        Date.parse(ride.completed_at) + RATING_WINDOW_MS,
      );
      if (now >= deadline || now.getTime() < Date.parse(ride.completed_at))
        throw new Error("RATING_WINDOW_CLOSED");
      const driver = principal === ride.driver_session_id;
      db.prepare(
        `INSERT INTO ride_ratings (ride_id, rater_id, recipient_id, recipient_role, score, created_at, release_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        ride.id,
        principal,
        driver ? ride.rider_id : ride.driver_session_id,
        driver ? "RIDER" : "DRIVER",
        score,
        now.toISOString(),
        deadline.toISOString(),
      );
      const count = db
        .prepare("SELECT count(*) AS n FROM ride_ratings WHERE ride_id = ?")
        .get(ride.id) as { n: number };
      if (count.n === 2)
        db.prepare(
          "UPDATE ride_ratings SET release_at = ? WHERE ride_id = ?",
        ).run(now.toISOString(), ride.id);
      // No rating value in the shared event log (which could identify the author).
      return rideRatingState(db, publicId, principal, now);
    })
    .immediate();
}
export function ratingSummary(
  db: Db,
  principal: string,
  role: RatingRole,
  now = new Date(),
): RatingSummary {
  const row = db
    .prepare(
      `SELECT count(*) AS n, avg(score) AS average FROM ride_ratings
    WHERE recipient_id = ? AND recipient_role = ? AND release_at <= ?`,
    )
    .get(principal, role, now.toISOString()) as {
    n: number;
    average: number | null;
  };
  return row.n >= MIN_PUBLIC_RATINGS && row.average !== null
    ? { average: Math.round(row.average * 10) / 10, count: row.n }
    : null;
}
