# Search engine owner setup

29 October 2026: the owner confirmed neither Search Console nor Bing Webmaster
Tools is configured. Code support is implemented; account ownership and indexing
are not verified. No credentials or provider tokens were added by this change.

## Google

1. Sign into [Search Console](https://search.google.com/search-console/).
2. Add a **Domain** property for `gumwheel.com`. Follow its DNS TXT verification
   instructions at the domain's actual DNS provider. This covers subdomains and
   protocols; retain the record after verification.
3. Alternatively add the URL-prefix property `https://www.gumwheel.com/` and choose
   HTML tag verification. Put only its `content` token in the frontend deployment
   variable `GOOGLE_SITE_VERIFICATION`, redeploy, confirm the live Home source
   contains the exact tag, then click Verify. Do not paste the full tag or change
   login/email configuration. This alternative covers only that URL prefix.
4. Under Sitemaps submit `https://www.gumwheel.com/sitemap.xml`.
5. Inspect Home, `/help`, `/about` and `/carpooling/sydney` using URL Inspection.
   Request indexing where appropriate. Review Pages and Performance as data arrives.

The sitemap and indexable HTML support discovery; they do not guarantee indexing
or rankings. There is no deprecated sitemap ping or general-purpose Google
Indexing API submission in this project.

## Bing

Sign into [Bing Webmaster Tools](https://www.bing.com/webmasters/). Add the site and
follow its ownership wizard, or import from Google after Google's property is
verified. If using its HTML meta tag, set only the token in the frontend variable
`BING_SITE_VERIFICATION`; redeploy, check Home's `msvalidate.01` meta tag, then
verify. Submit the same public sitemap and review reported crawl/indexing results.
These dashboards require the owner's account; code changes cannot create that
ownership. Reporting integrations discovered in the plugin catalogue do not
establish initial ownership for us.

## IndexNow

`npm run search:submit` prints only the approved public URLs, without network use.
After deploying the guide and public ownership file, explicitly run
`npm run search:submit -- --submit`. It preflights ownership/page availability and
robots directives before one request to IndexNow. Do not rerun automatically on
errors. Receipt (200) or pending ownership validation (202) is not an indexing
confirmation. IndexNow serves participating engines; it does not replace Google's
setup. No private URLs, cookies, account data or user inventory are submitted.

## Completion record

29 October 2026, 10:36 AEDT: the public ownership file and six-page sitemap were
verified live. One IndexNow batch returned 202 (ownership validation pending).
See `results/indexnow-2026-10-29.json`. No repeat submission is scheduled.

Record actual property verification and sitemap dashboard results here only after
observing them. Currently both account setup steps remain with the owner. Live
public frontend and IndexNow observations belong in SEARCH_DISCOVERY.md and dated
sanitized files under `docs/results/`.

Sources: [Google ownership verification](https://support.google.com/webmasters/answer/9008080),
[Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
[Bing setup help](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b),
[IndexNow protocol](https://www.indexnow.org/documentation).
