# Mutual ratings verification — 19 October 2026

## Minimal prompt follow-up

Frontend-only change based on `f1566c9`: prompt now contains just the role-specific
heading and five star buttons. Tap/click/Enter/Space submits immediately; no helper
copy or separate submit button. Backend rules are unchanged; no API restart needed.
The original radio/explicit-submit evidence below is historical and superseded.

Retest: 90/90 suite, lint and production build passed. Updated
`scripts/check-ratings.py` passed driver/rider at 320/390/1440px with mocked API:
focus alone sends nothing; tap/Enter submits the chosen score; error modal and
same-star retry work; reload shows acknowledgement; removed copy/button absent;
44px targets and no horizontal overflow. Initial narrow-phone check caught flex
shrinking stars; fixed 44px flex basis and 8px horizontal panel padding, then all
six cases passed. Whole-screen mobile/desktop screenshots reviewed for heading
emphasis, star alignment and reduced spacing. External map tiles remain blocked;
real-device Safari and deployed frontend rendering not verified in this follow-up.

## Production activation follow-up — 21:14 AEDT

With explicit user approval, restarted only `cocowheels-api` to activate
`055670a`. Before restart: no accepted/in-progress rides, one real published
offer and three published samples; ratings table absent. Took a restricted-mode
SQLite backup using the online backup API in `data/backups` and verified
`quick_check = ok`. No record deletion or test trips.

After restart: service active/running, zero automatic restarts; ratings table
present; database quick check passed; the same four offers remain. Local and
`https://www.gumwheel.com/api/health` returned 200/ok. Both local and live-proxy
availability responses returned four offers, all with the new `driverRating`
field. An initial Node fetch probe failed; subsequent curl probes passed and
service logs confirmed startup without a crash. Authenticated production rating
submission was not performed, to avoid manufacturing real reputation data.
Historical pending-deployment notes below describe the pre-activation checks.

Source: ratings commit series on top of `fe0a53d`; no production API restart or
deployment verification. Isolated in-memory/temporary SQLite databases, loopback
HTTP servers, stubbed email sender. No real accounts, email, location or live rides.

## Evidence

- Full suite: **90/90 passed** (including three new grouped ratings regressions).
- Ratings core/HTTP: **3/3 passed**. Validated score type/range, participant access,
  verified-login requirement, invalid origin, forged recipient fields, incomplete,
  cancelled, expired, sample and unconfirmed-pickup rejection. Checked immutable
  scores, idempotent simultaneous HTTP retries, same-account second-device retry,
  database row count, caller-only submission state and no raw score in responses.
- Threshold/release: nine ratings remain hidden; ten received/released yield
  average/count; role separation; one-sided release at seven days; mutual release
  before deadline; exact deadline rejection. Additive schema reinitialization
  preserves records. Historical completed fixtures use real lifecycle functions.
- Lint and production build passed. An earlier broad `tsc --noEmit` invocation
  reported existing test-file type errors (load harness ProcessEnv and mocked fetch
  types); no new rating-file errors remained. Next production typecheck passed.
- Chromium browser regression: both roles at **320, 390 and 1440px**. Five 44px
  radio targets, selection/submit gating, shared error modal, preserved selection
  and successful retry, reload acknowledgement, no horizontal overflow. Profile
  shows eligible average and hides the other role's below-threshold count.
- Visual review: complete driver/rider ride screens and profile on phone/desktop;
  section heading versus regular explanatory copy, monochrome stars, spacing,
  existing buttons and matrix. Map tiles deliberately blocked; these are mocked
  route screenshots, not a map/provider verification. Chooser/request badge code
  shares the same summary component; full chooser/request-screen visual checks
  remain unverified in this campaign.

## Findings retained

1. Initial browser check found the form inside the historical read-only guard;
   moved it outside so completed rides can be rated. Six viewport/role retests pass.
2. Star label border reduced the input hit area to 42px; removed that border and
   verified 44px controls on all six cases.
3. Profile at 320px extended beyond the left viewport; constrained panel width to
   account for the adjacent menu button. Browser bounds assertion added.
4. First full suite: 89/90, due solely to formatting changing a whitespace-sensitive
   visual-system regex. Restored unrelated stylesheet formatting; 90/90 retest.
5. Early HTTP fixture lacked a test encryption key and then hit login-code resend
   cooldown. Corrected fixtures (test-only key and clock advance); 3/3 pass. No
   weakening of production authentication/rate limits.
6. Restricted-sandbox build/test workers could not run normally. Isolated checks
   were rerun with approved local process permissions; production build passed.

## Reproduce

```sh
task_rating_test_dir=$(mktemp -d /tmp/gumwheel-ratings-suite-XXXXXX)
COCOWHEELS_DB_PATH="$task_rating_test_dir/default.sqlite" npm test
npm run lint
npm run build
```

Browser (Python Playwright with system Chromium required):

```sh
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
# In another terminal, using a Python environment with Playwright installed:
python scripts/check-ratings.py
```

Screenshots use `/tmp/gumwheel-rating-*.png`; no screenshots contain live data.
Browser/API tests are separate: mocked browser coverage plus real isolated HTTP/
database tests, not a single live browser-to-production test. Mobile Safari/real
touch keyboards, screen-reader audit, new aggregate-query capacity and production
activation remain unverified. No claim of guaranteed anonymity or failure-proofing.
