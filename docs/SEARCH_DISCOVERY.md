# Public search discovery — 29 October 2026

## Homepage soft 404 — 29 October 2026

Source baseline 0cff610 (pre-fix production build 1083dd3 has identical Home code).
The owner's 12:37 AEDT Search Console live inspection fetched Home successfully,
with crawl/index allowed and its canonical present, but classified it soft 404.
The supplied rendered HTML contains the ride-refresh error above the hero. This
supersedes treating the homepage problem as waiting for indexing; the separate
sitemap fetch report still needs its own processing verification.

Home previously fetched `/api/current` on mount before establishing identity. Its
non-authentication failure path renders a ride-refresh error even for a visitor
with no ride. An isolated signed-out session 401 / current 500 fixture reproduced
that exact message against the pre-fix build. Home now first checks
`/api/university/session`, matching navigation. Any failed identity check clears
its current-summary state and stops that Home request chain; it does not invent a
personal ride error. Successful identity checks continue to fetch current rides;
authenticated current-load errors remain visible. Shared transport reachability
notices remain, so an actual server outage is still reported. Existing navigation
refreshes/sign-out synchronization and active-ride polling are unchanged. This
is UI/session-read ordering, not a change to server authorization, sessions, GPS,
retention or API responses. There is one additional session GET on Home mount;
it uses the existing bounded 15-second transport with no new retries or timers.
No crawler user-agent special cases, hidden SEO copy or new Home text were added.

