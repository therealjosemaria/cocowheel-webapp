# Private Tripo comparison

The [Seedream production release](SEEDREAM_AVATARS_2026-11-16.md) supersedes
the preview-only/no-assignment boundary below. Original trial artifacts and
charges remain unchanged. The gallery now labels Seedream v5 as the selected
generation model; P2 remains its original 3D reference. Opaque/alpha labels describe
the original provider outputs, before the separate Pi background-removal stage.

## Seedream local cutout map preview — 16 November 2026

The owner requested background removal from the existing Seedream v5 output and
mobile/desktop map previews before choosing a replacement model. This is an
**offline preview only**. The original Seedream output, comparison manifest, P2
map assignment and production generator remain unchanged. No Tripo task, provider
balance check, production database write, API restart or public media route is
needed. A proposed Runway upload was blocked by automatic approval review because
that external destination had not been explicitly authorised for the private
photo-derived image; no Runway asset/upload was created. Processing continued
locally on the Pi without sending image bytes to another service.

`scripts/cutout-white-background.mjs` removes border-connected near-white pixels
(minimum RGB channel 230; channel spread at most 24) by changing only alpha. It
uses a four-neighbour flood fill, not a learned person-segmentation model or an
image generator. Enclosed white clothing is retained. Every original RGB value
in the 768×1344 source/cutout was compared: zero changed values, including the face.
896,744 pixels became transparent. A new mode-0600 private PNG was saved; the
source was not overwritten. Input limits: still PNG, ≤10 MB and 16 million decoded
pixels; results with <10% or >99% removed stop for review. CLI uses exclusive
creation for its output and cannot silently overwrite an existing file.

This is appropriate to this particular plain near-white sample. It is not yet a
production upload step and cannot reliably handle arbitrary backgrounds, white
clothing connected to the background, enclosed background holes or fine matting.
A faint light fringe is visible at full size against a dark surface; alpha-only
processing preserves the original edge colours. The enlarged cutout and existing
48px map marker were visually inspected. No claim of a perfect cutout or general
avatar readiness follows from this one photo.

Reproduce (use a new output path if it already exists):

1. `node scripts/cutout-white-background.mjs data/tripo-comparison/seedream_v5.png data/tripo-comparison/seedream_v5-cutout-local.png`
2. `GUMWHEEL_AVATAR_FIXTURE=1 GUMWHEEL_AVATAR_RENDER=data/tripo-comparison/seedream_v5-cutout-local.png node --import tsx scripts/serve-map-avatar-fixture.mts > /tmp/gumwheel-avatar-fixture.log 2>&1`
3. `COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3491` using the existing optimized build of unchanged application source.
4. `GUMWHEEL_AVATAR_PREVIEW_DIR=/tmp/gumwheel-seedream-map-preview python3 -u scripts/preview-avatar-map.py` in a Playwright-capable environment.

The fixture prepares the cutout through the existing `prepareAvatarSprite` path
(transparent 128×256 WebP) and assigns only an in-memory synthetic account. It
uses the actual shared Home/JourneyMap marker at its unchanged 48px slot. At
390/1440px, the read-only preview verifies loaded artwork, real public OSM tiles,
no document overflow or JS errors, and captures full Home, rider-request and
driver-request views. Road geometry is mocked between public-place endpoints;
these are demonstrations, not live rides. Tile requests contain public tile
coordinates only, never image bytes or user details. All real writes are blocked;
route-preview is fulfilled locally. Screenshots/cutout remain ignored private
local artifacts, not Git/public assets. Phone and desktop screens were reviewed
for map scale, edge visibility, full-figure framing and unchanged UI hierarchy.
All 293 isolated regression tests and ESLint passed. The initial broad lifecycle
harness terminated with exit 143 without a final result; it is not counted as
passing. The focused read-only preview completed successfully. An initial sandbox
test invocation could not create the tsx IPC socket; the authorised isolated
rerun passed. Physical devices, production display, arbitrary-background
segmentation and model replacement were not tested/performed. No frontend rollout claim applies
to these local previews. See [sanitized evidence](results/seedream-cutout-preview-2026-11-16.json).

