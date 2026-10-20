# Profile action layout — 21 October 2026

Baseline: `b1ab094`. The usual-route link was an inline anchor with secondary
button padding. Inline vertical padding painted over the preceding rider's
“Not enough ratings yet” text; width/min-height did not form a button box.
The previous usual-route review missed the entry popover. This is a UI defect,
not a ratings-data or API problem.

Fix: group My usual route and Sign out in a 12px-gap grid, separated from the
preceding content by 12px. Both retain shared secondary sizing, border, radius,
colour and typography; explicit flex boxes centre their text. Local margin
reset avoids adding generic secondary margins to the grid spacing.
Signed-out verification, ratings, current-ride controls, mobile menu and backend
behaviour are unchanged. A separate My profile page/photo remains a proposal;
the link still truthfully names its existing usual-route destination.

Reproduce with an isolated frontend and mocked APIs:

```sh
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-profile-layout.py
npm run lint
node --import tsx --test tests/visual-system.test.ts
```

The browser script requires Playwright and system Chromium. It blocks external
requests and checks 320/390/844/1440px, both missing ratings and a driver average
with a missing rider rating, using a long approved email identity. Assertions
cover non-overlap, 12px spacing, equal action dimensions/computed styles, minimum
touch targets, viewport containment and keyboard navigation to the saved route.
Screenshots: `/tmp/profile-layout-WIDTH-RATED.png`.

Results: all eight responsive cases passed; ESLint, the visual-system
regression and production build passed. Visually reviewed the 390px missing-rating and 1440px mixed
rating screenshots: the rider helper remains clear above the controls, equal
action boxes and spacing, unchanged restrained text hierarchy and no clipping.

No production data, emails, account mutations or API restart. Physical Safari
and deployment are separate from the mocked browser checks.
