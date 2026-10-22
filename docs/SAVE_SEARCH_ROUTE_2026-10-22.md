# Save a Find-a-ride route and explicitly opt into emails

22 October 2026. Source baseline `ecbbd16` plus this commit series.

## Implemented

- A separate secondary Save route button below the Find map legend, independent
  of available/empty results. No tab change or inferred weekday/time.
- Existing identical addresses: Route saved on the same disabled button; no
  write, repeated opt-in prompt or reset of custom settings.
- Different saved addresses: Replace your saved route? / Replace / Cancel.
  Cancellation keeps the old route. Replacement changes addresses only, retaining
  schedule, payment and email preferences. Profile edits need no such confirmation.
- New routes use explicit anyTime mode, free fare and emails off. Successful saves
  with emails off offer Get notified about matching rides? / Notify me / Not now.
  Copy explains email delivery and that preferences can be changed in Profile.
  Dismissing, Escape or Not now leaves the route saved, emails off and user in Find.
  Already-enabled alerts skip the prompt. Previously disabled alerts require
  explicit Notify me. If delivery is unavailable, save still works without opt-in.
- Sign-in uses the existing modal in place before reading account settings.
  Async responses are ignored after identity changes/unmount; writes never retry
  automatically under another identity. Errors reuse the existing Message modal.
- Profile Edit schedule keeps addresses/payment/consent and supports any day/time
  or selected weekdays and one Sydney ±60-minute window. Existing legacy records
  without anyTime remain scheduled or non-matching as before. New Profile drafts
  now start with emails off, superseding earlier default-on drafts.
- Authenticated POST /api/usual-route/from-search atomically compares the expected
  saved settings before writing. A concurrent change yields 409, not an overwrite.
  No schema rewrite, history deletion, new poller, automatic booking or email on
  save. Only future publication triggers matches; existing outbox/privacy/quotas
  and spatial corridor rules remain unchanged. Provider availability gates opt-in.

## Verification

All data/API fixtures are synthetic. Node tests use isolated SQLite/loopback HTTP;
browser tests use local :3090, mock APIs and block external requests. No emails,
provider calls, real rides, live locations or production records were created.

Commands:

```bash
npm test
npx eslint components/save-search-route.tsx components/route-schedule.tsx components/usual-route-client.tsx components/home-client.tsx components/ride-preview-client.tsx components/departure-countdown.tsx server/usual-routes.ts server/index.ts lib/usual-route.ts
npm run build
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-save-route.py
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-driver-departure.py
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-usual-route.py
```

134 regression tests passed, including new consent, old-schedule compatibility,
all-time matching, stale-write rejection, owner-scoped HTTP and one-time future
alert delivery. Find browser flows passed at 320/390/844/1440px: initial save,
Not now, same-route no-op, cancel/replace, explicit opt-in, enabled-alert prompt
skip, conflict errors and Profile refinement with retained payment/consent.

Whole-screen 390/1440px screenshots reviewed for Find, consent and Profile:
existing typography/colours, restrained body weight, equal modal buttons,
no clipped time input, separate map legend/results/save responsibilities.
Home width and driver Departure screenshots reviewed at 390/1440px too.
Map tiles were deliberately blocked; these are layout checks, not live-map checks.

The first browser test incorrectly asserted that the existing `?start=rider`
query remained after navigation. The app already consumes it. Corrected the test
to assert the chooser remains visible; rerun passed. An initial lint finding on
async lifecycle state was fixed with a ref-based generation guard.
A subsequent combined browser run stopped at a Chromium screenshot-capture
protocol error in the Home test, after all four save-route widths passed.
This was a capture failure, not an assertion failure; remaining checks were
rerun separately after the concurrent build finished: driver checks passed at
390/1440px and the existing usual-route browser suite passed at all four widths.
Final targeted ESLint and production build passed without warnings/errors.

## Activation and limitations

Requires Pi API restart independently of frontend deployment. No new environment
variables or database migration. Never restart during real trips without approval.
This report does not claim production activation, inbox arrival, physical iPhone/
Safari testing or load capacity. Browser APIs were mocked; real HTTP/database
behavior was checked separately by the Node suite.

Manual check: Find a ride → choose both addresses → Save route → Not now or
Notify me. Stay on chooser. Try a different route and Cancel/Replace. Open Profile
→ Edit schedule to narrow days/time, and Mute email alerts to opt out.
