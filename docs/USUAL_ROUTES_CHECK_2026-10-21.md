# Usual routes verification — 21 October 2026

Source baseline: `0ea5d81`; implementation is in the commit containing this report.
This is feature/regression verification, **not** a new capacity certification.
The publication-time route scan and alert worker have not been load-tested.

## Reproduction and isolation

```sh
COCOWHEELS_DB_PATH=/tmp/gumwheel-routines-check.db node --import tsx --test tests/*.test.ts
npm run lint
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
# Separate terminal; requires Python Playwright and Chromium:
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-usual-route.py
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-message-entry.py
# Stop the isolated dev server before the build:
npm run build
npx tsc --noEmit
```

Browser fixtures intercept APIs and block external traffic; the dev-server proxy
also points to an unused loopback port. Backend tests use in-memory/temporary
SQLite and injected email senders. No real email, rider request or offer was
created during these tests.

## Evidence

- 120/120 unit/API/regression tests passed, no skips.
- Backend checks cover strict validation, authenticated ownership, cross-account
  isolation, soft removal, fresh GPS, destination/payment server ownership,
  active-role protection, schedule boundaries/DST/midnight, direction/proximity,
  one notification per offer, mute/replacement/cancellation/expiry suppression,
  active-recipient suppression, persistent hourly/daily budgets, retry payload/
  idempotency stability, three-attempt ceiling and preserved ride history.
- Usual-route Chromium checks at 320/390/844/1440px cover form validation,
  selected days and computed window, save/reload, mute/enable, optional payment,
  departure selection, denied/fresh GPS, duplicate active-offer errors,
  replacement confirmation/focus/Escape, logout isolation, outage recovery and
  matching-email links (unavailable modal; available ride opens existing preview
  without submitting a request).
  The normal Offer a ride screen also checks the shared Leaving selector,
  selection state and absence of horizontal overflow at all four widths.
- Existing request-to-message checks passed at 320/393/1440px, both chooser and
  preview: request failure/retry, editable draft, no automatic send, no scroll
  jump and refresh behavior (six cases).
- Production build and ESLint passed. The build includes `/usual-route`.
- Screenshots are reproducible under `/tmp/usual-route-{form,saved}-WIDTH.png`.
  Visually reviewed the mobile/desktop form, saved card and normal Offer a ride for typography,
  hierarchy, icon size, wrapping and spacing. Removed inherited field/button
  margins inside the grid so spacing has a single owner.

## Failed checks and corrections

- First cancellation fixture passed token/ride arguments in the wrong order;
  corrected the fixture and reran the complete suite.
- Two old assertions expected “Published”/“Publish your route”; updated to the
  deliberately changed participant wording and reran.
- Lint found render-time ref access in identity-generation protection. Replaced
  it with a stable instance object; lint passed.
- First browser GPS stub was accidentally executed by Playwright evaluation;
  corrected the fixture wrapper. A later run used system Python without
  Playwright; reran using the established isolated environment.
- Review found an outage presenting sign-in copy and future offers showing
  immediate pickup estimates. Added explicit load retry, departure-delay-aware
  discovery estimates and suppressed premature preview pickup badges.
- Standalone TypeScript during development reported existing test typing issues,
  reproduced against `0ea5d81` with the same generated dev types (plus a missing
  new-route validator reference in that baseline). Production build type checking
  passed. Standalone `tsc --noEmit` still reports those existing test errors after
  the build; this check is **not** recorded as passing. No unrelated test typing
  edits were made.
- Sandboxed Next build stalled during compilation; stopped that build and ran
  the normal build with permission for its worker processes. It passed.

## Deployment and remaining boundaries

The dedicated `cocowheels-api` service was restarted after a consistent SQLite
backup (directory mode 0700, database 0600) and a zero accepted/in-progress-trip
check. Backup and post-migration `integrity_check` returned `ok`. All 114 rides
and 71 requests were preserved; new routine/alert tables were empty. Local
`/api/health` returned `{"status":"ok"}` and unauthenticated `/api/usual-route`
returned 401. No synthetic data was inserted in production.

The API-only alert switch is enabled in the untracked local environment, using
the existing configured mail sender and `https://www.gumwheel.com` public origin.
No login configuration, secret or delivery address changed. The switch remains
off in the example environment; actual provider quota/headroom and inbox delivery
are not certified by these checks. Only explicitly opted-in real accounts can
generate sends.

Frontend feature commit `5e3a33a4c4a83dca56d5a4e0eb1da7ab37d53ba7` was pushed
to main. GitHub's Vercel commit status reported success (“Deployment has
completed”), deployment `E7MdHoPtZaa3NdvscrEkUo2ieqQT`. The first public page
probe during rollout returned 404; the subsequent probe returned 200 and
contained “My usual route”. Public `/api/health` returned `{"status":"ok"}`;
public `/api/usual-route` returned 401 without authentication.

The Vercel connector could discover the project but deployment listing returned
403 for its team scope; no Vercel CLI was installed. Verification therefore used
the GitHub deployment status and public HTTP checks, not Vercel runtime logs.
An authenticated production browser journey and real email delivery are not
claimed verified.

Physical iPhone/Safari and Android GPS, native time pickers, real two-account
email inbox delivery and live map-provider coverage remain manual checks.
Email delivery is best effort, bounded to 20 attempts/hour and 50/rolling day;
these are conservative application limits, not verified provider headroom.
Login and alerts share Resend. The matcher is an approximate straight-line
corridor, not a traffic/road-detour guarantee. No location obfuscation is included.

## Owner's manual walkthrough

Use two authorized test accounts, not another student's real ride. Repeat the
main screens on your phone and desktop.

1. **Profile → My usual route:** choose origin/destination from search results.
   Saving must not create an active ride or expose the routine to the other account.
2. **Rider settings:** select days and Around 12:00. Confirm 11am–1pm Sydney time.
   Enable matching emails and save. Reload to confirm persistence.
3. **Saved route → Find a ride:** Mute then Enable email alerts. Replacing the
   route asks confirmation; keeping it or pressing Escape preserves it.
4. **Saved route → Offer a ride:** add fare/PayID, select Now/In 30 min/In 1 hour.
   Deny GPS once: nothing is offered. Allow GPS: the offer starts at your actual
   location and uses the saved destination, fare and intended departure.
5. **Normal Offer a ride tab:** check the same Leaving choices and Offer a ride
   wording. Check the driver’s active card and preview; history is unchanged.
6. **Matching alert:** with account A opted in for the current weekday/time,
   account B offers a geographically compatible route. A receives at most one
   matching email. GPS updates must not create more emails.
7. **Email → Review matching ride:** sign in as A if needed, review the shared
   map and request normally. No request is submitted merely by opening the email.
   Opening an unavailable/cancelled offer must show the unavailable message.
8. **Existing journey:** check requests, messaging, accept, pickup code, payment
   disclosure, cancellation/completion and notifications remain familiar.
9. **Privacy/lifecycle:** another signed-in account cannot see A's saved route;
   signing out clears its view. Replacing the routine does not remove existing
   rides/history. Muting prevents future queued alerts, not an email already sent.

If a route fails to match, check Sydney weekday/window, intended departure,
direction, endpoint proximity, consent and absence of another active role before
assuming email delivery failed. See USUAL_ROUTES.md for exact limits.
