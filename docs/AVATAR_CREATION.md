# Queued avatar creation — 16 November 2026

The later [three-account photo trial](AVATAR_PHOTO_TRIAL_2026-11-16.md) exercises
real browser uploads and Mac verdicts with three supplied inputs. Two failed
visibility checks and one failed upload dimensions; no new paid generation was
performed and no production validation criteria changed.

Source implements the missing self-service path after assigned-avatar display.
New jobs use **Seedream v5** with Pi-local segmentation/matting; this supersedes
the original P2-only selection. See [Seedream release](SEEDREAM_AVATARS_2026-11-16.md). Production activation and live
paid-generation evidence are recorded separately below. Funding for the original P2 implementation was explicitly deferred; current
funding follows the five-credit guard below. Do not label fake-provider tests
as live Tripo generations.

The later [manual admin workflow](AVATAR_ADMIN.md) supersedes automatic creation:
passing a Mac check never triggers generation without the owner-admin’s approval.

## Product flow

The public [photo guide](AVATAR_PHOTO_GUIDE_2026-11-16.md) is linked beside
Upload/Update photo and selected-photo requirements, including after rejection.
It opens in the same tab. An account-bound, in-memory draft preserves the
selected photo and submission UUID for returning via Back/browser history. The
return draft lasts 30 minutes from selection or a guide visit and clears on
Cancel/submission, identity changes, navigation outside Profile/the guide,
page exit or provider teardown. It is never written to session/local storage,
history state or a URL. A reload requires selecting the photo again. An existing
active job supersedes a restored draft; API checks remain authoritative. The
front-facing generic example and framing tips do not change validation thresholds or imply that every compliant photo will pass.

Profile → Avatar shows Upload photo even for an account without an assignment.
The Avatar heading icon and default preview reuse the guide’s front-facing
figure. Only that section’s generic artwork changes; assigned images and
journey/map role artwork retain their current sources and dimensions.
Assigned accounts have Update photo. Reuse the existing disclosure, preview,
checkbox, primary/secondary buttons, Edit/Save/Cancel, body/helper typography and
spacing. Upload preparation preserves the whole frame; it does not use the square
profile-photo crop. The preview is the photo to check, not a generated avatar.

Requirements: “Use a clear photo of just you standing, with your head, hands and
feet visible.” Beneath the requirements/guide link: “We’ll check that your photo
meets these requirements before creating your avatar and notify you with the
results.” Clicking Submit photo requests both checking and creation, sending the
existing required `consent: true`; merely selecting a file never queues work.
The separate creation checkbox is removed. This supersedes the earlier required
checkbox, not the server consent gate or manual admin generation approval.
Provider/data-use disclosures remain in Privacy; the upload section does not mention
Tripo or internal approval steps. Photos that pass still wait for explicit admin
generation approval before going to Tripo. Avatar creation never turns public
display on for a new account. Replacements preserve the existing Personal avatar
choice. The previous render remains until a replacement succeeds.

Queued/checking: “Your photo is queued for checking. We’ll notify you with the
results.” Approval: “Your photo passed the check. Your avatar is waiting to be created.”
Generation: “Your photo passed the check. We’re creating your avatar.” Completion:
“Your avatar is ready.” Automatic rejections name a supported uncertain region or pose
and offer another upload. Admin may also reject a passing photo before paid
submission, with required plain-text feedback shown in Profile and the same
five-minute unread result email. This supersedes the automated-reason-only
boundary; it does not change Mac thresholds. Provider errors and uncertain outcomes appear only to the admin; users keep
the last completed photo-check stage, without provider/credit diagnostics.
Submitted-job cancellation is admin-only at every stage, including before paid
submission and during operational holds. The former user cancel endpoint returns
403 without changing the job, source photo or notification. Users can still
discard a local selected photo with Cancel before submitting, and cancel unsaved
display-setting edits. Admin can cancel in-flight creation without a refund promise.
For submitted-photo assistance, Privacy provides the existing support email.
No 24-hour completion promise, false maintenance label or disabled action button.

