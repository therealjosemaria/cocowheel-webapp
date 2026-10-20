# Legend and messaging layout — 20 October 2026

Baseline: `55a1e70`; implementation is the commit containing this report.
UI-only: one Report a concern below ride details/actions, none inside chat;
12px top separation for details; compact Updated copy, minutes as min; route
labels do not split, swatches do not shrink. Below 600px update age has its own
row. Other sizes use wrapping whole legend items. Caption tokens unchanged.
No GPS freshness, polling, auth, message storage or API behaviour changed.

## Reproduce

```sh
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-message-entry.py
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-messaging.py
COCOWHEELS_DB_PATH=/tmp/gumwheel-legend-tests.db node --import tsx --test tests/*.test.ts
npm run lint
# Stop dev server before production build.
npm run build
```

Browser checks use Python Playwright with `/usr/bin/chromium`, mocked APIs and
blocked external traffic (including map tiles). No production trips/messages or
database mutations. Entry fixture uses a 57-minute-old driver location and
320/393/1440px widths, including iPhone 14 Pro CSS width. Assertions cover one
report link outside chat, 12px separation, unbroken labels, no overflow and
unchanged request-to-editable-message flow. Full messaging checks cover both
roles at 320/390/844/1440px, pending/accepted/completed, read/stop/send controls.

109/109 regression tests, all six entry/layout checks, eight role/viewport messaging
checks, lint and production build passed. Visually reviewed
the full 393px chooser and rider details, 1440px rider details and 390px driver
request/chat screen. Update ages and route labels remain readable, typography
does not compete with actions, the new gap separates the legend from details,
and one report link stays outside chat. Screenshots are reproducible under
`/tmp/message-entry-*.png` and `/tmp/messaging-*.png` (tiles deliberately blocked).
Physical Safari/iPhone and production rollout remain separate from mocked
Chromium and a successful push.
