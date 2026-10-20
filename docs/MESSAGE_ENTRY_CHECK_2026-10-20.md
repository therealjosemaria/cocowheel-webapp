# Request-to-message discovery — 20 October 2026

Source baseline: `51daf83af0730cbf0924748c51f8c16ae5a69d36`; changes in the commit
containing this report. UI-only: no API restart, schema, retention or auth changes.

## Reproduction and isolation

```sh
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-message-entry.py
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-messaging.py
COCOWHEELS_DB_PATH=/tmp/gumwheel-message-entry-tests-3.db node --import tsx --test tests/*.test.ts
npm run lint
# Stop the local dev server before building.
npm run build
```

Browser scripts require Python Playwright and `/usr/bin/chromium`. API responses
are mocked; external traffic, including map tiles, is blocked. No real requests,
messages, emails or trips were created. Unit/API regression uses temporary SQLite.

## Results

- 109/109 regression tests passed.
- Request entry: six checks passed, chooser/public preview at 320/390/1440px.
  Failed requests stay put; successful requests open the exact conversation;
  starter is editable, zero automatic sends, no scroll jump, edits survive refresh,
  reload returns to the normal collapsed presentation. No horizontal overflow or
  browser JavaScript errors.
- Full messaging regression: eight checks passed, driver/rider at
  320/390/844/1440px, including collapsed defaults, starter editing, retry
  idempotency, unread notices, stop messaging, withdrawal/cancellation controls,
  acceptance and completion. Lint and production build passed.
- Visually reviewed full chooser and public-preview mobile screenshots, desktop
  chooser and mobile/desktop details. Hint is subordinate to the button and headings;
  spacing and existing button sizing preserved. Map tiles are intentionally absent
  in these fixtures. Screenshots reproducible under `/tmp/message-entry-*.png`.

## Failed baselines retained

- Initial broad CSS formatting triggered source-format assertions; removed
  unrelated formatting. Follow-up found hard-coded `400`; replaced with the
  existing regular-weight token. Final regression suite passed all 109.
- Initial full browser run passed 320/390px roles, then timed out at landscape
  when a synthetic refresh landed during an in-flight read. The existing
  single-flight policy coalesces that signal; adjusted the assertion from 5s to
  15s to cover the normal 10s polling cadence. No polling behaviour changed.

Physical iOS/Safari, live two-party messaging and frontend deployment are separate
checks, not inferred from mocked Chromium or git push.