Both roles use the same flow, regardless of published/accepted trips. Creation
does not alter journeys, acceptance or circular profile photos. The existing
map-avatar record and strict sprite routes supply map previews and maps.

## Validation and private storage

Client: still JPG/PNG/WebP ≤10 MiB, 32M decoded pixels, at least 256×512. Preserve
aspect ratio, contain within 2048×2048, JPEG quality .92, no EXIF/GPS; prepared
data URL ≤2.8M characters. Backend independently decodes with sharp's 32M-pixel
limit, checks format/single frame, rotates, flattens alpha, resizes without
enlargement, re-encodes JPEG 92 and checks ≥256×512 / ≤2,000,000 bytes. A process
guard bounds concurrent decoding. HTML/URLs/SVG/animations do not enter the queue.

Additive SQLite tables: `avatar_jobs`, `avatar_events`, `avatar_worker_state`
and `avatar_admin_events`; approval, hold and private-render columns extend jobs.
Photo BLOBs, hashes, submission keys and provider task IDs remain private. One
active job/account; same account/submission UUID and normalized photo is
idempotent. Reusing that key with different bytes fails. A new submission requires
an explicit Submit photo request with the required true consent flag. Missing or
false consent still fails server-side.

The later 16 November allowance counts three passing photos/account/rolling 24h,
superseding the earlier limit on all uploads. A job counts when its existing
APPROVED result event was created within the previous 24 hours and its current
status is not REJECTED. The count is by job (not event), anchored to the completed
check rather than upload time. Reviewing notifications, generation progress and
later cancellation do not reset a pass. Automatic check rejection, an admin's
manual quality rejection, runtime retries and cancellation before passing do not
consume the allowance. A prior model pass later rejected on review is excluded.
At exactly 24 hours after a pass, that pass no longer counts. Idempotent retries of
an existing submission return its state without counting or inserting another job.
The check remains atomic with insertion, scoped to the verified account; one active
submission still applies. Existing APPROVED events, including reviewed events,
make this effective for retained history without a schema migration/backfill,
Mac change, paid call or notification reset.

The existing global active/retained-photo cap of 25 remains and still includes
retained rejected photos, limiting source storage to approximately 50 MB plus
SQLite overhead. Rejection retries therefore remain subject to available storage.
The unchanged format/size gates and source/result TTLs below still apply. The
ordinary limit message is: “Three photos have passed the check in the last 24
hours. Try uploading again later.” It uses the existing regular upload alert and
does not promise that a full 24-hour wait is required after the failed attempt.

Allowance verification: 306 regressions, including three new tests for rejected
retries, manual rejection, pre-/post-check cancellation, account isolation,
idempotency and the exact rolling boundary, pass. Lint and optimized build pass.
The real isolated API accepts a fifth submission after four rejected checks and
blocks a fourth after three passes without inserting another job. Shared Profile
feedback is checked at 320/390/1440px for driver and rider (the rider error is a
browser stub, while driver quota enforcement uses the real fixture API). Whole
screens were visually reviewed for regular text, wrapping, shared actions and
spacing. No paid calls, real emails or production uploads were used. Reproduce
with `COCOWHEELS_DB_PATH=/tmp/avatar-pass-limit-tests.sqlite npm test`, `npm run lint`,
the local fixture build/setup in Private upload history below, then
`python scripts/check-avatar-pass-limit.py`. Physical devices and authenticated
production use remain unverified. See
[dated allowance results](results/avatar-pass-limit-2026-11-16.json).

Normalized source photos remain private for admin review for up to seven days
from submission, including rejected and generated submissions. Cancellation or
expiry erases local source bytes immediately. Remaining queued/checking/approved
jobs expire at seven days. Job metadata, private generated previews and cascading
user/admin notification records expire 30 days after the final job update.
Assigned sprite retention remains
unchanged. Backups/provider copies have separate retention; deleting local bytes
does not delete Tripo's copies. The Mac keeps a private temporary copy only for
checking; normal completion deletes it, and worker startup clears abandoned job
directories. An offline Mac cannot perform cleanup until it resumes.

