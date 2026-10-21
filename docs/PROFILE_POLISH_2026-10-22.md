# Profile and shared payment controls — 22 October 2026

Baseline: `713f02f`. Profile now names the menu action and page H1, with My usual
route inside. URLs, authentication, permissions and saved records are unchanged.
Removed introductory, travel-days, requirement and editor time-window prose.
Retained named origin/destination/time controls and accessible weekday group.
Time input containment addresses mobile intrinsic sizing without replacing the
native picker. Matching still uses Sydney time ±60 minutes and selected weekdays.

Matching emails default on only for new drafts when the backend reports delivery
available. Existing saved choices remain. No writes occur merely on page load.
Turning off uses the shared modal style, focus trap/restoration and Escape;
saved mutes persist only on success. Unavailable delivery remains explicitly shown.

PaymentFields is now reused in Profile and Offer a ride. Previously the separate
saved-route implementation lacked the normal form's PayID placeholders. Mobile,
email and Other now share examples, input modes and length limits. Fare inputs
allow an editable decimal draft, reject exponent/negative/oversized input, and
validate $1–$10,000 with at most two decimal places at submission and on the API.
Free remains zero. Decimal summaries show cents. SQLite's existing non-STRICT
INTEGER-affinity column preserves decimals (verified by round-trip test). Lowering
the minimum from 5 to 1 reuses the transactional table rebuild, handling both
historical >=5 and free-or->=5 checks, preserving records, indexes, triggers and
foreign keys. A private backup and integrity checks precede activation. No
existing fares are converted. API restart must
precede frontend release because the old process rejects decimal fares.

## Checks

Commands: `npm test`, `npm run lint`, `npm run build`,
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-usual-route.py`,
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-free-rides.py`.
Browser fixtures use the isolated :3090 frontend with disabled backend target,
mock API responses and blocked external traffic. No real emails or rides.

Initial regressions retained: sandbox tsx IPC denied (rerun with loopback
permission); one old saved-route test still rejected 5.50 (updated to reject
5.555). Existing dev server occupied :3090; its disabled backend target was
verified before reuse. Final results and activation are recorded below.

Build initially encountered the sandbox's local-port denial; the unrestricted
build passed. Chromium full-page capture twice failed during initial form entry;
dimension inspection showed no overflow, and settling the initial transition
allowed capture. A subsequent 5-second assertion expired while build/browser
checks competed for Pi resources; its final snapshot contained the correct Free
view. Browser assertions now allow 15 seconds for local dev compilation and the
final run is sequential, without a concurrent build. These are retained harness
observations, not a production performance measurement.

Physical iOS/Android native pickers and real email inbox delivery remain manual
checks. No claim of new capacity, delivery guarantees or load testing.

Final local results: 127/127 regression tests, lint, production build and diff
checks passed. Both browser scripts passed 320/390/844/1440px. Checks cover
Profile navigation, default email selection, modal cancel/confirm/Escape/focus
return, save/reload, placeholders for all PayID types, oversized input rejection,
decimal offering payloads, both participant roles and preserved paid disclosure.
Whole-screen editor, saved route, Offer and modal screenshots were visually
reviewed at mobile/desktop widths; time input and page overflow assertions passed.
Production activation is recorded separately below when verified.

## Production activation

API revision `c1eb023` activated after a fresh restricted SQLite online backup
and a zero-active-ride check. All 23 table snapshots matched the backup after
restart, all 115 ride records remained, the free-or->=1 CHECK was present,
integrity was ok and foreign-key checks were empty. Local and public proxy health
passed. No production test ride/email was created. This is an on-Pi backup, not
an off-Pi disaster-recovery verification. Frontend release follows the API.

Vercel production deployment `dpl_4Te9tNjr9ZPDVUqzZNvUTruSHSsw` reached READY for
`c1eb023`, with gumwheel.com/www.gumwheel.com assigned. Read-only live Chromium
checks at 390/1440px passed for Profile title, restored mobile PayID placeholder,
1.25 decimal entry/summary and no overflow. No login, ride submission or real
email delivery was exercised. Private Profile flows use the isolated fixtures
above, not another person's live account. Deployment-wide runtime log/drain
auditing was not part of this release check.
