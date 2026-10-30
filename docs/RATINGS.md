# Mutual ride ratings

Implemented in the ratings commit series based on `fe0a53d` (19 October 2026).
Production API activation is separate: a frontend push does not migrate/restart
the Pi API. Existing trips must not be interrupted to activate ratings.
Activated on the Pi at 21:14 AEDT, 19 October 2026, with approved restart and
backup; local/live-proxy health, schema and rating response fields verified.
See the dated check report for scope; no live rating was submitted as a test.

## Five-rating pilot threshold — 30 October 2026

The public threshold is five released received ratings per role, superseding the
original ten-rating rule. Existing stored ratings count immediately at API
activation; no data migration or backfill is needed. Four remain hidden; five
reveal both average and count. Keep the compact shared badge and its accessible
count description. Driver/rider aggregates remain separate. This improves early
visibility, not identity verification or a safety guarantee; smaller samples
provide weaker evidence and make individual feedback easier to infer. The
existing mutual/seven-day release and eligibility rules below remain unchanged.
Help’s second FAQ covers email codes, consent, private messages, pickup codes,
location sharing, vehicle details, ratings, cancellation and reporting, with
explicit identity/background-check/emergency-service limits.

See [30 October checks and activation](RATINGS_CHECK_2026-10-30.md).

## Rules

- Optional integer 1–5 stars; no comments, edits or automatic sanctions.
- Only the driver and accepted rider of a completed, pickup-verified, non-sample
  ride can rate each other. Cancelled/expired rides, unsuccessful requests and
  samples are ineligible. Samples never contribute to reputation.
- One score per participant per ride, keyed by stable account principal, not
  device/session token. Server derives recipient and role, ignoring supplied IDs.
- Window: completion inclusive to completion + seven days exclusive. Same-score
  retries are idempotent even after expiry; different-score retries cannot edit.
- Scores enter aggregates when both submit, or seven days after completion.
  Mutual release is transactional; deadline release is timestamp-based on reads,
  requiring no scheduled worker.
- **Five released ratings received per role**, not merely five completed rides,
  are required to reveal any average/count. Unrated rides do not count. Driver and
  rider averages are separate. All released scores have equal weight; display one
  decimal and count. No below-threshold progress/count is exposed.
- No individual score/author endpoint or score in shared ride events. This reduces
  attribution risk; it cannot guarantee anonymity from aggregate changes or repeat
  partners. Anti-farming/collusion detection is not implemented.

## Storage/API

`ride_ratings`: ride, rater/recipient principals, recipient role, score, submission
and release timestamps. Unique constraints enforce one rater and recipient role
per ride; indexed by recipient/role/release. Schema initialization is additive and
idempotent. Database backups include ratings. Retained with history, no new
automatic deletion schedule or admin rating inspector.

`POST /api/rides/:publicId/ratings` accepts `{ "score": 1..5 }`, requires verified
university authentication, existing origin checks and participant authorization.
Returns own `{ rating: { canRate, submitted, targetRole, closesAt } }`, no score,
with no-store. Invalid score: 400; unverified: 401; nonparticipant: 403;
already-submitted/ineligible: 409; window closed: 410.

Participant ride responses add own eligibility/submission state. Discovery and
preview responses include driver summaries; driver request cards include rider
summaries. University session adds `ratings.driver` and `ratings.rider`. Summary
is `null` below threshold, otherwise `{ average, count }`.

## UI/failures

Shared completed-ride view: only “How was your driver/rider?” and five native star
buttons below the map legend, above details. Each has a 44px target and keyboard
focus. Tap/click or Enter/Space submits immediately; focus alone does not submit.
This supersedes the initial radio controls and separate submit button. Removed
helper copy does not change the seven-day window, immutable scores or threshold.
Controls disable while sending, with an immediate duplicate-submission guard.
Shared transport/error modal preserves the attempted score; tapping it again
retries, including the same-score idempotent retry after a lost response.
Success becomes acknowledgement; reload reads server state. Expired,
unrated windows have no form. Chooser/request/profile summaries share one compact
badge. Profile uses “Not enough ratings yet” below threshold. Reuse existing
colour, type and button tokens, no competing bold body or new colour palette.

See [dated checks](RATINGS_CHECK_2026-10-19.md). Previous capacity tests predate
the new indexed aggregate queries; production history-scale performance remains
unbenchmarked. Real-device Safari and production deployment checks are separate.
