# Manual avatar administration — 16 November 2026

Supersedes automatic generation after photo checking in the initial avatar upload
release. Baseline `e6d9898`. Implementation and verification/activation evidence
are distinguished below. [Seedream/local matting](SEEDREAM_AVATARS_2026-11-16.md)
supersedes the original P2 parameters/cost. Avatar display, Personal avatar choice,
manual approval, journey permissions and trip history remain unchanged.

Later 16 November policy alignment supersedes submitter cancellation: only the
owner-admin cancellation endpoint may cancel a submitted job. The ordinary
`/api/avatar/jobs/cancel` endpoint rejects verified callers with 403, including
the submitter and admin using that ordinary endpoint. Profile has no submitted-job
cancel button. Its local draft Cancel and avatar-display Edit/Cancel are separate,
unsaved actions. User cancellation tests/results below describe older behaviour
where applicable; current regression evidence is in the photo-guide notes.

## Flow and owner controls

### Check results and timing

The photo verdict uses the shared monochrome accepted checkmark or rejected cross:
Photo check passed, Photo check failed, or Rejected on review for a manual quality
override. Generation/hold progress remains separate regular text. An unknown,
queued, cancelled or expired state alone never implies a passed photo check.

Each private row shows Submitted (the original user upload time), Checked (Pi
receipt time of a valid completed Mac verdict), and Check duration (seconds, one
decimal). New nullable INTEGER columns `checked_at` and `check_duration_ms` are
additive. Existing rows remain NULL; the UI says Not recorded rather than deriving
duration from queue/last-update timestamps. A new worker reporting no duration
still records receipt time. Pending checks also show Not recorded until complete.

The Mac worker uses a monotonic clock around the existing bounded check subprocess,
including Python/model startup, pose/face checks and any closer-framing retry.
It excludes queue wait, photo download/write, result delivery and paid generation.
`POST /api/avatar-worker/result` accepts optional `durationMs`: integer 0–60000 or
null/omitted. Bad metrics fail the transaction; completed pass/rejection stores
metrics only with a matching unexpired lease. Runtime retries do not record a
completed check. Later generation approval, rejection on review and cancellation
preserve the original check measurement. These fields are admin-only and never
enter user emails, upload history or public map responses. They are observations,
not a processing-time promise. The prior worker did not save duration, so the
last historical execution cannot be reconstructed accurately.