## API and worker boundary

| Route | Contract |
| --- | --- |
| GET `/api/avatar/jobs` | Verified account's latest job, supported reason or admin reviewReason and unread key; never photo, lease, account selector or provider URL |
| POST `/api/avatar/jobs` | Verified account before/after decode; bounded photo, UUID, consent; body principal fields have no authority |
| POST `/api/avatar/jobs/cancel` | Retired user action: verified callers receive 403 / AVATAR_CANCELLATION_ADMIN_ONLY; no job mutation |
| POST `/api/avatar/jobs/reviewed` | Current owner's specific event only |
| POST `/api/avatar-worker/claim` | Separate 256-bit worker bearer credential; atomic oldest queued job + five-minute random lease + photo |
| POST `/api/avatar-worker/result` | Same credential plus matching unexpired job lease; approved/rejected/supported reason or runtime retry |

Existing Origin checks apply. Worker routes run before journey lifecycle handling;
they do not use a person's login, have no browser UI and never expose credentials
to Vercel/browser bundles. Worker authorization uses a constant-time comparison.
Full source-photo HTTP routes remain owner-admin-only; submitters can obtain only
small owner-scoped thumbnails through the history routes below. The admin
private/no-store photo/render routes are documented in AVATAR_ADMIN.md. Worker replies are private/no-store.

