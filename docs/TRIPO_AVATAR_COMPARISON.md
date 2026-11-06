# Private Tripo comparison — 7 November 2026

Implemented research tooling, not a user-facing avatar integration. `/admin/avatars`
is unlisted, noindex and gated using the existing verified-owner admin session.
Every `/api/admin/tripo` manifest/asset read checks the same authorization on the
API server. A hidden URL is not authorization. Responses use private/no-store;
no selfie, task output, key or signed provider URL belongs in Git/public assets.

## Operation

Store TRIPO_API_KEY only in the shell running the test (never NEXT_PUBLIC_*).
The web/API processes do not need that key. No paid calls on page load.

Offline plan: `node --import tsx scripts/tripo-compare.mts`

After funding the **API** balance and obtaining the reference image:
`node --import tsx scripts/tripo-compare.mts --run /private/reference.jpg`

This explicitly submits up to five paid tasks, serially, one per requested model.
API balance must be positive; full batch affordability is not guaranteed because
legacy/P1 estimates remain unverified. It stops on provider errors without retries.
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

Standard textured image generation: H3.1 30 credits ($0.30 equivalent), P2 110
($1.10); current H3.0/H2.5/P1 list estimates left unverified rather than copying
retired V2 prices. One credit = US$0.01 equivalent. No first-ten-free API allowance
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

## Validation and deployment boundaries

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