## Image-only comparison — 16 November 2026

The owner authorised Sunburst and Seedream v5 tests from the same saved reference,
beside the already completed P2 result. A fresh read-only balance check found
50 credits available and zero frozen: no top-up was needed for the 15-credit
two-task plan. No other image model, higher quality tier or new P2 generation
was authorised/submitted. Task-level usage verified the following completed costs:

| Model | Pinned options | Observed completion | Actual charge | Output |
| --- | --- | ---: | ---: | --- |
| Sunburst (`chat_image_2.5_sunburst`) | medium, 1024×1536, transparent PNG | 37s | 10 credits / US$0.10 | 1024×1536, alpha present |
| Seedream v5 (`seedream_v5`) | 2K, PNG; no unsupported quality/background options | 25s | 5 credits / US$0.05 | 768×1344, opaque |
| P2 (`P2-20260801`) | Original standard textured render, reused | 82s originally | No new charge | Existing private PNG/GLB |

The wallet then held 35 credits. Times are observed completion from one serial
run, not latency/capacity guarantees. The shared prompt asks for the same standing
person, identity, outfit and full-body framing with polished 3D-style shading.
Reference bytes are SHA-256-checked against the original private manifest; no
new crop/re-encoding of the reference is supplied. Output images are decoded and
saved as metadata-stripped PNGs. Transparency present means actual alpha below
255 was detected; it does not certify a clean background cutout. Seedream returned
an opaque white background despite the prompt. No background removal, likeness
score, new full-body gate, map assignment or avatar-generator replacement occurred.
The source photo, original five rows and P2 assets were preserved.

`/admin/avatars` shows three contained image previews at the top: P2, Sunburst,
Seedream. They stack on phones and sit in three columns on desktop, reusing the
existing comparison grid, image surface and typography. Original framing remains
visible. Downloads are private PNGs. The results table distinguishes estimates
from verified charges and explicitly identifies P2's historical cost/time. The
five original rotatable 3D results remain below. No balance polling or paid action
is added to the page. Existing `/admin/avatar-management` manual dashboard checks
and public/personal map artwork are unchanged.

Offline plan: `node --import tsx scripts/tripo-image-compare.mts`.
Explicit paid operator run:
`node --env-file=data/tripo-credentials.env --import tsx scripts/tripo-image-compare.mts --run`.
The script uses the saved private reference and manifest; it does not accept a
different photo accidentally. It shares the existing exclusive `run.lock`, checks
full remaining list-price affordability before submission, saves an uncertain
state before each paid POST and persists returned task IDs. There are no automatic
POST retries. Re-running resumes those IDs or skips completed images; an uncertain
POST without an ID stops for account-history reconciliation. Polls run every five
seconds, for up to 20 minutes per invocation; timeout preserves IDs for safe resume.
Every provider request has a 60-second timeout. Images are capped at 30 MB and
16 million decoded pixels, still PNG/JPEG/WebP only, and are normalized to PNG.
Download requests never carry the API key and refuse redirects/unrecognised hosts.
Task-level usage verifies cost; wallet change alone is not used to attribute charges.
The original 3D runner now ignores image rows, preventing accidental paid 3D retries.

The existing admin cookie/origin boundary protects the manifest and source.
Only the exact two model names gain `.png` asset paths; no image-model GLB,
arbitrary filename or traversal path is exposed. Images, reference, keys, task IDs,
signed provider URLs and manifest remain ignored private files outside Git/public
assets; the existing comparison retention remains operator-managed. A private
manifest backup was taken before appending rows. Backend asset changes require
the existing guarded backup/restart procedure; frontend push alone is insufficient.

