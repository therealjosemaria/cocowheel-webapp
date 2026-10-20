# Rider request accordions and detail grids — 20 October 2026

Baseline: `34a416f`. Frontend-only refinement; no API, authorization, status,
payment visibility, history or service changes. No server restart required.

## Behaviour

- Pending driver requests appear in a labelled section with a native `details`
  disclosure per request. Each begins collapsed and shows icon/UniKey and status.
  Independent stable request keys preserve browser disclosure state on polling;
  no exclusive group forces another card closed. Keyboard Enter/Space works through
  native summary semantics and a visible focus outline.
- All original cells and buttons remain. Within requests: Rider/Where from in row
  one, Requested/Where to in row two, then full-width Request status and Action.
  The existing nested messaging UI remains unchanged. No new support link inside it.
- Main ride details retain addresses on the right. Driver Fare/Your PayID share a
  row; Action spans both columns at the bottom. Missing-payment lone Fare spans
  both columns. Long PayIDs wrap; cells align content at the top so taller adjacent
  values do not create artificial gaps between labels and values. Rider payment
  and Copy visibility are unchanged; paired drivers retain Complete and Cancel.
- Support stays last and unchanged. New request updates never auto-scroll or open
  cards. Explicit notification navigation opens the target's enclosing disclosure.
  Closed request identity cells are not acknowledged as read through their summary.
  Message notifications similarly reveal the enclosing request before opening chat.

## Reproducible checks and boundaries

```sh
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-ride-updates.py
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-messaging.py
node --import tsx --test tests/ride-updates.test.ts tests/visual-system.test.ts tests/support.test.ts
npm run lint
# Stop the isolated frontend before building.
npm run build
```

Fixtures use local Chromium, mocked APIs and blocked external destinations; no
real rides, messages, GPS or provider requests. The notification suite covers
320/390/1440px in both roles; chat adds 844px. Checks include initial collapse,
individual notice expansion, Profile anchors, independent open states, keyboard
toggle, polling persistence, long PayID wrapping, full-width action, right-column
address order, route toggle without scrolling, and unread-chat navigation.

Initial notification runs failed the same-page Profile anchor assertion: Next.js
navigation to hidden request content did not reliably trigger the hash/DOM rescan.
Tracking target identity alone did not resolve it. The shared ActiveRideLink now
reveals existing ancestor disclosures on explicit ordinary click before Next.js
anchor scrolling. Initial/cross-page hash handling and message events retain
their own reveal paths. The subsequent six-case notification run passed.

Final evidence: all six notification/layout cases and all eight messaging cases
passed, including the additional keyboard and post-response persistence checks.
All 111 regression tests passed with
`COCOWHEELS_DB_PATH=/tmp/gumwheel-accordion-regression.db node --import tsx --test tests/*.test.ts`.
Lint and the ten targeted notification/visual/support tests passed. Whole-screen
review covered collapsed and expanded driver requests at 320/390/1440px and rider
details at 390/1440px: restrained summary hierarchy, attached section heading,
wrapped PayID, stacked right-column addresses and unchanged separate support/chat.
React checklist review verified stable keyed native disclosures, listener cleanup,
explicit-navigation-only expansion, unchanged authorization and no new polling.
Production build/TypeScript and `git diff --check` passed.

Physical Safari/VoiceOver, real WhatsApp handoff and deployed frontend are outside
these local checks. No claim of production deployment follows merely from push.
