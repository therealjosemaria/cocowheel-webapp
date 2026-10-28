# Public search discovery — 29 October 2026

Baseline: bc616eb. Home's single visible heading is “Share your journey.” This
supersedes “Going your way.” No subtitle or additional homepage copy is added.
The two existing journey buttons, icons and shared hero typography remain.

## Implemented search behaviour

- Canonical origin is https://www.gumwheel.com, matching the observed redirect
  from gumwheel.com. Public metadata describes Sydney carpooling without making
  registration university-only or promising available drivers.
- `/`, `/help`, `/privacy` and `/terms` opt into indexing and have distinct titles,
  descriptions, canonical URLs and Open Graph/Twitter summaries using the existing
  official square artwork. Root defaults to noindex/nofollow, inherited by
  Activity, private journey/detail, Profile and admin routes.
- Home's email match query is noindex/nofollow, including repeated query values.
  It has no canonical or social metadata containing the private match key.
  Search/post entry queries canonicalize to Home. This changes discovery metadata,
  not sharing permissions or app navigation.
- `/sitemap.xml` contains exactly those four public information URLs, with no
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