The Mac polls over HTTPS every 30s idle / 2s after work, with 30s request timeout,
3MB response bound and no credential-bearing redirects. Each check runs in a
separate process with a 60s limit, so an inference hang cannot stall the worker.
Completed verdicts now optionally report measured subprocess duration; receipt
and duration fields are admin-only. Older workers remain compatible. See
[check timing](AVATAR_ADMIN.md#check-results-and-timing) for exact boundaries.
Requests identify GUMWHEEL-Avatar-Worker/1.0 and accept JSON; Cloudflare rejected
the generic Python request identity during activation. No firewall/auth rules
were relaxed. An unavailable Mac leaves photos in the Pi's durable queue.
Expired leases requeue up to three claims; exhausted runtime retries hold the
photo for an explicit admin Retry photo check, while the user remains queued; stale,
cancelled or replayed results cannot approve a job. Runtime failures retry after
one minute and never cause a paid generation. One LaunchAgent runs while the Mac
user is logged in; it resumes after sleep/login. It does not promise processing
while the Mac is off or logged out.

### Private upload history

Profile's Avatar section adds an initially closed Upload history disclosure outside
the upload form, available to both roles. Opening it loads three submissions per
page, newest first with a deterministic ID tiebreaker. Newer/Older actions reuse
existing buttons. Each entry contains a small uncropped photo, submitted date/time,
outcome and the existing user-facing result/retake guidance. History has no edit,
delete, cancel, approval or generation actions and acknowledges no notifications.
Only the current result retains its existing visible-review behaviour.

GET `/api/avatar/history?page=0` requires verified login and selects only the
session owner's rows. GET `/api/avatar/history/:id/thumbnail` authenticates before
and after image processing and rechecks source availability before serving a
private/no-store, nosniff WebP contained within 160×240px. No photo enlargement,
crop, metadata, raw source download, provider error, task ID, lease, timing or
notification key enters the list. Another account, including the admin using the
ordinary endpoint, cannot read another submitter's thumbnail. The admin continues
to use its separately protected review routes. Only GET is supported here.

Thumbnails are derived on demand, never stored as a second copy. The existing
seven-day source TTL/cancellation removal applies; missing images say Photo removed.
Results remain for up to 30 days after their final update under existing cleanup.
Opening history runs that cleanup and does not renew either TTL. Invalid files
rejected before submission never enter history. History fetches only while open,
on page change, retry or latest-result change, without adding polling or provider
calls. Requests abort on close/unmount; stale replies cannot replace a newer page.
Privacy discloses private previews without internal worker/approval details.

Verification (16 November): 303 regression tests, nine worker tests on Pi and Mac,
lint and optimized build pass. The real Mac subprocess rejected a synthetic grey
image in 935ms using an in-memory fake queue, with no production API or paid call;
this is not a measurement of an earlier user's photo. History/Admin/approval/
rejection browser flows pass at 320/390/1440px against the real isolated API and
fake generation provider. Whole Profile and Admin screens were visually reviewed;
narrow-phone feedback spans the row. Physical devices, authenticated production
history, new real-user timing delivery and paid generation remain unverified.

Reproduce with `COCOWHEELS_DB_PATH=/tmp/avatar-history-tests.sqlite npm test`,
`python3 -m unittest discover -s workers/avatar -p test_worker.py`, `npm run lint`,
and `COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 npm run build`. For browser
checks, create a synthetic 400×800 JPEG at
`/tmp/gumwheel-avatar-upload-synthetic.jpg`; start
`COCOWHEELS_DB_PATH=/tmp/avatar-history-unused.sqlite GUMWHEEL_AVATAR_FIXTURE=1 GUMWHEEL_AVATAR_RENDER=public/brand/avatar-photo-guide-front-v1.webp node --import tsx scripts/serve-map-avatar-fixture.mts`
and `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3491`
in separate terminals after the build completes. With Playwright/Chromium installed,
run `python scripts/check-avatar-history.py`, `python scripts/check-avatar-admin.py`
and `python scripts/check-avatar-rejection.py` sequentially; stop both fixture
processes afterwards. The fixture strips provider/email credentials and uses
in-memory accounts. Never point it at production. See
[sanitized results and retained failed baselines](results/avatar-history-timing-2026-11-16.json).

Activation: implementation `af4fda7182d7b6c8fd166342e4e9d57c08fec6b8` is pushed.
At 2026-11-16T10:35:53Z, a verified private SQLite/config backup preceded a scoped
`cocowheels-api` restart after zero accepted/active trips and no in-flight avatar
work. Database integrity/FKs and terminal journey records pass preservation checks;
the additive timing columns exist. Mac source/tests match the release, private
backups match prior source, nine installed tests pass and the LaunchAgent is running.
The existing model helper matches source; deployment changes no credentials,
runtime or thresholds. A fresh Mac heartbeat reached the Pi after the update.
An initial post-install verification returned nonzero; a later read-only check
confirmed the already-updated files and settled runtime without repeating writes.

Vercel `dpl_5PNFA6VozJ65iAxLFzVPjbEAyi4V` is READY for that exact implementation
and assigned to both production domains. Public health is 200; anonymous history
and thumbnail requests are 401 and Admin list is 403. Production Privacy/history
copy and the Admin sign-in gate pass at 390/1440px with whole-screen visual review.
No production upload, paid test, real email or account/session impersonation was
used. The authenticated/fresh-user/physical-device boundaries above still apply.

### Mac photo check

`workers/avatar` is separate from Mirror PT. The copied standalone helper and
MediaPipe licence came from the supplied 14 November handoff. Reuses its existing
Mac Python 3.12 runtime with MediaPipe 0.10.21, Pose Full/model_complexity=1,
static images and minimum detection .5. Required groups keep visibility ≥.8 and
in-frame landmarks. One bounded closer-framing retry can improve distant subject
estimates, with the same threshold; points map back to the source coordinates.
The generation input remains the original normalized full-frame photo.

Additional conservative gates: one detected face (one closer head check if the
full-frame detector finds none), knee angles ≥155°, hip angles ≥150°, upright
torso within 30°, shoulder/hip/knee/ankle ordering, and head/foot edge margins.
These are uncalibrated visibility/pose proxies, not exhaustive person counting,
occlusion/identity verification or a guarantee of likeness. Shoes are allowed;
bare toes are not required. Unsupported/uncertain results request another photo.

## Generation, spend and recovery

The Pi's independent 15s avatar worker does not delay the existing journey email
worker. One locally active generation task at a time; provider tasks cancelled
locally may still be processing there. Generation selects only photo-approved jobs with persisted owner-admin approval.
Balance below **5 credits** leaves that explicitly approved work
queued without submitting; the row records INSUFFICIENT_CREDITS for the admin. Daily cap defaults to **330 credits / UTC day**,
configurable server-side; reservations include uncertain/failed submissions
conservatively. API credit spend is not charged to app users by this feature.

Use Seedream image-to-image, 2K PNG and a clothing/identity-preserving prompt with
a plain white background. The Pi checks its local runtime before any provider
call, then removes the generated background with human segmentation and alpha
matting. Legacy known P2 tasks still resume their original alpha render; their
reserved cost remains 110 credits. New jobs persist generation_model and
generation_credits on claim so the UTC cap sums reservations across both models. File upload
is not a paid generation. Persist `SUBMITTING` before the paid POST, then persist
its task ID; download/poll failures retry that ID, never regenerate it. An
ambiguous timeout/5xx or missing task ID enters REVIEW_REQUIRED. An interrupted
SUBMITTING state does the same after two minutes. Only a definite 4xx rejection
returns to the admin-approved queue with one-minute backoff and a private hold. Operator reconciliation
must inspect Tripo history before recovering a task ID; never clear this state
and resubmit blindly. The admin page exposes the task ID and review reason for that
exception. Inspect provider history before cancellation/new generation; there is
no blind resubmit or task-recovery override.

Requests time out after 60s; poll at 15s, failures back off 60s; after 24h a known
unfinished task requires review. The downloaded PNG/WebP result is bounded
to 10MB / 16M pixels. Opaque Seedream results pass through Pi-local segmentation
and matting, then the shared transparent 128×256 sprite normalizer. Uncertain
cutouts stop for private admin review with a generated preview; the current
avatar stays assigned and no paid task is repeated. Runtime/resource details
and recovery are in the Seedream release guide. Artifact HTTPS hosts are allowlisted, redirects rejected and API
Authorization is never sent to asset hosts. No GLB is made public or stored by
this path. There is no additional image-generator model or body-completion step.

References: [image generation](https://developers.tripo3d.ai/en/docs/generation-image-to-image),
[rate limits](https://developers.tripo3d.ai/en/docs/rate-limits),
[pricing](https://developers.tripo3d.ai/en/pricing),
[provider privacy](https://www.tripo3d.ai/privacy). Tripo's
[9 November notice](https://developers.tripo3d.ai/en/blog/asset-retention-policy)
announces a seven-day generated-asset retention limit effective 1 December 2026;
do not apply it retroactively or assume it establishes uploaded-photo retention.

## Notifications

Results appear in the Profile menu's existing badge/action style, separately from
Your journeys. Clicking Avatar update opens `/usual-route?avatar=1#avatar-result`,
including when Profile is already mounted. Viewing the specific result ≥60% for
700ms in a visible document and expanded Avatar acknowledges it server-side.
Opening Profile/the menu alone does not. Profile polls visible pages every 10s;
header uses its existing 10s identity cadence. Stale pre-mutation reads cannot
overwrite a save. Displayed new renders emit the existing map-refresh signal.

Approval, rejection, ready, cancellation and expiry create user result events.
Operational holds/failures create admin-only events; they do not send user error emails.
A newer stage supersedes the older event. Five minutes unreviewed triggers one
Resend email linking to the result, without photos, addresses or provider IDs.
Three transport attempts with 60s backoff, stable payload/idempotency key; stale
events expire after 24h. Reviews before the send claim suppress delivery; an email
already being sent cannot be recalled. This is a service update, separate from
matching-journey opt-in and without replacing journey notifications.

## Configuration and installation

Pi API environment (private `.env`, never NEXT_PUBLIC):

- `COCOWHEELS_AVATAR_UPLOADS=1`
- `COCOWHEELS_AVATAR_WORKER_KEY`: random 32-byte hex or equivalent; share only with the Mac worker
- `COCOWHEELS_TRIPO_CREDENTIALS_FILE`: absolute path to the existing 0600 credential file, or `TRIPO_API_KEY` in the service environment
- `COCOWHEELS_AVATAR_DAILY_CREDITS=330` (0 pauses generation)

Copy `workers/avatar` to a separate private Mac directory. Reuse the handoff's
known interpreter; do not modify the other project's runtime/coaching. Run
`install.py --runtime ABSOLUTE_PYTHON` with `{"origin":"https://www.gumwheel.com","key":"PRIVATE_WORKER_KEY"}`
on stdin via a secure pipe. The installer writes 0600 config/LaunchAgent files,
owner-only spool directory, and enables `com.gumwheel.avatar-photo-worker` in the
logged-in user's GUI domain. Keys/photos must not appear in shell output or Git.
`launchctl print gui/$(id -u)/com.gumwheel.avatar-photo-worker` checks its state.
The Pi `avatar_worker_state.seen_at` row records the last successful claim poll.
The installer verifies MediaPipe/Python versions and preserves the venv executable
path rather than resolving its symlink to the base interpreter.

Back up SQLite and restart only the API after verifying zero accepted/active
journeys. Frontend deployment alone cannot create the tables or activate workers.
Uploads may remain queued if funding/capacity/the Mac is unavailable; do not bypass
checks or submit a new paid task to make a demo look complete.

## Verification

Baseline `7ea10ed`. Commands:

- `npm test`, `npm run lint`, `npm run build`, `npm run test:security`
- `python -m unittest discover -s workers/avatar -p test_worker.py`
- Fixture: `GUMWHEEL_AVATAR_FIXTURE=1 node --import tsx scripts/serve-map-avatar-fixture.mts`
- Frontend: `COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 npx next dev --hostname 127.0.0.1 --port 3491`
- `python scripts/check-avatar-upload.py` (Playwright + `/usr/bin/chromium`; normalized private test photo at `/tmp/gumwheel-avatar-normalized.jpg`)

The explicit fixture uses synthetic accounts/in-memory SQLite. Its additional
3494 loopback controls reset only that fixture and run a fake Seedream provider; they
are never mounted by the application API. No paid tests or live user mutations.
Evidence, failed baselines and remaining boundaries:
[sanitized result](results/avatar-creation-2026-11-16.json).

Completed: 274 regression tests, 52 synthetic security checks, seven Python gate
tests, lint and production build pass. Browser flows pass at 320/390/1440px;
whole Profile and Privacy screens were visually reviewed on mobile/desktop.
The real Mac subprocess worker claimed and approved the private reference through
an encrypted tunnel to the isolated Pi API. No new Tripo task was submitted;
the owner deferred funding. Real reminder delivery and physical iPhone/Safari
uploads remain unverified. The Profile sibling-key collision was fixed with
section-specific keys; fresh console inspection has no unexpected errors.

## API and Mac activation

On 16 November a private SQLite/config backup completed, followed by an immediate
zero-accepted/active-trip check. Only `cocowheels-api` restarted. All 141 rides and
13 existing journey/profile/vehicle/avatar tables match their pre-restart records;
integrity is ok and foreign-key violations are zero. Three new avatar tables
exist, with no live jobs inserted for testing. Local health is 200; public anonymous
job reads are 401 and unauthorised worker requests 403.

The Mac LaunchAgent is running with the pinned existing venv and 0600 configuration.
Its actual authenticated production HTTPS claim succeeds; periodic Pi heartbeats
confirm the background instance is connected. Test photo/config copies created on
the Mac were removed. No paid Tripo task or live user photo was submitted during
activation.

Implementation `b8e0dc1214ae10a7f3f8d2d930d74696a0829f9a` is pushed to main.
Vercel `dpl_EaUkQP6ukbsGRCy7sbGzxUh3hNvh` is READY for that exact source and
assigned to www.gumwheel.com / gumwheel.com. Fresh public Chromium checks at
390/1440px confirm the new Privacy text and the existing signed-out Profile/menu
sign-in gate, without overflow or page exceptions. All non-GET/HEAD browser
requests were blocked. The first public harness expected Sign in outside its
closed menu; opening the existing Profile menu corrected that harness assumption.
Signed-in upload/generation controls were tested with the isolated actual API,
not a live user account. The Mac's production background heartbeat remains active.
