# Assigned map avatars — 16 November 2026

## Scope and user choice

Per-account display of an already approved full-body render, not a photo-upload or
generation feature. The owner requested the existing **P2-20260801** result and
explicitly chose to display it on public Home as well as signed-in maps. No new
Tripo request, credit spend, Snap import, Mac service or model inference is involved.
The public sprite is a static render of that selected model, not an animated GLB.

Profile → Avatar is initially collapsed, below Personal details. Assigned accounts
can Edit the existing checkbox, preview My avatar / Default, then Save or Cancel.
The public-Home disclosure sits beside this choice. No assignment means the default
preview and no unavailable Create button. Loading failures retain Try again;
failed previews/map images fall back to the existing waiting-person illustration.
Buttons remain available; a synchronous in-flight guard prevents duplicate saves.
Changes affect map display only, not circular profile photos, role labels,
car/bicycle artwork, journey permissions, acceptance or history. There is no
rating, role, active-trip restriction or cooldown on this display preference.

## Storage, assignment and privacy

Additive `account_map_avatars`: immutable account principal FK, random 128-bit
asset version, current WebP sprite BLOB, enabled bit, assignment timestamp. Startup
creates the table idempotently. Accounts are never selected by public username.
An operator assigns an approved render using:

`node --import tsx scripts/assign-map-avatar.mts LOGIN_IDENTITY APPROVED_RENDER [--enable]`

Omit `--enable` for future assignments until the person makes their display choice.
The owner explicitly authorised enabling the first P2 assignment. The script
requires an existing verified account, performs one atomic replacement, and never
generates a model. It accepts a still alpha PNG/WebP ≤10MB / 16M decoded pixels,
normalizes orientation, trims empty margins and contains the whole figure in
128×256 transparent WebP (quality 90, alpha 100), stripping metadata. This is an
operator-only render preparation tool, not a public photo-validation boundary.
Replacement gives a new opaque URL and removes the old active render; no
automatic deletion TTL applies. Older backups may retain previous renders.

| Endpoint | Access / behaviour |
| --- | --- |
| GET `/api/avatar` | Verified session; current account's assigned/selected state and preview URL |
| POST `/api/avatar` | Verified session, strict boolean `enabled`, ≤2048-byte JSON; rechecks session after body read; no arbitrary URL, account or image assignment |
| GET `/api/avatar/preview?v=VERSION` | Current verified account's render, even while using Default; private/no-store, no account-selector parameter |
| GET `/api/map-avatar/OPAQUE_VERSION.webp` | Public **only while enabled**; WebP/nosniff/no-store; unknown, superseded or disabled versions return 404 |

Setting true without an assigned render returns 409 AVATAR_UNAVAILABLE; malformed
preference returns 400. Unverified settings/preview reads return 401. Another
account cannot read the private preview or change someone else's preference.
Enabled public sprites are intentionally accessible without login: an opaque URL
is not encryption or anonymity. Home's coarse area projection contains no account
ID, username, exact endpoints, destination, schedule or live GPS, but a personal
avatar can be recognisable. This supersedes the former generic-rider-only Home
artwork policy. Source photos, original Tripo outputs and GLBs keep the existing
owner-only research routes; neither source files nor sprites go into Git/public.
Disabling blocks future public sprite reads; previously viewed/saved copies cannot
be recalled. Private preview access remains so the user can choose the avatar again.

## Shared maps and refresh

JourneyMap/modelMarkerIcon receives only strict `/api/map-avatar/[a-f0-9]{32}.webp`
paths for a rider. It never inserts arbitrary image URLs into Leaflet HTML. The
same model renderer serves Home, Find, requested-journey details/discovery and
driver maps of selected/accepted rider requests. Semantic person labels remain
generic. The original 48px slot, ground anchor, provider, route colours and GPS
gates remain unchanged; one contained 46px-tall image replaces the person sprite.

Home keeps the existing 0.05° grid, three-icons-per-area/120-total cap and
non-interactive map. Each rider slot can carry its enabled sprite alongside
generic riders, matching existing vehicle artwork arrays. Empty/failed feeds
still hide the map. Public sprite reads do not run lifecycle writes.