Passive unauthenticated live reads during diagnosis returned 401 from both
session (`UNIVERSITY_VERIFICATION_REQUIRED`) and current (`GUEST_SESSION_REQUIRED`).
Those expected responses do not reproduce the original Google failure; the
injected failure establishes the erroneous UI path, not its production cause.
Google's exact reason is not exposed, so clearing the rendered error is a targeted
remediation, not proof that Google has withdrawn the soft-404 classification.
[Google's soft-404 troubleshooting](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors)
identifies prominent rendered errors and missing resources as possible causes.

Reproduce with `npm run build`, then
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-home-entry.py`.
The script uses only synthetic API replies and a closed localhost server API
target; external calls are blocked. It covers signed-out identity, failed identity,
signed-in driver/rider restored journey/sign-out clearing, and signed-in
current-read failure
at 390/1440px. The pre-fix run failed because the unwanted error appeared once;
retain that baseline in `results/home-entry-2026-10-29.json`. All ten cases passed
after the fix; 217 unit tests, lint and production build
passed. The existing discovery suite also passed at 320/390/844/1440px, including
private noindex and JavaScript-disabled navigation. Whole Home screenshots at
390/1440px were visually reviewed for signed-out, driver/rider summaries and
signed-in failure states: existing typography, icon emphasis, CTA spacing and
error styling retained, no overflow. No API restart is required. Production
activation is recorded below; Google’s new live-test classification remains
unverified until the owner repeats the homepage live test.

### Home fix deployment verification

29 October, 12:46 AEDT: Vercel reported production deployment
`dpl_H1MTCVAkP4A1ieFhaupQfSDLGLm7` READY for 20f9d41 with the www.gumwheel.com
alias assigned. Browser checks of that public HTML/JavaScript at 390/1440px,
with session 401/current 500 replies injected locally, returned HTTP 200, retained
index/follow metadata and showed no ride-refresh message or uncaught browser
errors. Both screenshots were captured; mobile was also visually rechecked.
External/analytics traffic was blocked and browser APIs were synthetic, so this
does not certify live authenticated API availability. See
`results/home-entry-live-2026-10-29.json`. No API restart or IndexNow resubmission
was performed. Google must repeat the homepage live inspection to determine
whether the soft-404 classification is cleared; sitemap processing is separate.

## Further discovery work (source baseline 2c32b48)

Added one substantive Sydney carpooling guide at `/carpooling/sydney`, linked from
About, the sitemap and public text guides. It describes actual rider/driver flows,
contributions and pilot availability without claiming supply or creating suburb
pages. It uses existing Help styles. Unknown URLs retain HTTP 404 and show Home /
How it works recovery links. Home's interactive headline/actions are unchanged.

The six public HTML paths are the sole IndexNow submission allowlist. Run
`npm run search:submit` for a local dry run (no network), or explicitly use
`npm run search:submit -- --submit`. Before one POST, the tool checks the deployed
public ownership file and each page's HTTP 200, HTML type and robots directives.
Requests reject redirects and time out after 15 seconds each. Any failed preflight
sends nothing; failed POSTs are not retried automatically. HTTP 200 means received;
202 means received with ownership validation pending. Neither proves indexing.
No scheduled submission or browser call is installed. IndexNow is for participating
engines, not a claim of Google submission.

`public/indexnow-key.txt` is intentionally public ownership proof, not a login/API
credential; the root custom keyLocation covers all listed paths. Its response uses
X-Robots-Tag: noindex, nofollow; no custom cache TTL is configured. Optional
`GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` frontend variables emit public
ownership metadata only. Values are trimmed and constrained to token characters;
invalid tag/URL input fails the build without echoing its value. Neither is set by
this change. The owner confirmed neither webmaster account is configured. Connected
plugin discovery found reporting integrations, but no demonstrated initial
property verification capability. Follow [SEARCH_SETUP.md](SEARCH_SETUP.md).

Protocol references: [IndexNow documentation](https://www.indexnow.org/documentation),
[IndexNow FAQ](https://www.indexnow.org/faq),
[Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

Validation: `npm test` passed all 217 tests; `npm run lint` and `npm run build`
passed. Run `/tmp/gumwheel-pickup-check-env/bin/python scripts/check-search-discovery.py`
after the production build. The extended check passed at 320/390/844/1440px:
six-page metadata/sitemap, private noindex, proof header, HTTP 404 recovery,
Home actions, Help/About/guide navigation and both guide-to-role entry links.
JavaScript-disabled Home/About navigation passed. Browser APIs were synthetic,
server API traffic targeted a closed localhost port, and external requests were
blocked: no live trips, mail or analytics writes. Whole Guide/About/404 screenshots
were visually reviewed at 390/1440px for typography, emphasis, spacing and overflow;
automated layout checks covered the other widths. Physical Safari remains untested.
An initial browser launch occurred before the build finished and could not start;
rerunning after build completion passed. The IndexNow dry run listed only six
public URLs and submitted nothing. React review found no new client state,
effects, dependencies or data-fetching waterfalls. Live deployment/submission
results are recorded below.
Earlier dated evidence describes the then-current five-page sitemap.

### Live verification and search submission

29 October 2026, 10:36 AEDT: Vercel reported production deployment
`dpl_2uL7grHzrTYYFDR1mfkcpFDXtJrt` READY for commit 1083dd3. Passive checks on
www.gumwheel.com confirmed the Sydney guide's HTTP 200, canonical and index/follow
metadata, About/llms links, six sitemap entries, exact ownership proof with its
noindex/nofollow header, and new recovery text with HTTP 404. The initial check
before deployment readiness had still served the older five-page output; no
submission was attempted then. See `results/search-live-2026-10-29.json`.

One explicit IndexNow batch was sent at 10:36 AEDT after all seven preflight GETs
passed. The service returned HTTP 202: received, ownership validation pending.
`results/indexnow-2026-10-29.json` records the sanitized receipt without the public
key. This is not a Google submission or confirmation of indexing/rankings. No
retry, schedule, private URLs or authenticated application writes were used.
No API restart was needed. Production runtime logs and actual search-engine
indexing/dashboard intake were not inspected; Google/Bing ownership remains unset.

## Public information refinement — 29 October 2026

Baseline b2c2c78. Supersedes the earlier four-page sitemap: `/about` is the fifth
public HTML page. It uses existing Activity/Help panels, headings, regular body
copy and contact-link styling. Help links to About within its first FAQ; About
links back to Help. Home keeps its single visible headline and two actions when
JavaScript is enabled. A native noscript fallback explains the product and links
to static Help/About for people whose browser cannot run the interactive app.
This is not a hidden block intended only for search engines.

Help now has seven native, initially closed FAQs. New answers explain the product,
rider-posted requests, route email opt-in and open email eligibility. The four
steps for each role remain. Obsolete planned QR-payment copy is removed; actual
PayID behaviour is retained. Shared `lib/public-information.ts` supplies visible
steps/answers and the read-only guide outputs. Contact remains jose@gumwheel.com;
this does not change any login identity, sender, delivery setting or permission.

Home includes WebSite/Organization JSON-LD with the real brand, public website,
logo and public support contact. It does not invent ratings, registered addresses,
social profiles or a booking/search API. No identity markup is added to matching
entries. The root also declares the application name. This describes site identity;
it does not establish eligibility for rich results or guarantee Google’s choice.

`/llms.txt` is an optional plain-text product/when-to-use guide. `/help.md` serves
the same public Help content as Markdown and is linked as an alternate format in
Help’s HTML metadata. Both are static frontend routes with no account access,
provider calls, cookies or private inventory. They request a one-hour public cache
TTL and carry X-Robots-Tag: noindex, follow; Markdown also has an HTTP canonical
link to `/help`. They are not listed as separate search pages in the sitemap.
There is no new content-negotiation middleware, account API or bot permission.

The existing analytics allowlist adds `/about` following review of its static
public content. Queries/fragments are still stripped; text guides do not mount
the analytics SDK. See WEB_ANALYTICS.md.

### Evidence and boundaries

[Is Agentic baseline](https://is-agentic.com/scan/www.gumwheel.com): 58/100 at
2026-10-28T23:01:58.834Z, captured before these refinements. Reproducible command
and sanitized report are retained in `docs/results/agent-discovery-2026-10-29.json`.
It found sparse Home text, absent JSON-LD and weak brand discovery, among other
checks. Its Markdown-negotiation and content-length thresholds are that tool’s
criteria, not Google requirements. We did not add a postal address or public
booking API to satisfy the score. Reports can stay cached for six hours; no
higher post-change score is claimed without a later scanned_at timestamp.

Google’s [AI features guidance](https://developers.google.com/search/docs/appearance/ai-features)
says ordinary crawlable, useful content remains the foundation; special AI files
are not required. The plain-text files serve direct readers/assistants rather
than guaranteeing discovery or recommendations. [Site-name guidance](https://developers.google.com/search/docs/appearance/site-names)
supports WebSite identity markup. Search Console ownership, URL inspection and
sitemap submission still need the owner’s account; this task has no connected
Search Console or Bing Webmaster Tools access. No submission is claimed.

Validation: 209/209 isolated tests, lint and the production build pass. The
extended `scripts/check-search-discovery.py` passes at 320/390/844/1440px, checking
Home’s two actions, collapsed/expanded Help, Help-to-About navigation, the exact
public contact, sitemap, real built JSON-LD and text-route headers/content.
The JavaScript-disabled context renders the native fallback and follows its
About link. All browser APIs are synthetic and external providers are blocked;
there were no live email, trip, payment or analytics writes. Whole Home/Help/About
screens and the no-JavaScript page were visually reviewed for fonts, regular body
weight, section gaps, icon prominence and wrapping; no overflow or page exceptions.

Two original tests inspected literal JSX for mailto links and list items, so they
failed after public copy moved into shared data. They now check rendered HTML,
confirming the unchanged contact addresses, suggestion subject and four steps.
The first no-JavaScript text matcher skipped native noscript descendants despite
the fallback being visible in screenshots; direct DOM visibility/text assertions
and a real link click passed. No app workaround was needed for that harness issue.
The 58/100 external audit remains the dated baseline; no newer score is claimed.
Physical-device Safari and search-provider rendering remain unverified.

### Production verification of the refinement

29 October 2026 at 10:15 AEDT: passive public HTTP checks confirmed a882577’s
Home WebSite/Organization JSON-LD, Help’s Markdown alternate link, public About
content, and a five-URL sitemap. `/llms.txt` and `/help.md` returned 200 with the
expected text MIME types and noindex/follow headers; Markdown retained its HTTP
canonical to Help. Observed Cache-Control: `/help.md` → `public, max-age=3600`, `/llms.txt` → `public, max-age=3600`.
The first check still served the old build; one follow-up confirmed the new
output. This verifies deployment responses, not Google indexing, assistant
recommendations or a new external audit score. No backend restart was required.

## Previous implementation and deployment

Baseline: bc616eb. Home's single visible heading is “Share your journey.” This
supersedes “Going your way.” No subtitle or additional homepage copy is added.
The two existing journey buttons, icons and shared hero typography remain.

## Implemented search behaviour

- Canonical origin is https://www.gumwheel.com, matching the observed redirect
  from gumwheel.com. Public metadata describes Sydney carpooling without making
  registration university-only or promising available drivers.
- `/`, `/help`, `/about`, `/carpooling/sydney`, `/privacy` and `/terms` opt into indexing and have distinct titles,
  descriptions, canonical URLs and Open Graph/Twitter summaries using the existing
  official square artwork. Root defaults to noindex/nofollow, inherited by
  Activity, private journey/detail, Profile and admin routes.
- Home's email match query is noindex/nofollow, including repeated query values.
  It has no canonical or social metadata containing the private match key.
  Search/post entry queries canonicalize to Home. This changes discovery metadata,
  not sharing permissions or app navigation.
- `/sitemap.xml` contains exactly those six public information URLs, with no
  accounts, route endpoints, user posts, dynamic journey IDs or email match links.
  No fabricated last-modified dates, inventory, reviews or ratings are advertised.
- `/robots.txt` allows crawling public pages, disallows `/api/`, and advertises
  the sitemap. Private pages rely on noindex metadata and existing authorization;
  robots is not access control. New public pages must explicitly opt in and be
  added to the sitemap after review. These are Next static metadata routes, so
  their app output changes on a frontend deployment; no API restart is needed.

The 29 October pre-change live audit found Home's generic title/description,
no canonical, and a missing sitemap (404). Live robots returned provider content
signal comments without a sitemap. One default Python-user-agent request received
403 while a browser-user-agent retry succeeded. That does not establish Googlebot
access or an intentional provider rule. App-generated output must be checked
again after deployment: upstream bot controls can override the frontend response.
No Cloudflare/provider settings or credentials were changed.

## Remaining owner/deployment checks

- Home, Help, sitemap and robots production responses were verified below;
  inspect remaining pages through Search Console as part of ownership setup.
- Verify ownership in Google Search Console, inspect Home and Help with URL
  Inspection, and submit the sitemap. No Search Console connection or ownership
  verification was available in this task; no submission is claimed.
- Optionally submit the same public sitemap through Bing Webmaster Tools.
- Check crawler access using verified search-provider tools before changing bot
  controls. Search indexing, rankings, rich results and AI recommendations are
  not guaranteed by metadata or sitemap publication.

Google sources: [SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide),
[JavaScript rendering](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics),
[Search Console](https://support.google.com/webmasters/answer/10267942?hl=en).

## Verification

Use `npm test`, `npm run lint`, `npm run build`, then the isolated Chromium check
in `scripts/check-search-discovery.py`. Unit checks cover the strict public URL
allowlist, canonical/share URLs and suppression of private matching keys.
Browser checks inspect server HTML and rendered metadata, both journey buttons,
private page noindex, the actual robots/sitemap responses, and full Home at
320/390/844/1440px. Only synthetic browser API responses are used; no live trips,
emails or external map providers are contacted.

206/206 tests, lint and production build pass. The browser check passes at all
four widths with no overflow or browser page exceptions. Whole Home screenshots
were reviewed at 320/390/1440px: the headline wraps to two lines on phones and one
on desktop, retaining the existing centred actions, spacing and visual emphasis.
Both journey actions open the expected forms. The first canonical assertion
expected a trailing slash on Home; Next normalizes that canonical to the bare
origin, so the harness now compares equivalent root URLs. Application code did
not need a correction. Physical-device Safari and search-provider rendering are
unverified; source inspection/local testing is not a production deployment claim.

## Production observation

29 October 2026 at 09:49 AEDT: the public frontend served “Share your journey.”,
Home's Sydney Carpooling title/canonical and Help's distinct title/canonical.
`/sitemap.xml` returned 200 with four public URLs, and `/robots.txt` returned 200
including the new sitemap directive. Upstream comments did not suppress the
app-generated crawler rules. The first post-push check still served the previous
version; one follow-up after deployment returned the new output. These are passive
public HTTP checks of 0d5f6ad's behaviour, not Googlebot access or an indexing/ranking
verification. Search Console/Bing submission and private production browser
walkthroughs remain unverified. No API restart or live trip mutations.
