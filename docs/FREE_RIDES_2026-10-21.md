# Free rides and optional contributions — 21 October 2026

Source baseline: `e994325` plus this working-tree change and the separately
requested, uncommitted matching-email cap removal. This report is not a claim
of production activation.

## Behaviour

- New normal offers and new usual routes default to fare 0. Existing saved
  routes load their previous payment settings; nothing silently converts them.
- Shared native Fare accordion shows Free or the contribution amount. Opening
  and closing it does not change payment mode. Ask for a contribution explicitly
  reveals fare and PayID controls. Unchecking it submits zero and no PayID value.
- Paid contributions retain integer AUD 5–10,000 validation and the same PayID
  validation. Invalid paid fields reopen the accordion before native validation.
- Saved payment changes require Save payment preferences. Offering with unsaved
  payment edits shows the existing message modal rather than using an old fare.
  Replacing a saved route defaults the replacement to free.
- Free is used across discovery, Home, Activity, preview/details and newly
  generated matching emails. Free rides have no payment instructions or Copy
  controls. Paid PayID disclosure remains gated on pickup confirmation.
- Pickup code, request/accept/withdraw/cancel/complete, GPS and ratings rules are
  unchanged. Free completion stores no payment handoff method. Help ends both
  role paths with Share the journey; FAQ/Terms/Privacy reflect free and paid rides.
- No new endpoint, migration of saved-route JSON, internal rename, cash support,
  change to paid offers, or history deletion policy.

## Database / rollout

Fresh schemas allow `price_aud = 0 OR price_aud >= 5`. API validation additionally
requires integer values and the existing upper bound. `allowFreeRideFares`
detects the legacy CHECK and transactionally copies the rides table to a new
table with only that CHECK changed, preserving all columns, rowids, indexes and
triggers. The original table is not renamed, so child foreign-key targets are
not rewritten. Foreign keys are checked before commit and the connection's
original FK setting is restored even on failure. Repeated startup is a no-op.
No trip records are intentionally removed or changed by this rebuild.

Production activation requires a private consistent SQLite backup, a suitable
restart window and the updated API before the frontend. Check row counts,
`integrity_check`, `foreign_key_check` and health after activation. Do not merely
deploy the free-default frontend against an old API: it will reject fare 0.
No production restart/migration or deployment has been performed in this turn.

## Reproducible verification

Results: final full suite 125/125 passed with no skips; both four-width browser
scripts passed, including free/paid discovery and Home/Activity checks. Final
lint, production build (including application TypeScript checks), and diff
whitespace checks passed. No production activation is claimed.

```sh
npm test
npm run lint
npm run build
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-free-rides.py
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-usual-route.py
```

Browser scripts require Playwright and `/usr/bin/chromium`; the Python path is
the existing local test environment. Every browser API is mocked, external
requests blocked, and the Next backend target disabled. API/lifecycle tests use
synthetic databases, loopback HTTP and fake email senders. No production rides,
real emails, bank transfers or stress tests are involved.

Backend checks cover zero/invalid/paid fares, legacy migration with populated
paid rides and linked requests, exact before/after table snapshots, custom
trigger/index preservation, FK/integrity checks, repeat initialization, free
pickup/completion/history, existing paid saved preferences, and normal/saved
free offers through HTTP (including ignoring spoofed shortcut payment fields).
Existing paid and authentication regressions remain part of the full suite.

Browser matrix: 320/390/844/1440px, default free and checked contribution forms,
collapsing without changing price, free/paid POST payloads, both roles awaiting
pickup/in progress/completed, paid disclosure gate, saved free-to-paid settings
and paid reload, Home/Activity summaries, Help/Privacy/Terms and overflow checks.
Whole-screen visual review uses generated `/tmp/free-*`, `/tmp/paid-*` and
`/tmp/usual-route-*` screenshots. Existing tokens and section hierarchy are
retained; review caught and fixed accordion-to-submit spacing and double padding
inside saved payment fields. Blank maps in these fixtures are deliberate blocked
external tiles, not a claimed map-provider test.

Failed baselines retained here: the first legacy fixture omitted ancillary
tables and the old moving-column migration; corrected fixture passes. Initial
browser GPS mock accidentally returned a function for Playwright to invoke;
fixed to an explicit wrapper. The initial driver fixture incorrectly included
the rider-only request field; corrected and now asserts the driver's pickup
input. An old Help assertion expected payment as step four; updated to the new
shared journey copy. These were test-fixture/expectation issues, not production
incidents. The existing dev server occupied 3090; its disabled backend override
was verified before reuse.
Discovery's test initially reloaded after the app had consumed `?start=rider`,
which correctly returned Home; the test now uses the actual Find entry URL.

Physical Safari/Android keyboards, real email delivery, real two-device trips,
production migration/backup restoration and deployment remain unverified.
No general reliability/capacity claim follows from these feature checks.

## Production activation — 21 October 2026

Following owner authorization, API revision `caf788a` was activated before the
frontend release. No active offers or journeys were present (115 terminal rides).
A restricted, on-Pi SQLite online backup was completed and verified before
restarting only `cocowheels-api`. After restart, all 23 table snapshots matched
the backup exactly, the zero-fare CHECK was present, `integrity_check` returned
ok and `foreign_key_check` returned no violations. Local and public-domain
`/api/health` returned ok. No live test rides or emails were created.
This supersedes the earlier unverified production migration statement, but is
not an off-Pi recovery test. Frontend release verification is recorded below
when complete; real device/provider boundaries above remain unverified.
