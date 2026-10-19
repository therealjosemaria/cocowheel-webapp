# Mutual ratings verification — 19 October 2026

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
