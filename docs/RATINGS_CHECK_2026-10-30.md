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

## API activation

Implementation commit 351cc87 was pushed to main. Under the standing conditional
restart authorization, zero accepted/active trips were confirmed before backup
and immediately before restarting only cocowheels-api at 16:56:20 AEDT on
30 October. The consistent private SQLite backup passed integrity/FK checks.
Post-restart integrity is ok, FK errors zero, service active, local/public health
checks return 200. All 135 rides, 79 join requests, 11 rider posts, six rating
records and seven accounts were preserved. No schema or configuration changed.
No real rating was submitted and no live trip was used as a test.

## Frontend verification

Vercel production deployment dpl_4HDQ7za44JMTaS59urNFdCv7Fvkv is READY
for commit 351cc87518f2fb19dc97cfe6d1f7e81756fe2558, aliased to
www.gumwheel.com. Public HTTP reads returned 200 and confirmed nine FAQs with
safety second, the same question in /help.md, and the five-rating privacy wording.
Physical device and authenticated live rating-submission checks remain unverified.

## Emergency guidance follow-up

Source baseline 14fa9b1. Help’s second safety answer, its shared Markdown output
and Terms now give the same Australian emergency instructions: call Triple Zero
(000) for police/fire/ambulance, give location, stay on the line, follow the
operator’s instructions and do not wait for a GUMWHEEL reply. This is informational
copy; no emergency-response service, monitored reporting or new call control is
introduced. Terms revision is 30 October 2026.

Source checked on 30 October: [Australian Government Triple Zero guidance](https://www.triplezero.gov.au/Documents/Poster%20-%20Triple%20Zero%20-%20ENGLISH.PDF).
Lint and production build pass. Four-width discovery/FAQ browser checks pass,
including the emergency number and not-waiting instruction. Separate Terms checks
pass at 390/1440px, with the same guidance verified in Markdown Help. Whole Help
and Terms screens were visually reviewed on phone and desktop: existing regular
body weight, heading hierarchy, spacing and page width retained. All browser APIs
were synthetic, third-party requests blocked; no call or real journey action was
made. No backend change or API restart is required. Deployment recorded below.
Physical devices and actual emergency calling are not tested.

Emergency-copy deployment: b552d65dadae65e4eb5501153ccd9bb6413e67d8 is
READY in production (dpl_5DurJSFgCdN3hDBc2bAfLnC3iJF8), aliased to
www.gumwheel.com. Live Help and Terms returned 200 and both contained the
Triple Zero and not-waiting instructions. No API restart performed.
