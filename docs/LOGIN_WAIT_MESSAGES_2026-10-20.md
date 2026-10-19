# Login wait wording — 20 October 2026

The sending-wait alert presentation below is superseded by the later
[local button countdown](CODE_COOLDOWN_2026-10-20.md). Server metadata and limits
remain unchanged; the older results are preserved as historical evidence.

Source baseline: `261072d`, with this message-only policy-preserving change.
Previously every verification rate limit said “15 minutes”, including the
60-second resend cooldown. Server now reports the rejecting bucket's remaining
seconds (ceiling), retains error code/HTTP 429 and adds `Retry-After`. Dialog copy
uses seconds below 60, otherwise rounded-up minutes; no countdown or automatic
retry. All limits, ordering, transactions, OTP validity and invalidation stay intact.

## Checks

- Full isolated regression suite: 98/98 passed before adding the HTTP assertion.
- `npx tsx --test tests/verification-message.test.ts`: 3/3 including real local
  HTTP, confirming a cookie-free second request still gets the UniKey cooldown,
  and JSON/header agree. No provider email calls (injected sender).
- Boundaries: 5-second retry → 55 seconds; 59.999-second retry → 1 second;
  60-second retry succeeds; fourth send reports 780 seconds remaining;
  15-minute reset succeeds; exhausted global bucket reports remaining hour window.
- Shared transport preserves valid retry metadata and rejects malformed metadata.
  Formatter tests cover pluralisation, minute rounding and older-API fallback.
- Lint and production build passed.
- `python scripts/check-login-wait.py` (Playwright/system Chromium, isolated Next
  on :3090) passed at 390px and 1440px with mocked APIs. Visually reviewed existing
  dialog layout, hierarchy, spacing and 55-second / 13-minute / fallback wording.
  Initial ad-hoc test fired the dialog event before hydration and timed out;
  committed harness uses the actual Profile → Verify UniKey controls and passes.

No real email delivery, actual mobile Safari or reproduction of the reported
incident was attempted. This fixes misleading wording, not delivery latency.

## Activation

Read-only preflight: service active, no rides in any active status. Dedicated API
restarted at 00:28:14 AEDT on 20 October 2026. First health call raced startup;
follow-up local/proxied health results are recorded below. No schema/config or
rate-limit changes, no real email sent and no ride mutations used for testing.
Follow-up local `/api/health` and `https://www.gumwheel.com/api/health` both
returned `{"status":"ok"}`. Production 429 was not deliberately triggered.
Frontend deployment remains distinct from the backend restart.
