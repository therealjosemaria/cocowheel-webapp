# Messaging implementation checks — 20 October 2026

Source baseline: `57972cb`, plus the messaging commit series containing this
report. Isolated synthetic SQLite fixtures and mocked browser traffic only; no
production messages, emails, ride mutations or load test. Production inspection
uses aggregate counts, never participant identifiers, GPS or message content.

## Reproduce

```bash
COCOWHEELS_DB_PATH=/tmp/gumwheel-chat-tests.db node --import tsx --test tests/*.test.ts
npm run lint
npm run build
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
python scripts/check-messaging.py
```

Browser script needs Python Playwright and `/usr/bin/chromium`. Local run used
`/tmp/gumwheel-pickup-check-env/bin/python`. All non-loopback requests are blocked
and all `/api` calls intercepted. Blank basemap is intentional; no mapping-provider
traffic is needed. Run browser/dev and production build sequentially to avoid
generated Next type/build output changing underneath each other.

## Results and findings

- Backend suite: 108 tests passed, including seven new messaging tests. Covers
  both participants, outsider and other-request denial, public payload exclusion,
  exact duplicate retry, conflicting UUID reuse, invalid/control/oversized text,
  20/minute cross-thread sender quota, 500-message conversation boundary,
  monotonic/thread-scoped reads, bilateral stopping without cancellation,
  acceptance/discard, terminal closure, offer expiry, no deletion, and SQLite
  backup/reopen persistence. HTTP verified sessions, 401/403/409 and no-store
  tested. Test email sender is in-memory; nothing sent externally.
- Legacy schema review found new foreign keys must be created **after** the old
  request-table rename migration. Initialization was split accordingly; the
  legacy migration regression now checks the exact referenced table. Reopen
  test checks `foreign_key_check` is empty.
- Initial HTTP test failed EMAIL_NOT_CONFIGURED because its fixture omitted the
  test encryption key; fixed test-only setup, then all messaging tests passed.
- Browser first failed because the script expected OK instead of existing OKAY;
  corrected test without changing established copy. An accepted-view test also
  clicked a panel that its hash navigation was already opening; fixed the test
  to await the deliberate anchor transition instead of toggling it shut.
  The accepted-state assertion was scoped to the ride status, because Profile
  legitimately repeats that same status in its active-ride card.
- Browser: driver/rider at 320, 390, 844 landscape and 1440px; no horizontal
  overflow or uncaught page errors. Starter is editable/not automatically sent;
  drafts survive polling/failure; retries reuse UUID; HTML-looking text stays
  inert; Profile reuses one card and expands the correct thread, including
  same-page/same-hash navigation; read notice clears after visibility; stop
  confirmation can be dismissed and stopping leaves ride intact; accepted view
  preserves stopped state; completion and auth loss remove private content.
- Existing cancellation/error dialogs gained keyboard focus containment,
  idle Escape and focus return. Browser checks focus-safe KEEP IT first,
  Shift+Tab containment, Escape without cancellation and return to the trigger.
- Visual review caught inherited primary/secondary margins making chat buttons
  unequal and verification text wrapping in the UniKey label column. Chat now
  reuses the ride-action button sizing; verification spans the row. Browser
  asserts both chat actions have equal height and at least 44px targets.
- Read-marker review caught a long-message edge case: a whole message taller
  than the scroll area cannot be 100% visible. A one-pixel marker at the latest
  message's bottom now acknowledges only when that edge is visible; the browser
  test includes a 1,000-character message and scrolling to its end.
- Standalone `tsc --noEmit` while dev-generated types were present reported
  existing test type incompatibilities (fetch mocks/ProcessEnv). The production
  Next build, including its TypeScript check, passed. No compiler checks disabled.

Screenshots in `/tmp/messaging-*`: whole pending/accepted ride screens, Profile,
and stop confirmation. Reviewed both roles on mobile/desktop for hierarchy,
ordinary body weight, equal controls, spacing, wrapping and existing map/pickup
priority. No new colour palette or changes to navigation/wordmark.
Lint and production build passed; final rerun/deployment notes below.

## Boundaries

This is not a capacity, penetration-test or delivery-SLA certification. No chat
load benchmark or many-device soak; read-marker persistence is tested in SQLite,
not two physical devices. Real iPhone Safari/Android keyboards, assistive-tech
audit, live provider failures, actual email-client report delivery and genuine
production two-party exchange remain unverified. No background push, moderation
queue, end-to-end encryption or automatic deletion is claimed. Report link
requires a configured mail handler and is not an emergency service.

## Activation

Final release checks: 108/108 regression tests, lint (no warnings), production
build and all eight role/viewport browser scenarios passed. Whole-screen final
screenshots were reviewed after the button/Profile fixes.

API restarted at 03:24 AEDT on 20 October 2026. No active rides at the preflight.
Protected SQLite online backup: `data/backups/pre-messaging-20261020-czzgpj/cocowheels.db`
(directory 0700, file 0600; integrity ok). This remains on-Pi, not disaster recovery.
After restart: 112 rides and 67 requests unchanged; all three new tables present;
quick_check ok and zero foreign-key violations. No production chat was sent.

Initial Node health probe reported fetch failed; service/startup logs showed the
API listening, and subsequent curl checks at 03:25 AEDT returned health 200/ok
and messaging 401 UNIVERSITY_VERIFICATION_REQUIRED both locally and through
`https://www.gumwheel.com`. The first connection failure was transient; its exact
cause was not established. No repeated failure or service crash was observed.

Frontend push follows these checks. It is not a verified Vercel deployment or a
live authenticated two-party messaging test; the user will perform that check.
