# Local search preference and ranking — 31 October 2026

Implementation baseline b5b4056 (time picker) / search baseline 9b37986.

## Observed problem

Read-only public API probes for 2018 with countryCode=au returned Armenia before
an Australian postcode result. Redfern with country=au returned Australia before
foreign results, and a Sydney proximity hint returned the Australian result only.
These fresh API probes bypassed the one-minute browser cache; they do not prove
what the user’s earlier browser request contained. No user trips were changed.

Source inspection found seven-day localStorage country writes only during Home’s
reverse lookup; normally labelled forward selections skipped that effect. Shared
forward/GPS selections instead updated a 30-minute same-tab location. Browser
cache keys already include text, coordinates and country, and remain unchanged.

## Implemented contract

Every shared selected place with valid country metadata now updates the existing
cocowheels:country-preference:v1 localStorage key with a rolling seven-day expiry.
This includes Find, Post and Profile’s shared PlaceSearch, plus its existing Use
my location selection. Only country and expiry are stored in this persistent key;
coordinates/country stay in the existing same-tab 30-minute session key. No precise
location is newly persisted across tabs. Expired/malformed/blocked storage is
ignored; search remains usable. This is browser-local, not account/device sync.

Home reuses the shared country helpers for reverse lookups and initial preference.
At search time, precedence is selected origin country, latest same-tab selection
country, persistent country, then the field’s Australia fallback. Coordinates
prefer an explicit origin over the latest tab-local selection. The search reads
persistent country again rather than depending only on Home’s mount-time state.
An origin selection therefore affects the destination immediately, even if storage
is blocked, because the selected pin supplies its own coordinates/country.

The server still makes one Geoapify forward request with at most ten results,
country/proximity bias, no hard filter and the existing four-second timeout.
For queries without a provider-parsed explicit country, returned results matching
the preferred country are grouped first. Provider order is stable within each
group, and all foreign alternatives stay in the response. If the provider reports
query.parsed.country, its complete order is retained, allowing explicit overseas
searches such as Paris France. Unknown/absent country preferences retain provider
order. This cannot create a local match missing from the provider’s returned set.

No automatic GPS request, IP-location provider or new country-guessing service is
added. Use my location remains an explicit user action with browser permission.
This supersedes earlier provider-only ordering statements; query validation,
rate limits, result labels, cache capacity/TTL, schema and credentials are unchanged.

Provider reference: https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/ .
Read-only provider diagnostics confirmed parsed.country was absent for 2018 and
Redfern, and “france” for Paris France. Do not log API-key URLs or private searches.

## Verification and release

Run `npx tsx --test tests/place-label.test.ts tests/search-location.test.ts`,
`npm test`, `npm run lint` and `npm run build`. Tests use fake provider fetches and
browser storage; no live trip or account writes. Results and browser/deployment
checks are recorded after completion. Backend ordering requires a conditional
API restart with a consistent private backup and zero accepted/active trips;
frontend persistence alone does not activate backend ordering. Physical phones
and all provider parsing/language edge cases remain outside the synthetic checks.

Targeted provider/storage tests pass 10/10; full regressions pass 232/232, lint
and production build pass. Reproduce browser handoffs against an isolated Next
preview at :3201 with API proxy loopback :1 using
`python scripts/check-local-search.py` (Playwright/system Chromium). Browser
fixtures cover a five-day-old country hint, postcode/origin-to-destination
handoff, visible foreign alternatives, overseas selection, separate new-tab
session storage, Profile selections and country/coordinate-aware cache reuse.
Provider ranking itself is exercised by the injected-fetch backend tests, not
claimed from ordered browser mocks. One initial fixture wrongly rejected the
existing read-only route-preview POST as a write; its allowlist/mock was corrected
and the complete suite rerun. No live mutations or test emails were performed.

React review found no hook, rendering, permission or new-control changes beyond
the intended preference reads/writes. Existing result sheets and Profile editor
are reused. Mobile/desktop visual and deployment checks are recorded below.

Browser handoff suite passes at 390/1440px with no runtime errors; existing
result-list sheets and full Find/Post/Profile screens were visually inspected
at phone/desktop widths for hierarchy, spacing, wrapping and overlay placement.
No visual tokens or controls changed. Physical mobile keyboards, all browser
storage policies and provider country-parsing variants remain unverified.
