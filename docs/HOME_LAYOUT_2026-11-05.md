# Home layout — 5 November 2026

The owner approved a 200px presence map (formerly 160px) and asked for personal
activity below it. Home already rendered activity after the map, but both were
inside role-choice, whose vertical centring changed the upper content position
as cards appeared. Personal cards now occupy a separate Your journeys section
after role-choice. The hero, Find/Post buttons and map retain their centred group
independent of those cards. The section has an accessible name without adding a
visible heading. It is absent when no current items exist.

Existing ActiveRideLink, driver/rider text, destinations, updates and card styles
remain. Desktop cards retain their 360px cap, mobile cards remain full-width;
shared 12px grouping and 24px bottom padding are reused. The existing min-height
centring is retained for the primary group, but its negative 3vh transform is
removed and 48px top/24px bottom padding keeps the hero clear of the header on small
phones and landscape screens. Activity scrolls in ordinary document flow, with
no overlay, absolute positioning, new action or duplicated destination.

The map remains hidden when public presence is empty or unavailable; personal
activity remains visible in that case. Shared bottom-left credits, colour tiles,
marker caps, noninteractive behavior, polling and privacy are unchanged. No new
API, authorization, lifecycle or restart.

Verification: build/lint and browser results are recorded after completion.
scripts/check-home-activity-layout.py uses synthetic APIs/current-updated events
at 320x740,390x844,844x390 and 1440x900. It asserts 200px height, header clearance,
unchanged hero/button/map Y positions across no activity, driver, rider and two
synthetic cards, cards below the map, no horizontal overflow/errors or writes,
and hidden empty map with a personal card still present. Two cards test defensive
rendering only; they do not authorize conflicting real journeys.


Build and lint pass. Final activity-layout checks pass all four sizes, including
at least40px header clearance, unchanged upper Y positions and no errors/writes.
check-home-presence.py and check-home-order.py also pass all four widths after
the final spacing correction. Whole 320/390px phone and1440px desktop screens
were visually reviewed for heading clearance, action hierarchy, taller map,
wrapped driver/rider cards, credits and ordinary page scrolling. Initial captures
revealed the legacy upward transform crowded the header;48px top padding and
removal of that transform corrected it, with a new header-clearance assertion.
Mocks include long address text and multiple cards. No real accounts/trips,
provider routes, GPS captures or email writes. Read-only public OSM tiles only.
Physical Safari and authenticated production activity remain unverified.
Production deployment is recorded below after verification.


Production implementation 88b25e20004923aa67651c244a965708f7dfca3a was pushed.
Vercel dpl_2SYRi9To1vUHTYoT8AKwQFwQ5tTy is READY for that exact source and
aliased to www.gumwheel.com. The same four-size activity-layout suite passes on
the deployed frontend with synthetic APIs, including stable upper positions and
header clearance. Fresh live phone rendering was visually inspected. During
rollout an initial live check still saw the previous160px map/negative transform
and only12px header gap; the READY build now has200px and48px top padding.
The owner's final clarification is the maintained hierarchy: heading above,
Find/Post in the middle, map below in one centred primary group; optional
activity is a fourth section outside that group, continuing down the scrolling
page. No extra hero copy or visible activity heading was introduced.
No real user data or journey writes were used; physical devices remain untested.
