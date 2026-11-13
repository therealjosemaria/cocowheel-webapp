# Private Tripo comparison

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
