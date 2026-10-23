# Matching email and navigation — 23 October 2026

## Time-first and fare-label refinement

Based on 84964ab: new HTML/plain-text payloads say “Leaving at 2:40 pm on
Friday, 23 October”, then “Fare: Free” (paid values retain A$ and cents).
No forced break inside departure text; regular body styling, natural wrapping,
logo, links and coordination helper unchanged. Sydney timezone remains explicit
in formatting, not visible copy. No countdown, lifecycle, consent or delivery changes.
Existing persisted retry payloads are not rewritten. API activation pending approval.

Checks: 154 tests passed, lint and production build passed. Initial new assertions
caught en-AU omitting the desired weekday comma; explicit date parts fixed this
and the complete suite passed on rerun. Midnight/Sydney winter offset, free/paid
HTML/text and escaping covered. The existing browser suite passed before the
punctuation adjustment; its rerun hit stale local frontend assets after rebuilding.
Final email-only check avoids frontend dependencies:
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-email-copy.py`.
Free/paid renders passed at 320/390/1440px without overflow or external requests.
Whole 320px and 1440px emails visually reviewed for natural wrapping, unchanged
logo alignment, hierarchy, regular fare weight, spacing and CTA prominence.
Real inbox rendering and Apple calendar detection remain unverified; no real email sent.

Baseline e81955c. Scope: alert presentation and destination flow, not matching
thresholds, availability, OTP, delivery quotas or consent. No schema change.

## Familiarity research

- [Postmark transactional guidance](https://postmarkapp.com/guides/transactional-email-best-practices): direct useful subjects, mobile readability, restrained branding and accessible notification preferences.
- [Postmark notification guidance](https://postmarkapp.com/guides/comment-notification-email-best-practices): prioritise actionable content and a clear path to details.
- [BlaBlaCar](https://www.blablacar.in/): alerts on newly published matching rides. This supports the notification model, not a claim that our email duplicates its visual template.

Decision: no extra greeting. Lead with who offered the ride, planned time/fare,
then one primary View matching ride link styled as a button. Quiet mute link at
the bottom. Reuse ink #111827, muted #64748b, surface #fff, subtle #f8fafc and
line #e2e8f0, Arial, 16px body, 14px supporting copy, 12px footer. Single-column
560px maximum, 16px outer/24px inner spacing; inline styles/presentation tables,
no images/scripts/external fonts. Plain text is retained for clients that need it.
Real Gmail/Outlook/Safari rendering is not established by Chromium previews.
Final copy: “A matching ride from [UniKey]”; preserve the exact lowercase identity.
Remove the visible Sydney time suffix (formatting timezone unchanged) and the
flexibility sentence; retain “Coordinate pickup in messages.”

## Behaviour and security

See [current contract](USUAL_ROUTES.md). No private coordinates in email URLs;
the authenticated usual-route API loads the current account's preferences. Link
contains only public offer ID. No auto-join or auto-mute. Dynamic HTML is escaped;
retry payloads and idempotency keys remain unchanged once persisted.

The reported specific unavailable ride was not identifiable from the conversation.
The old review flow displayed unavailable when its preview failed or its ID was
absent from search results. No claim of a confirmed lifecycle bug is made. The new
flow removes the unnecessary Profile step and keeps alternatives accessible.

## Verification

- `npm test`: 148 passing isolated tests, including alert content, escaping,
  recipient/privacy checks, suppression and exact-payload retry/idempotency.
- Local frontend: `COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090`.
- `/tmp/gumwheel-pickup-check-env/bin/python scripts/check-matching-email.py` mocks
  all APIs and blocks external requests. Covers target second in results, legacy
  redirect, unavailable fallback, sign-in resume, missing saved route, mute
  expansion/focus, no mutations, responsive HTML and no horizontal overflow.
- Initial browser attempt found no local server (connection refused); started
  isolated frontend before rerun. No production data or provider used in tests.
- Final browser checks passed at 320/390/1440px, including missing saved route
  and Find active-navigation state. Email-render fixture initially used an ESM
  named import incompatible with this project's CommonJS tsx runtime; corrected
  fixture import and reran successfully. Production code was unaffected.
- Final lint and production build passed. Whole email and destination screenshots
  were reviewed at mobile/desktop widths for hierarchy, CTA prominence, spacing,
  target selection and focused mute control. Map tiles intentionally blocked.
- React review: existing HomeClient/chooser reused; async account loads are
  generation-guarded and listeners cleaned up. No new polling loop or UI library.
- Final wording refinement: 12/12 targeted email/usual-route tests passed; browser
  checks rerun at all three widths and final email previews visually reviewed.

## API activation

Owner approved restart only with no trips underway. On 23 October, verified zero
accepted/active trips, backed up SQLite using its backup API into a private ignored
data directory (0700 directory, 0600 file), and checked integrity/FKs. Rechecked
zero underway immediately before restarting only cocowheels-api at 12:20:32 AEDT.
Local and public-proxy health both returned ok; 123 rides retained, integrity ok,
zero FK violations. Source is this commit series based on e81955c. No schema change
or test email send. Frontend push/deployment is separate. Older persisted retry
payloads are intentionally not rewritten; new payloads use HTML plus text.
Final wording activated at 12:24:35 AEDT after a fresh verified backup and another
zero-underway check; local/public health, 123 retained rides, integrity and FK
checks passed again.

## Manual checks

Open a new matching email: check readable layout, View matching ride opens the
map/results with the relevant ride selected, Request to join still explicit.
Try a signed-out browser, an old review link and an unavailable offer. Open Mute
matching emails: Profile opens its route section, alert control focused, no mute
until confirmed. Already-muted accounts remain off. Real inbox delivery and
authenticated production walkthrough remain separate from local verification.