Implementation `af4fda7` has a verified guarded API restart, matching running Mac
worker, fresh worker heartbeat and exact-commit production frontend deployment.
See [activation evidence](AVATAR_CREATION.md#private-upload-history). Old timings
remain Not recorded; a fresh real-user timed result has not been generated for
deployment testing.

Verified users upload through Profile → Avatar. The Pi stores the normalized photo;
the Mac checks visibility/pose with the existing queue/lease rules. A successful
check puts the photo in APPROVED, **without generation permission**. Only the
immutable owner-admin (`jmos0905`, independent of public username) can explicitly
approve it in `/admin/avatar-management`. Approval stores time and principal and
is idempotent. No balance check, provider file upload or paid request occurs before
that approval, including for pre-existing APPROVED jobs upgraded from the old schema.
Already-submitted tasks continue polling; deployment does not undo previous spend.

The page is reachable from `/admin` and the owner's Profile notifications, with
Back above the heading. It shows active jobs first, then creation newest-first,
25 per page. Following a notification resets a later page to the first page.
A notification link brings that particular row first and scrolls to
it once. Source photo, generated preview, account name/email, status, approval time,
provider task reference and hold/error are shown in each row. No photo bytes, leases,
submission keys, provider credentials or private file tokens are serialized in lists.
The checker’s last successful heartbeat is shown as a timestamp, not a claim it is
currently online. The existing comparison stays separate at `/admin/avatars`.

Approve generation uses the existing sentence-only confirmation with the expected
5-credit Seedream charge. Thereafter funding/capacity recovery can resume that one
approved job without another click. Insufficient credits, disabled/daily cap,
balance/upload failures and retrieval errors are persisted on that job for Admin.
No automatic paid resubmission follows an ambiguous paid response. REVIEW_REQUIRED
shows the reconciliation reason/task ID; inspect Tripo history before cancelling
or starting again. There is no blind retry-generation or manual photo-check bypass.

Cancel creation is available for queued/checking/approved/submitting/generating/
review-required jobs. Confirmation explains an already incurred charge cannot be
undone here if submission may have started. Cancellation removes the local source,
invalidates the Mac lease and blocks assignment. A late provider task response can
record its ID but cannot revive the job. If already processing at Tripo, the task
may continue there; the app makes no provider-cancel/refund promise. Existing assigned
avatars remain. Cancellation is idempotent. READY/REJECTED/EXPIRED are closed.

Three unsuccessful runtime/lease attempts leave the photo queued with an admin-only
CHECK_UNAVAILABLE hold. Admin can explicitly Retry photo check; the same photo/TTL
is retained and the normal gates still apply. Valid photo rejection still tells
the user which requirement was uncertain and offers another upload.

Pi-local background failures add admin-only recovery: BACKGROUND_UNAVAILABLE
stops before a paid request; check the local runtime/model. BACKGROUND_REVIEW
stops a known task after generation, keeps its private generated preview and
leaves the assigned avatar unchanged. Inspect the preview/task before cancelling
for a new upload; no automatic second generation follows that failure.

## Manual photo rejection and Tripo balance

Mac failures remain automatic: supported rejection reason → REJECTED → user result,
without waiting for an admin action. A passed check remains APPROVED without paid
generation permission. Admin can choose Approve generation or Reject photo. Reject
photo reuses ConfirmationPrompt with a required Reason textarea (1–400 characters
after trimming and collapsing whitespace). The reason is plain text, not HTML;
disallowed control characters and invalid/non-text values are rejected server-side.
The safe Go back action precedes the destructive Reject photo action. Blank
validation preserves the draft/dialog; actions remain available before entry.

Rejection atomically changes APPROVED → REJECTED, records ADMIN_REJECTED plus a
separate rejection_note, clears generation approval and supersedes the passed-check
notification. The reason appears in the private admin row and only that user's
Profile/result email: “Your photo wasn’t approved. [reason] Upload another photo.”
Existing avatars remain assigned; a new photo can be submitted subject to the
existing upload/storage limits. Under the later passing-photo allowance, this
manual quality rejection also excludes the photo from the three-pass rolling
24-hour count; automatic rejections never consume a slot. Source retention remains seven days; rejection
metadata/events retain the existing 30-day lifecycle. An identical retry does not
repeat or acknowledge the user's result. A different reason/stale approval returns
409; late Mac responses cannot revive it.

Rejection is also allowed after generation approval while still APPROVED, including
a funding hold. The generator's existing conditional claim prevents a rejection
during balance/file upload from becoming a paid submission. Once SUBMITTING,
GENERATING or REVIEW_REQUIRED, rejection returns AVATAR_REVIEW_TOO_LATE; Admin is
directed to Cancel creation to stop local delivery. Cancellation cannot undo a
provider charge. This is a photo-quality decision, not a retrospective refund or
identity verification. Automated Mac thresholds are unchanged; the later Seedream release changes only
generation/processing settings.

The private balance section queries Tripo's read-only GET `/v3/account/balance`,
showing available credits, US-dollar equivalent, optional reserved credits and the
time checked. The configured Seedream task uses 5 credits. The API response
contains only availableCredits/frozenCredits/checkedAt, never credentials or raw
provider errors. Successful and failed balance reads share an in-memory 30-second
cache; concurrent reads coalesce. Provider timeout is eight seconds. Failure shows
Unavailable with Refresh / Top up controls, without presenting a stale amount as
current or preventing submission review. The former page-entry/focus/60-second
balance refresh is superseded by the manual controls below. This is a
timestamped snapshot, not a reservation or a guarantee the next job is funded.
No balance request uploads photos or starts generation. Owner authorization is
checked both before and after the awaited lookup; responses are private/no-store.

Top up Tripo opens the official API pricing page's Buy credits destination in a new
tab, allowing sign-in there. It does not top up or spend from GUMWHEEL. Verified
official references: [billing API and credit units](https://developers.tripo3d.ai/en/docs/billing),
[API pricing / Buy credits](https://developers.tripo3d.ai/en/pricing). The documented
December 2026 console display change does not change API credit units. The API
account and Tripo Studio have separate billing; this link targets API funding.

## Manual dashboard checks

The later 16 November frontend refinement makes Check balance the only trigger
for the dashboard's balance request. No request runs on mounting, login, returning
to the tab, visibility changes, list updates, pagination or timers. Initial view
contains Check balance and the existing Top up Tripo link, without placeholder
metrics. The configured model/5-credit cost, checker's last connection and balance
fields appear only after the owner's click. These are frozen snapshots: submission
polling cannot change their displayed values. Refresh balance explicitly captures
the latest locally received list metadata and requests balance again. The cost is
server configuration, not a live Tripo pricing query. The heartbeat timestamp is
the latest received observation, not a fresh probe of the Mac.

Overlapping clicks share the in-progress request; unmount aborts it and prevents
state updates. Lookup failures clear the displayed amount and retain Refresh /
Top up recovery controls. Reloading/navigation resets the panel to unchecked;
no balance or cost snapshot is persisted in cookies/storage. The existing private
endpoint, eight-second timeout and 30-second server cache remain unchanged, so
repeated clicks within that cache window may show the same checked timestamp.

Avatar submission notices/list updates still use their existing local API cadence
(ten seconds while visible, plus focus) and never contact Tripo's pricing/balance
endpoint. They are separate from this manual panel. The background generator
still verifies funds before an admin-approved paid submission and can recheck a
funding hold on its existing backoff; disabling that spend guard is outside this
dashboard-only change. No backend/schema/permissions/provider settings change,
and no API restart is needed.

Verification: `scripts/check-avatar-manual-balance.py` passes at 320/390/1440px
against the optimized build, asserting zero automatic requests beyond the former
refresh interval, one request for overlapping manual clicks, frozen metadata,
failure recovery and no reload request. The existing rejection/Profile browser
flow also passes at those widths; lint/build pass. Whole initial/checked/failure
Admin screens and populated review screens were visually reviewed on phone and
desktop. Synthetic services use no real Tripo/email credentials. No backend
suite was rerun for this frontend-only change. See
[commands, evidence and fixture failure/retest](results/avatar-manual-balance-2026-11-16.json).
Authenticated production owner use and physical Safari remain unverified.

Deployment: implementation `34c5c0358f020657c54248fa41beae8122d5df5e` is pushed;
Vercel `dpl_3NhDHKMjjAw6QPFjDY9ab5Kpps67` is READY for that exact commit and
assigned to www.gumwheel.com / gumwheel.com. Recorded source hashes match the
tested implementation. No API restart or production test mutation was performed.

## User-facing status

Users see queued/checking, photo passed and waiting to be created, actual generation,
and ready. Operational holds/provider review reasons never appear in their response
or result emails; REVIEW_REQUIRED projects to the photo-approved waiting stage.
A hold does not pretend generation is running. A source that reaches the seven-day
TTL expires with the existing re-upload guidance. Cancelled jobs say creation was
cancelled and offer another upload. Source photos are not exposed to other members.

On completion, the normalized transparent sprite is assigned using the existing
shared map-avatar path and retained as a private per-job admin preview. New accounts
stay opted out of public avatar display; replacements preserve the saved choice.
The user can preview/enable their available avatar in Profile. No further release
click is required after generation; no new paid call is used for an admin preview.

## Notifications and email

Each received photo creates a SUBMITTED admin event. Passing the Mac check creates
a distinct VERIFIED event saying generation needs approval. Rejection/expiry/
operational changes also create admin updates. The later 16 November completion
policy supersedes the former READY update: successful generation clears that
job's outstanding Admin events and creates no Admin completion badge or email.
Its Ready status, source photo and generated result remain on the same row. Other
jobs' pending approvals/errors are unaffected. Startup marks old unread Admin
READY events reviewed; the email sender also excludes READY. Previously sent
mail cannot be recalled. User READY events and five-minute emails are unchanged.
Only the newest stage of a job needs
review; newer stages supersede older unread events to avoid redundant reminders.
Repeated polling of an unchanged hold creates no duplicate event. Recovery clears
hold reminders before they can send stale error notices. Admin cancellation
notifies the submitter; ordinary users cannot cancel a submitted job.

Profile polls the owner-only notice endpoint on its existing ten-second cadence,
and adds an Avatar submissions action/count using the existing badge/card. Other
accounts do not request or receive these notices. Menu opening is not acknowledgement.
Viewing the specific row's status ≥60% for 700ms in a visible document acknowledges
that admin event server-side. Approving/cancelling also resolves that row’s events.
User result review and admin review are separate and cannot clear each other.

An unreviewed latest event is eligible for one email after five minutes through
existing Resend transport; review before the claim suppresses it. Three attempts,
60s backoff, stable persisted payload/idempotency key; after 24h email eligibility
expires but the in-app admin notice remains. The recipient is the existing immutable
admin account's verified university mailbox, not a public username or new contact
address. Emails contain a link/status only, never the submitted photo or provider
credentials. An already sending email cannot be recalled. User result emails retain
their own five-minute fallback, without operational diagnostics.

Profile's existing Avatar controls poll while visible every ten seconds and on
focus/visibility return. The completed result updates status and availability
without navigation/reload; a changed preview URL dispatches the existing shared
avatar-saved event. It does not automatically enable a new personal avatar or
change a saved display choice. This is periodic refresh plus network latency,
not a server-push or guaranteed immediate delivery. Admin also retains its visible
list polling/focus refresh; source and generated figures use the existing two-column
contained-image layout. The source follows seven-day retention; the generated
per-job preview follows 30 days after final update. Photo removed can therefore
appear alongside a retained generated avatar later.

### Preview resolution diagnosis

The later [resolution/rendering implementation](MAP_RENDERING.md) remedies
AVATAR-PREVIEW-001 with a lossless private processed-resolution preview, separate
bounded map variants and guarded no-generation recovery. Evidence below records
the original failed baseline; the dated rendering result records the retest.

One current completed Seedream result was read privately from its existing task,
without creating a paid task or modifying an account. The generated PNG was
832×1248. Re-running the existing Pi background removal retained 832×1248;
144744 fully opaque pixels and a 3780-pixel interior face patch had zero changed
RGB pixels. The final `prepareAvatarSprite` trim/resize/WebP step produced 128×256
and byte-for-byte reproduced the saved result (7566 bytes). The Admin generated
preview and Profile preview currently serve that same small map sprite. This
explains substantial facial-detail loss when compared with the larger result.

The earlier private comparison image is 768×1344 and that comparison page serves
the full image, rather than the normalized map sprite. Mac checking only validates
the uploaded photo's pose/visibility; it does not generate this avatar. The
evidence identifies final application sizing on the Pi, without showing a hardware
or background-matting failure. It does not assess every possible input/model.

Historical finding AVATAR-PREVIEW-001: retain a bounded higher-resolution private
generated preview separately from the efficient map sprite, and choose its
retention/serving contract before implementation. This was proposed at the
diagnostic revision; the later rendering implementation supersedes that boundary.
Private photos, provider URLs, task/account identifiers and diagnostic image
files are not committed. See [sanitized verification](results/avatar-completion-2026-11-16.json).

Completion verification: 308 regressions, including two new completion/email and
legacy-ready cleanup cases, plus lint and optimized build pass. The isolated
browser/API flow in `scripts/check-avatar-admin.py` passes at 320/390/1440px:
both Admin figures stay visible, no Admin success update is created, and a user
Profile left open sees Ready/available controls without reload, navigation or a
manual focus event. Enabling the unsaved preview works immediately; Cancel keeps
the saved display preference. Visible result acknowledgement clears the user's
unread result, preserving the existing email suppression protocol. Whole Admin
and Profile screens were visually reviewed for existing typography/spacing.

Reproduce with `COCOWHEELS_DB_PATH=/tmp/avatar-completion-tests.sqlite npm test`,
`npm run lint`, and the local optimized fixture build/setup in
[upload history](AVATAR_CREATION.md#private-upload-history), followed by
`python scripts/check-avatar-admin.py`. The fixture uses synthetic accounts,
fake generation and no email/provider credentials. The quality diagnosis used
only GET retrieval of an existing completed task and a single local cutout run;
it did not change the live assigned avatar. Live authenticated generation,
physical browsers and the proposed resolution change remain unverified.

Activation: implementation `a3986d5df775e23646d2c20887edde95b68608e5` is pushed.
At 2026-11-16T11:32:59Z, the verified private database/config backup and fresh
zero accepted/active-trip / zero in-flight-avatar checks preceded the scoped
GUMWHEEL API restart. Integrity/FKs and terminal journey preservation pass;
all assigned avatar rows/bytes match the pre-restart backup. No unread Admin
READY events remain. The diagnostic images/identifiers created in `/tmp` were
removed after analysis; only sanitized measurements were retained.

Vercel `dpl_DRbFkzSmE3skjkUZkQPvqhBgif7j` is READY for that exact commit on both
production domains. Public health is 200; anonymous avatar-job reads are 401 and
Admin-job reads 403. No new paid generation or authenticated production
walkthrough was performed for release verification; the higher-resolution
preview finding remains open.

## Storage, access and activation

Additive job columns: generation_approved_at/by, hold_reason, render BLOB and
rejection_note (the latter added for manual quality review).
New avatar_admin_events table cascades with jobs. Existing APPROVED jobs remain
unapproved on migration; in-flight paid tasks retain their state. Pending legacy
jobs receive one admin notice. No journey table or login identity is migrated.

Normalized source photos are admin-readable for up to seven days from submission,
including after rejection/generation. The existing 25-job limit also counts retained
source photos, bounding them to approximately 50 MB plus SQLite overhead.
Cancel/expiry clears them immediately; the
15s maintenance pass prunes other source bytes. Metadata/private generated previews
and cascading user/admin events expire 30 days after the job’s final update.
Assigned account sprite retention and backups/provider copies are separate. Privacy
and upload consent copy describe review/approval; source photos remain outside Git,
public assets, email and general discovery.

All routes below require the current owner cookie. Writes additionally require the
existing allowed Origin and X-Admin-Request: 1 and recheck that session after body
reading. Auth runs before ID/asset lookup, including nonexistent IDs. Responses
are private/no-store; photo/render bytes have fixed JPEG/WebP types and nosniff.

| Route | Behavior |
| --- | --- |
| GET `/api/admin/avatar-jobs?page=0&job=ID` | Bounded metadata list, optional focused row |
| GET `/api/admin/avatar-jobs/notifications` | Owner-only count/link |
| GET `/api/admin/avatar-jobs/balance` | Owner-only cached read-only Tripo balance |
| GET `/api/admin/avatar-jobs/:id/photo` | Private normalized source if retained |
| GET `/api/admin/avatar-jobs/:id/render` | Private per-job generated preview |
| POST `/api/admin/avatar-jobs/:id/approve` | Verified photo → persisted generation permission |
| POST `/api/admin/avatar-jobs/:id/reject` | APPROVED → REJECTED with required reason, revoking permission |
| POST `/api/admin/avatar-jobs/:id/cancel` | Stops local processing/assignment; no provider refund promise |
| POST `/api/admin/avatar-jobs/:id/retry-check` | Explicit restart of an exhausted Mac check |
| POST `/api/admin/avatar-jobs/reviewed` | Acknowledges that admin event only |

Source changes need a backed-up API restart after confirming no accepted/active
journeys. Frontend push alone does not activate the new gate/schema.

## Reproduction and evidence

- Quality-review/balance extension: `npm test` passes 290 regressions; the targeted
  avatar command below passes 23. All 52 security checks, lint and production build
  pass. `scripts/check-avatar-rejection.py` passes at 320/390/1440px in development
  and the optimized build; existing admin/upload browser scripts pass at the same
  widths. Whole Admin, shared rejection dialog, owner Profile and Privacy were
  visually reviewed. The script expects a private full-body fixture at
  `/tmp/gumwheel-avatar-normalized.jpg`; photos/screenshots stay outside Git.
  Strict standalone TypeScript retains 28 existing diagnostics in untouched tests;
  no avatar/production-source diagnostics remain. Read-only real balance succeeded;
  new paid generation, real inbox delivery, physical Safari, authenticated
  production owner flow and signed-in Tripo checkout remain unverified.
  See [new evidence and retained failed baselines](results/avatar-review-balance-2026-11-16.json).
- `node --import tsx --test tests/avatar-admin.test.ts tests/avatar-jobs.test.ts`
- `npm test`, `npm run lint`, `npm run build`, `npm run test:security`
- `GUMWHEEL_AVATAR_FIXTURE=1 node --import tsx scripts/serve-map-avatar-fixture.mts`
- `COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 npx next dev --hostname 127.0.0.1 --port 3491`
- `/tmp/gumwheel-ui-check-env/bin/python scripts/check-avatar-admin.py`
- `/tmp/gumwheel-ui-check-env/bin/python scripts/check-avatar-upload.py`
- `/tmp/gumwheel-ui-check-env/bin/python scripts/check-avatar-rejection.py`

The preceding manual-approval release used synthetic accounts, in-memory SQLite, explicit loopback controls,
fake generation and no provider/email credentials. No paid task/live submission is
needed. Its 283 regressions, 16 avatar tests, 52 isolated security checks, lint and the
production build pass. Optimized browser flows pass at 320/390/1440px; existing
admin sign-in passes at 320/390/844/1440px. Whole mobile/desktop Admin, Profile
and Privacy screens were visually reviewed. New live paid generation, real inbox
delivery, physical Safari and authenticated production walkthrough remain unverified.
See [sanitized evidence and retained failed baselines](results/avatar-admin-2026-11-16.json).

## API activation

Quality-review/balance extension activated at 2026-11-16T05:09:04.577Z after a
new private online SQLite/config backup and fresh zero-underway-trip check.
Only `cocowheels-api` restarted. The rejection_note column exists; all 142 rides
and 19 checked journey/profile/account tables match the backup. Integrity is ok,
foreign-key violations are zero and configuration is unchanged. Local/public
health are 200; anonymous balance is 403. No live avatar test job was created;
new paid generation/inbox delivery remain untested. Frontend deployment for this
extension is verified separately after its exact commit reaches production.

At 2026-11-16T04:36:23.528Z a private online SQLite/config backup passed integrity
checks, followed by a fresh zero-accepted/active-trip check and restart of only
`cocowheels-api`. All 142 rides and 19 journey/profile/account tables matched the
backup. Integrity is ok, foreign-key violations are zero, the four approval/hold/
render columns and admin events table exist, and runtime configuration is unchanged.
Local/public health return 200; anonymous management/photo requests return 403.
No live avatar test job, paid task or reminder email was created. Frontend
deployment is recorded separately after the exact commit is verified.

## Frontend deployment

Quality-review/balance implementation `fa678d3a45e1aa63cf6875c7f3b29896111a0fd7`
is pushed to main. Vercel `dpl_8LdmTmR8Zu1YiVmGSKamkwEHd3QL` is READY for that
exact commit and assigned to www.gumwheel.com / gumwheel.com. Fresh read-only
Chromium checks at 390/1440px confirm the OTP gate, no private records/balance,
403 for anonymous list/notices/balance/photo/render, and the new Privacy copy.
No exceptions/overflow; all non-GET/HEAD browser requests blocked. The exact
deployment's 15-minute error/fatal log query returned no groups. A fresh Mac
heartbeat (16 seconds old) was observed. Private review actions were tested on
the isolated actual API; live paid generation and inbox delivery remain unverified.

Implementation `b6470e24bc69b5cb4a5c79e56935c1d4771d72be` is pushed to main.
Vercel `dpl_49Kxtsr151nfALMPM1Uydc6V8RQa` is READY for that exact commit and
assigned to www.gumwheel.com / gumwheel.com. Fresh public Chromium checks at
390/1440px confirm the email/code admin gate, no private photo/list content,
403 for anonymous list/notices/photo/render requests, and the new Privacy copy.
All non-GET/HEAD browser requests were blocked; no page exceptions or overflow.
The exact deployment’s 15-minute Vercel query returned no error/fatal log groups.
A fresh Mac heartbeat was observed after activation. Private owner workflows
were verified against the isolated actual API, not by uploading a live photo or
spending credits. Live inbox delivery and physical Safari remain unverified.
