# Five-rating threshold and safety FAQ — 30 October 2026

Source baseline: 0f6af13. This supersedes the original ten-rating display threshold
in the 19 October report, without rewriting that historical evidence.

## Changes

Help has nine initially closed native FAQs. The second question is “How does
GUMWHEEL help keep riders and drivers safe?” It describes existing features for
both roles and explicitly limits email verification, background checks and
emergency help. The shared Markdown Help output uses the same answer.

Public averages and counts are returned at five released received ratings per
role. Four remain hidden. Mutual release, the seven-day release/rating window,
completed/pickup-confirmed eligibility, ownership, immutable submission and
separate driver/rider aggregates retain their existing rules. Existing stored
ratings count under the new threshold on API restart; no migration is needed.
The compact shared badge already includes average and count, with an accessible
label spelling out both. Privacy now states the five-rating rule.

## Checks

Reproduce with `npx tsx --test tests/ratings.test.ts`, `npm test`,
`npm run lint`, and `npm run build`. The threshold test exercises four versus five,
unreleased versus released, both roles and the seven-day boundary with in-memory
SQLite. The HTTP regression covers verified ownership and retry semantics.

After building, start an isolated preview:
`COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npm run start -- --hostname 127.0.0.1 --port 3090`.
Use Python with Playwright and system Chromium to run `scripts/check-ratings.py`
(driver/rider, 320/390/1440px) and `scripts/check-search-discovery.py`
(320/390/844/1440px; this starts its own isolated preview).
All browser account, journey and rating responses are synthetic; external
requests are blocked. No real ratings, emails, journeys or accounts are created.

Results: all three grouped rating regressions and all 229 full-suite tests pass;
lint and the production build pass. Six driver/rider browser cases pass, including
five-rating average/count labels, below-threshold fallback, error/retry and reload.
Discovery and the second safety FAQ pass at all four widths; Privacy’s five-rating
copy passes at 390/1440px. Whole Help/Privacy screens and driver/rider Profile and
completed-journey views were visually reviewed for wrapping, heading/body weight,
spacing, badge prominence and containment. No new styling was needed.

The first rating screenshots showed broken avatars because an old mock returned
JSON for photo requests. A synthetic SVG response fixes the browser fixture;
no production photo behaviour was changed. The suite was rerun for final review.
External map tiles remain blocked deliberately.

API/frontend activation is recorded below when verified.
Physical Safari/mobile devices and authenticated production rating submission
remain outside these checks. A push alone does not activate the API threshold.