Save sends payload-free invalidation in the same tab and through BroadcastChannel;
existing map focus/visibility refreshes also run. Own rider maps fetch their
current choice and Home refreshes its feed immediately in listening tabs. Other
viewers receive the choice on existing detail polling (8–15s), new discovery
searches, reload, or the visible Home feed's existing 60s refresh. No avatar-specific polling loop or
GPS transmission is added. Offline/broken renders use the generic person.

## Deferred upload queue

Discussed, not implemented: Pi-owned private photo/job storage; a Mac worker claims
pending validation when available; notify in-app immediately on completion and
reuse the existing five-minute **unreviewed update only** email fallback. Opening
Profile alone must not acknowledge an unseen result. The initial submission should
clearly request both steps: photo check, then automatic avatar generation only
after approval. The validator itself must not create/retry a paid Tripo task;
generation belongs to a separate durable, deduplicated job with an agreed spend
limit. Requires a defined photo TTL, image limits, worker authentication,
lease/retry/deduplication and retention/replacement/cancellation policies.

Proposed queue copy: “Your photo is queued for checking. We’ll notify you with
the results.” No redundant Waiting/Finished headings. Passing the check starts
creation if the person agreed to proceed. Rejections state only a supported
reason, such as “We couldn’t clearly identify both feet. Upload another full-body
photo.” Provide Upload another photo without repeating the whole requirements
list; do not invent a confident reason for an uncertain result. These are future
flow requirements, not messages currently shown by this assigned-render release.

The supplied Mac MediaPipe handoff checks landmark visibility proxies only; it
does not yet establish standing-only, single-person or overall avatar readiness.
No 24-hour completion promise or maintenance claim is justified by Mac uptime.

## Verification and activation

Record completed checks and actual deployment separately below. Baseline source
is `289449d`. Tests use in-memory SQLite and synthetic accounts/routes; source
photo and generated files remain private. New API/schema needs a consistent private
backup and restart only after confirming zero accepted/active trips. A push alone
does not activate the Pi API or prove the frontend deployed.

### Completed local checks and API activation

`npm test`: 267/267. `npm run lint` and `npm run build`: pass.
`npm run test:security`: 52/52 after correcting the outdated anonymous-discovery
expectation; it now verifies both anonymous denial and signed-in redaction.
Initial failures and the legacy-fixture remediation are retained in the
[sanitized result](results/map-avatars-2026-11-16.json).

Browser reproduction (use a compatible Python environment with Playwright):

1. `GUMWHEEL_AVATAR_FIXTURE=1 node --import tsx scripts/serve-map-avatar-fixture.mts`
2. `COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 npx next dev --hostname 127.0.0.1 --port 3491`
3. `GUMWHEEL_TEST_TILES=1 python scripts/check-map-avatars.py`

Use the retained fixture metadata in `/tmp/gumwheel-avatar-fixture.log` by
redirecting command 1 there. `GUMWHEEL_AVATAR_RENDER` can point at an approved local
render; default is the private P2 trial PNG. Screenshots go to
`/tmp/gumwheel-map-avatar-review`; none are committed. The fixture binds loopback
and uses in-memory SQLite and synthetic sessions. Road geometry is mocked, while
the UI/profile/API/avatar data path runs against the actual isolated API.
Checks pass at 320/390/1440px for both roles, preview/save/cancel, defaults,
cross-tab refresh, public non-interactive Home and image-failure fallback.
Whole screens were visually reviewed at phone/desktop sizes, including Privacy;
spacing, regular body weights, action hierarchy and existing marker scale remain
consistent. Manual React review covered cleanup, stale results, mutation guards,
native input semantics and no generation on render.

API activation on 16 November followed a verified private backup and a fresh
zero-accepted/active-trip check. Only cocowheels-api restarted. All 141 rides,
requests, demand/offer/proposal records and existing profiles/vehicles match the
backup; integrity is ok, foreign-key violations zero. Only the owner's account
has an assignment. Stored and public sprite bytes exactly match preparation of
P2-20260801, not another trial model. Local/public health returned 200; anonymous
settings/preview reads returned 401, and original GLB reads remained 403.
Frontend rollout verification follows the source push. Physical Safari, a live
owner browser walkthrough and concurrent avatar capacity remain unverified.
