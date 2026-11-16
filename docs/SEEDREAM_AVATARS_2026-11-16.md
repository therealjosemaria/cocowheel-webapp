# Seedream avatars and Pi-local matting — 16 November 2026

This release supersedes P2 for **new** avatar generation and the earlier
preview-only Seedream boundary. The owner also authorised replacing their existing
P2 assignment using the already paid-for Seedream result. No new paid generation
is needed for that replacement. Source baseline: `8f7a64b`; activation and exact
frontend deployment must be recorded separately after verification.

## Preserved verification and approval

Profile uploads, explicit consent, Mac visibility/standing checks, leases/retry
limits, supported rejection reasons and manual quality rejection are unchanged.
A Mac pass still leaves the photo APPROVED without generation permission. Only
the immutable owner-admin can approve a paid task. The five-minute unread
Profile/admin email fallback, cancellation, source TTL (seven days), job/private
preview TTL (30 days) and Personal avatar preference remain unchanged. Generation
never enables public display for a new account; successful replacements retain
the existing preference. Other accounts' assignments and trip history are untouched.

New tasks use POST `/v3/generation/image-to-image`, `seedream_v5`, 2K and PNG.
The shared production prompt preserves the person's face, clothing and shoes,
requests the full standing figure and a uniform white background. It does not
force the trial subject's suit, gender or colours onto other people. Seedream
has no supported transparent-background parameter, so no such parameter or
unsupported quality option is sent. The configured reservation is **5 credits /
US$0.05**. This is server configuration, not a live pricing query or a fee charged
to app users. Admin's existing manual Check balance/Refresh balance behaviour is
unchanged; its approval confirmation and cost snapshot show five credits.

## Local background removal

The Pi runs U²-Net human segmentation plus closed-form alpha matting and
multilevel foreground estimation. The semantic mask locates the person; matting
refines edges, and foreground estimation removes background-colour contamination
on partially transparent edges. This replaces the earlier near-white flood fill
for production. No image is uploaded to a second background-removal provider.
The Mac remains necessary for queued **photo verification**, and is not needed
for background removal after the photo has passed and generation is approved.

`server/avatar-background.ts` launches the Python helper as a separate process
at nice priority 10 with two CPU threads, without provider credentials in its
environment. The script imports only installed local packages, checks the pinned
model SHA-256, and never downloads models or writes photos during a request.
Bytes travel through stdin/stdout. Private output is normalized by the existing
transparent 128×256 WebP preparation and unchanged shared 48px map marker.
Already transparent still PNG/WebP outputs need no extra inference.

Limits: downloaded input ≤10 MB / 16M decoded pixels; the helper contains the
full frame within 1024×1536 before matting. Local address-space limit 3 GiB,
CPU limit 120 seconds, parent wall timeout 120 seconds and output bound 10 MB.
Runtime/model preflight has a 30-second timeout and runs only for an explicitly
approved job, before any provider request or credit spend. Inference is off the
API event loop; the existing one-active-generation guard prevents overlapping
local processing for the API's database. ONNX memory arena/pattern reuse is
disabled. Matting's factor allocation is bounded to at most eight million entries;
CG is limited to 1,000 iterations / relative tolerance 1e-5. Uncertain foreground
or invalid results fail closed, rather than publishing a rectangle or retrying a
paid task. These are resource controls, not a certified concurrent-user capacity.

Confident foreground colours are preserved; only partially transparent boundary
colours are decontaminated. This does not regenerate a face. In the owner's sample,
all 127,891 fully opaque output pixels matched the original RGB exactly. One sample
cannot guarantee likeness, intact fine detail or correct matting for every outfit,
hairstyle or background. Existing Mac checks remain estimates rather than identity
verification or a guarantee of output quality.

## Failure, cancellation and legacy tasks

Missing/invalid local runtime or model leaves the admin-approved job queued with
BACKGROUND_UNAVAILABLE and one-minute backoff, without contacting Tripo. A
segmentation/matting failure after a known paid task moves to REVIEW_REQUIRED /
BACKGROUND_REVIEW, retaining a private contained 512×768 WebP preview in the
existing render field. The current avatar remains assigned. Admin can inspect
that preview and task, then Cancel creation if a new photo is needed. No second
paid task or repeated heavy processing follows this review hold. Users retain
pending/last-completed-stage copy without internal runtime/provider errors.
Cancellation is rechecked after preflight, download and processing; late results
cannot revive a cancelled job or replace its avatar.