Current official sources: [image editing parameters](https://developers.tripo3d.ai/en/docs/generation-image-to-image)
and [pricing](https://developers.tripo3d.ai/en/pricing). API/Studio funding is separate.
These two output images are samples to review, not evidence that every photo will
preserve likeness or that either model meets our production quality requirements.

### Image comparison verification

Baseline `51fba340be0d71f45dbf6f054daf4c20d19d416c`; source digests,
reproducible commands and the retained harness failure are in the
[sanitized result](results/tripo-image-comparison-2026-11-16.json). Nine targeted
comparison/admin checks, all 292 regressions and 52 security checks passed using
synthetic accounts, temporary databases and fake providers. Lint and optimized
build passed. Standalone TypeScript retains 28 diagnostics in untouched tests;
none were reported in changed source or comparison files.

The optimized local frontend against the existing synthetic owner API passed at
320/390/1440px: private previews load, table prices/rows remain accurate, desktop
columns align, no document overflow or JS errors, and anonymous reference/new
image reads return 403. Whole screens at 390/1440 were visually reviewed for
heading/body emphasis, spacing, full-image containment, links and table scrolling.
The first harness asserted readiness before lazy images entered the viewport;
scrolling/waiting for decode fixed the test, and all widths passed. Historical
GLB downloads were blocked during this review; interactive rotation was not
retested. No browser generation or provider balance call occurred. Physical
Safari and authenticated production owner review remain unverified.

### Image comparison activation

On 16 November at 16:59:31 AEDT the API was restarted only after fresh zero
ACCEPTED/RIDE_ACTIVE/CO_RIDE_ACTIVE checks and a private online SQLite/config
backup. All 142 rides and 19 history/account tables matched before/after; SQLite
integrity was ok, foreign-key violations were zero and configuration was unchanged.
Local and direct public HTTPS health returned 200. Anonymous manifest, reference
and both new PNGs returned `ADMIN_ACCESS_DENIED` 403 using the valid site Origin.
The initial probe omitted the local `/api` prefix, then encountered environment
proxy 403 responses; corrected/direct checks passed without a product change.
Frontend verification is recorded separately after push; API activation alone
is not proof that the comparison UI is deployed.

### Image comparison frontend deployment

Implementation `daeb0f529e175c0ba751e59f501c31a833153b97` is verified READY as
`dpl_9bRRpAavdEpZVhXq8mFCWckrPJU5`, with both `www.gumwheel.com` and
`gumwheel.com` aliases attached. Public 390/1440px Chromium checks passed:
`/admin/avatars` shows the email sign-in gate, no private previews appear before
sign-in, and reference/P2/Sunburst/Seedream PNG reads return
`ADMIN_ACCESS_DENIED` 403. The browser permitted only GET/HEAD; no real email,
login, trip mutation or paid generation occurred. Authenticated production owner
walkthrough remains unverified; the authorised comparison/media UI was reviewed
against the isolated synthetic owner API above. This follow-up only records
verified activation/deployment; it requires no further API restart.

16 November follow-up: the owner selected **P2-20260801** for an explicitly enabled
map-avatar assignment. [Map avatar storage and display](MAP_AVATARS.md) supersedes
the no-map-integration boundary in this historical trial. Only its prepared alpha
sprite is made public when enabled; reference photos, original previews and GLBs
remain owner-only. This follow-up generates no new Tripo tasks.

## Completed trial — 14 November 2026

Five generations completed successfully from the same normalized full-body
reference. One task per model; private GLB and PNG outputs are available through
`/admin/avatars` after owner sign-in. Tripo task-level usage verified these charges:

| Model | Observed completion | Charge (USD equivalent) | GLB size |
| --- | ---: | ---: | ---: |
| H3.1 | 94s | $0.30 | 41.77 MiB |
| H3.0 | 106s | $0.30 | 16.79 MiB |
| H2.5 | 55s | $0.30 | 6.95 MiB |
| P2 | 82s | $1.10 | 2.27 MiB |
| P1 | 59s | $0.50 | 2.37 MiB |

Total: 250 credits / $2.50 equivalent. Final available balance: 50 credits, frozen
0. This is a single serial trial, not a concurrency benchmark or a likeness
guarantee. Private reference, hashes, task IDs, credentials and signed artifact URLs
are not in the [sanitized result](results/tripo-avatar-2026-11-14.json).

The first H3.1 download stopped because the provider returned
`openapi-dl.data.tripo3d.com`, absent from the initial allowlist. That specific
host is now accepted; the same completed task was resumed, not generated twice.
Downloads carry no API Authorization header, verified by the synthetic fixture.
Preview posters appear while models load lazily. The shared camera starts at
90deg / 75deg / 105% to show the face rather than the side; all models remain
rotatable. No map marker, profile avatar or public feed integration was added.

The API was backed up and restarted after zero accepted/active journeys; all 141
ride records remained, integrity was ok and foreign-key checks were clear. Initial
immediate connection checks during startup failed; later local/public health checks
returned 200, with anonymous manifest/photo reads denied 403. Frontend deployment
verification is recorded separately below. The earlier 7 November pending status
is historical.

## Scope

Implemented research tooling, not a user-facing avatar integration. `/admin/avatars`
is unlisted, noindex and gated using the existing verified-owner admin session.
Every `/api/admin/tripo` manifest/asset read checks the same authorization on the
API server. A hidden URL is not authorization. Responses use private/no-store;
no selfie, task output, key or signed provider URL belongs in Git/public assets.

## Operation

Store TRIPO_API_KEY only in the shell running the test (never NEXT_PUBLIC_*).
The operator may use ignored `data/tripo-credentials.env` with mode 0600. Never
commit this file or print its contents; no API service environment change is needed.
The web/API processes do not need that key. No paid calls on page load.

Offline plan: `node --import tsx scripts/tripo-compare.mts`

After funding the **API** balance and obtaining the reference image:
`node --env-file=data/tripo-credentials.env --import tsx scripts/tripo-compare.mts --run /private/reference.jpg`

This explicitly submits up to five paid tasks, serially, one per requested model.
API balance must be positive before new tasks; check full-batch affordability
against current model prices before spending. It stops on provider errors without retries.
EXIF/GPS is stripped to one normalized PNG, reused byte-for-byte. Max input 20MB,
32M decoded pixels; still PNG/JPEG/WebP only. Fixed geometry/texture seeds 42;
texture and PBR on, autofix off, adaptive face counts, model-default standard
textures (H2.5 disallows explicit texture_quality). Same seed across different
models does not establish identical geometry. No body-completion preprocessor.
A headshot may produce only a head/bust; evaluate before promising a full body.

Private local storage: TRIPO_COMPARISON_DIR, default `data/tripo-comparison`.
Use the same absolute path for CLI and API if run from different directories.
Directory 0700/files 0600; ignored by Git. One reference/batch at a time; atomic
manifest updates and exclusive run.lock. Existing task IDs resume querying;
uncertain submissions stop and require manual task-history reconciliation, never
blind resubmission. On an actual process crash, inspect history/processes before
removing a stale lock. Poll every 5s, stop after 30 minutes per invocation; API
requests time out after 60s, downloads after 120s/150MB. Downloads never receive
the API key. GLB output is validated by magic bytes; previews normalized to PNG.
Artifact host changes stop download and require inspection, not regeneration.

Elapsed time is submission-to-observed-success, includes queue/network/polling,
and can include downtime after interruption; it is not GPU inference time.
Task-level `/account/usage` matches charges by task ID; missing/delayed usage stays
Unverified. Re-running a completed comparison refreshes billing without generating.
Estimates are list-price credit equivalents, not historical top-up spend or AUD.
No automated TTL: owner must archive/delete the private directory when finished.
Deleting local files does not delete provider copies. Provider retention/training
terms and production user consent must be reviewed before a public feature.

## Current sources and economics

Use V3 (`https://openapi.tripo3d.ai/v3`), not retired V2 examples.

- [H generation](https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard)
- [P generation](https://developers.tripo3d.ai/en/docs/generation-image-to-model/p)
- [Uploads](https://developers.tripo3d.ai/en/docs/files)
- [Billing](https://developers.tripo3d.ai/en/docs/billing)
- [Concurrency](https://developers.tripo3d.ai/en/docs/rate-limits)
- [Official CLI](https://developers.tripo3d.ai/en/docs/cli); inspected published
  tripo-cli 0.11.2 source/knowledge for model-specific estimates.

Standard textured image generation: H3.1/H3.0/H2.5 each 30 credits ($0.30),
P2 110 ($1.10), P1 50 ($0.50). The interactive H/P tables on the
[pricing page](https://developers.tripo3d.ai/en/pricing) and this trial’s task-level
usage supersede the initial unverified legacy/P1 estimates. One credit = US$0.01 equivalent. No first-ten-free API allowance
or peak-concurrency surcharge verified. API and Studio have separate balances.
Failed/cancelled tasks release frozen credits per current billing documentation;
actual settlement still needs checking. Volume discounts require provider agreement.

Published defaults: 10 concurrent H tasks, 5 P tasks, shared per account/category;
request-rate limits apply per key. Full pools reject new jobs with HTTP429/code2000;
they do not promise a provider waiting queue. A production feature needs a durable
app queue, bounded workers, backoff, duplicate protection and a per-user spend cap.
100 arrivals imply at least 10 H or 20 P scheduling waves at these limits (rough
illustration, not a measured completion SLA). Higher limits require support.
Five single tests cannot establish throughput/p95 performance or 100-user capacity.

## Initial validation and deployment boundaries — 7 November 2026

No paid requests or likeness assessment yet: reference photo and funded balance
are pending. Tests use isolated in-memory databases and synthetic local artifacts.
The comparison page needs frontend deployment **and** the new read-only API routes
activated in the API process. Do not claim a Git push restarts that process.
No production restart performed for this initial empty page. Authenticated live
walkthrough and actual generated GLB rendering remain pending.

Local checks: seven targeted tests passed (owner/other-account authorization,
asset allowlist, shared model settings, mocked five-task pipeline and repeat-run
no-new-submissions); visual-system regression passed and changed-file ESLint had
no errors. Full 390px mobile and 1440px desktop empty screens were reviewed with
an isolated mock API; document width matched viewport, table scroll is contained,
body copy remains regular and panels reuse existing heading hierarchy. Generated
model states and real provider billing remain untested. Whole-repo tsc reports
existing errors in unrelated test fixtures; no errors reported in new files.
The initial sandbox production build failed because Turbopack could not bind a
local process port; this is a sandbox limitation, not a successful build.

The production build rerun with required local process permissions **passed**,
including Next TypeScript checks and route generation for dynamic `/admin/avatars`.
The sandbox build failure above is retained as the initial failed check. Production
activation remains separate. React review: viewer loaded only on this private
client screen, effect cleanup guards updates after unmount, no render-time provider
calls or browser secrets; tabular headers and viewer alternative text included.

## Gallery validation — 14 November 2026

All five actual GLBs loaded interactively in the isolated browser review, including
models below the fold; final whole-page screenshots were reviewed at 390px and
1440px. Preview/3D states, regular body copy, camera consistency and table layout
were checked. The production build, changed-file ESLint and 15 targeted/visual
regressions passed. Models are 2.27–41.77 MiB, so these research assets are not a
claim of mobile-map readiness; a future map integration needs optimized meshes or
rendered sprites. No physical-phone or authenticated live-browser performance test.
Frontend deployment verification follows the source push and is a separate check.

## Verified production rollout — 14 November 2026

Vercel deployment `dpl_CqGKxC7NmgaXe3qZq2dTYkWP4jNn` reached READY for source
`832533f9054d461234fbaad2467e6603334a6475`, with www.gumwheel.com assigned.
The private page returned HTTP 200 with noindex and the expected unsigned sign-in
form. Live anonymous reads of all five GLB files, the reference and manifest were
403/no-store. API health was 200. This confirms rollout and public denial, not an
actual owner sign-in walkthrough; the interactive gallery was tested locally as
noted above. The follow-up commit only records this deployment evidence.
