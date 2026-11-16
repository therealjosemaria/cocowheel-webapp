# Assigned map avatars — 16 November 2026

Self-service extension: [avatar creation](AVATAR_CREATION.md) now supplies upload,
Pi queue, Mac checks, P2 generation and result notifications. That supersedes this
release's operator-only creation boundary and the proposed queue section below;
the display/storage/opt-in contract here remains in use.

## Scope and user choice

Per-account display of an already approved full-body render, not a photo-upload or
generation feature. The owner requested the existing **P2-20260801** result and
explicitly chose to display it on public Home as well as signed-in maps. No new
Tripo request, credit spend, Snap import, Mac service or model inference is involved.
The public sprite is a static render of that selected model, not an animated GLB.

Profile → Avatar is initially collapsed, below Personal details. Assigned accounts
see the same single-line Personal avatar checkbox in saved and edit views, preview
the personal/default figure, then Save or Cancel. The tick shows the selection;
there is no separate Enabled/Disabled line. The checkbox stays focusable and
announces aria-readonly outside Edit (also while saving); pointer/Space activation
and change handling preserve the saved state until Edit. Cancel restores the saved
choice without a write. This reuses usual-alert-choice rather than a new switch
or status icon. Native HTML checkboxes do not support the readonly attribute, so
the component pairs ARIA semantics with an activation guard.
The public-Home disclosure sits beside this choice. No assignment means the default
preview and no unavailable Create button. Loading failures retain Try again;
failed previews/map images fall back to the existing waiting-person illustration.
Buttons remain available; a synchronous in-flight guard prevents duplicate saves.
Changes affect map display only, not circular profile photos, role labels,
car/bicycle artwork, journey permissions, acceptance or history. There is no
rating, role, active-trip restriction or cooldown on this display preference.

Pattern references: the [WAI checkbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
defines the checked/unchecked state and Space interaction. The
[HTML input standard](https://html.spec.whatwg.org/dev/input.html#the-readonly-attribute)
does not give checkboxes a native readonly mode;
[ARIA in HTML](https://www.w3.org/TR/html-aria/)
permits the corresponding ARIA property where the role supports it. The app's
activation guard enforces the requested Edit-only modification rule.

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

1. `GUMWHEEL_AVATAR_FIXTURE=1 node --import tsx scripts/serve-map-avatar-fixture.mts > /tmp/gumwheel-avatar-fixture.log 2>&1`
2. `COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 npx next dev --hostname 127.0.0.1 --port 3491`
3. `GUMWHEEL_TEST_TILES=1 python scripts/check-map-avatars.py`

The fixture metadata is saved in `/tmp/gumwheel-avatar-fixture.log`.
`GUMWHEEL_AVATAR_RENDER` can point at an approved local
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

### Verified frontend release

Implementation `d8206b8b646cda24b61f7b0e3380ca3cd4825c32` is pushed to main.
Vercel deployment `dpl_8nh8PeTf8eG2qfH4KxAhNT6TXocD` is READY for that exact
commit and assigned to www.gumwheel.com / gumwheel.com. Fresh public Chromium
checks at 390/1440px confirmed the new Privacy revision/copy, retained Home layout,
no overflow or page exceptions, and no API writes. All non-GET/HEAD requests were
blocked in this production check, including analytics. Avatar controls and both
participant roles were tested against the isolated actual API as above; the live
owner sign-in walkthrough and physical Safari remain unverified. No further API
restart is needed for this documentation-only follow-up.

### Personal avatar wording refinement — 16 November

The initial saved summary used Personal avatar with Enabled/Disabled and the edit
label Use personal avatar; the single-line checkbox above supersedes that split.
The helper reads “When enabled, shown on maps, including public Home.” That copy
refinement retained the then-existing label/value typography and controls.
Visual-system regression, component ESLint and production build pass. Mocked
Profile browser checks pass at 320/390/1440px for enabled, disabled, unassigned,
preview and Edit/Save/Cancel states, with no overflow or page errors. Whole screens
were visually reviewed at 390/1440px for regular body weight, wrapping, spacing and
action hierarchy. No API restart or data change is required; physical-device and
live owner browser checks were not performed for this copy refinement.

### Single-line checkbox refinement — 16 November

Baseline `f0ac5c8`; this is a frontend-only refinement. Reuses the same checkbox
DOM element across Edit, Save and Cancel, with regular-weight inline label and
the existing 20px control / 8px gap / 44px row. No CSS, palette, API, assignment,
generation or permission change; no API restart is required.

Component ESLint, visual-system regression and production build pass. The initial
sandboxed build stalled and was stopped; the authorised build completed with exit
0. The existing isolated fixture/browser command above printed PASS at
320/390/1440px for both roles and map refresh; its session returned 143 after those
results. A focused Profile rerun against the actual in-memory API completed with
exit 0 at all three widths: pointer/Space cannot toggle saved enabled or disabled
choices, Edit reuses the same input, Cancel sends no save, and Save/reload persist
the selected boolean. No page exceptions or horizontal overflow. Development
console inspection also found a duplicate navigation key for the synthetic
identity `tester01`; that navigation code is unchanged by this refinement.

Whole Profile screens in saved and edit states were visually reviewed at 390 and
1440px for one-line label fit, preview size, emphasis, colour, spacing, adjacent
disclosures and action hierarchy. Artifacts/logs remain local under
`/tmp/gumwheel-map-avatar-review` and `/tmp/gumwheel-avatar-checkbox-*`. Physical
devices, assistive-technology announcements and the live owner's signed-in
walkthrough remain unverified. Deployment is checked separately after push.