Additive nullable `avatar_jobs.generation_model` and `generation_credits` columns
pin each newly submitted task and reservation. Existing jobs are preserved.
Already-submitted legacy P2 jobs with null metadata resume their original task ID
and `rendered_image_url`; they are not regenerated or passed through the new
remover. Seedream uses `generated_image_url`. UTC daily accounting sums stored
reservations and counts legacy null reservations conservatively as 110 credits.
The 330-credit default monetary cap is unchanged; uncertain/failed/cancelled
submissions remain conservatively reserved. Existing ambiguity/4xx/poll/download
recovery rules remain in [avatar creation](AVATAR_CREATION.md).

## Setup and reproducibility

Run `bash scripts/setup-avatar-background.sh` explicitly on the Pi. It creates an
isolated ignored `data/avatar-cutout-runtime`, installs the fully pinned
`workers/avatar/requirements-background.txt`, downloads the public U²-Net human
ONNX weights once, verifies SHA-256 and runs local preflight. An existing model
with the wrong checksum is not silently replaced. Setup uses HTTPS; user requests
never install packages or download weights. Optional server-only overrides:
COCOWHEELS_AVATAR_CUTOUT_PYTHON and COCOWHEELS_AVATAR_CUTOUT_MODEL; blank values use
the documented ignored data paths. Actual production config need not change.

Model source: rembg's [human session/checksum](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2net_human_seg.py),
[U²-Net source / Apache-2.0](https://github.com/xuebinqin/U-2-Net),
[PyMatting / MIT](https://github.com/pymatting/pymatting).
Pinned model SHA-256: `01eb6a29a5c4d8edb30b56adad9bb3a2a0535338e480724a213e0acfd2d1c73c`.
The downloaded bytes also matched the maintainer's published MD5. Model weights,
private source/output images and runtime environments remain outside Git/public
assets. Package/model licence notices are retained with the runtime and in the
worker notices. Official Tripo [image parameters](https://developers.tripo3d.ai/en/docs/generation-image-to-image)
and [pricing](https://developers.tripo3d.ai/en/pricing) were checked for this release.

## Research, measurements and verification

On this ARM64 Pi with 7.9 GiB RAM, the human-only semantic mask completed in
3.223s at 448,128 KiB peak RSS but retained a visible light halo. With bounded
matting it completed in 3.970s at 819,648 KiB peak RSS and looked substantially
cleaner against dark and light surfaces. The actual Node-to-Python path measured
1.26s preflight plus 5.07s processing. These are one-image observations including
local model/processing work, not Tripo generation latency or broad quality evidence.

BiRefNet Lite was also researched (MIT source/model card) and tested locally.
Its fixed 1024px graph exceeded three-GiB and four-GiB virtual-memory guards,
including with arena/pattern caching disabled. It is not the production remover.
The first PyMatting attempt used the library's default 1.86-GiB factor allocation;
bounding it as above resolved that failure. No private image left the Pi and no
provider credits were spent during these tests. Failed baselines are retained in
the dated sanitized result rather than treated as successful trials.

`npm test` currently passes 299 isolated regressions, including six new tests for
Seedream payloads, local preflight before spend, legacy P2 recovery/costs,
background-review privacy and cancellation during local processing. The 52-check
security matrix passes. Lint and optimized build pass; responsive browser review
and production activation results are appended after completion. Physical devices,
paid generation through a newly uploaded production job and multiple simultaneous
cutout capacity are not covered by the one-photo local test.

Responsive verification completed: 14 optimized local cases pass across
320/390/1440px for Admin/approval/rejection/manual balance/gallery and 390/1440px
for Home/rider/driver maps. Whole affected mobile/desktop screens were visually
reviewed, including Privacy; marker sizes, typography and controls are unchanged.
Commands, source digests, failed baselines and exclusions are in the
[sanitized result](results/seedream-release-2026-11-16.json).

## API activation and owner replacement

At 2026-11-16T07:17:47Z, fresh accepted/active counts were zero before backup,
assignment and restart. A private database/config backup passed integrity checks.
Only the owner's P2 assignment was replaced with the refined, already paid-for
Seedream cutout; the existing enabled preference was retained. No provider call
or test job was created. Only cocowheels-api restarted; health returned 200.

All 142 rides and 18 other record tables were byte-for-byte unchanged; other
avatar rows and assignment count were preserved. New enabled sprite returned
200 with the expected bytes, superseded asset returned 404, database integrity
was ok with zero foreign-key violations, both nullable generation columns were
present and configuration was unchanged. The idempotent setup script passed
its pinned package/model verification and READY preflight. Exact frontend
deployment and public browser checks are recorded after push.
