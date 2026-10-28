# Public search discovery — 29 October 2026

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
- `/`, `/help`, `/about`, `/privacy` and `/terms` opt into indexing and have distinct titles,
  descriptions, canonical URLs and Open Graph/Twitter summaries using the existing
  official square artwork. Root defaults to noindex/nofollow, inherited by
  Activity, private journey/detail, Profile and admin routes.
- Home's email match query is noindex/nofollow, including repeated query values.
  It has no canonical or social metadata containing the private match key.
  Search/post entry queries canonicalize to Home. This changes discovery metadata,
  not sharing permissions or app navigation.
- `/sitemap.xml` contains exactly those five public information URLs, with no
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
