# Three-account avatar photo trial — 16 November 2026

Baseline `492edfe`. Tested the three supplied images as separate verified accounts
using the actual Profile upload, normalization, queue, installed Mac verifier,
private results and Admin UI. No production behaviour, threshold or permission
changed. All three stopped before paid generation; this is evidence for the
validation/notification stages, not a new end-to-end Seedream generation result.

| Photo | Original dimensions | Result | Next step shown |
| --- | --- | --- | --- |
| 1 | 578×1152 | Mac rejected: FEET | Upload another full-body photo with both feet visible. |
| 2 | 274×994 | Mac rejected: HANDS | Upload another photo with hands visible and away from the body. |
| 3 | 198×784 | Browser and backend rejected dimensions | Use an original photo at least 256px wide and 512px tall. |

The third image was not enlarged or bypassed. It created no job. The first two
were genuinely queued/claimed with separate leases and checked by the Mac. The
installed worker/helper source digests matched the current repository. Their
automatic rejections appeared in each account's Profile with Upload photo still
available. Admin showed the two private sources, rejection feedback, Not approved
and Not submitted, without a generation-approval action for either rejected job.
All accounts remained on the default avatar. No Tripo upload, task, balance query,
credit charge, real email or public journey/avatar assignment was made.

## Isolation and reproduction

The trial server refuses an existing database and accepts only an explicitly
enabled private directory below ignored data/. Environment isolation precedes
API imports, so even its default database opens in the trial directory. Three
random test sessions and a separate immutable test admin simulate already-verified
logins; this does not test OTP delivery. Provider/mail credentials are removed,
route alerts are off and generation's daily cap is zero. The real Mac worker
uses a separate temporary configuration/spool and test-only worker credential
through loopback SSH reverse forwarding. Its production LaunchAgent/configuration
is never edited or stopped.

```sh
# Pick a fresh private directory and keep the server running:
GUMWHEEL_AVATAR_PHOTO_TRIAL=1 GUMWHEEL_AVATAR_TRIAL_DIR=data/avatar-photo-trial-NEW node --import tsx scripts/serve-avatar-photo-trial.mts
# Build, then serve the frontend separately with the same target at runtime:
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 npm run build
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3491
# With Playwright and /usr/bin/chromium installed:
GUMWHEEL_AVATAR_TRIAL_DIR=data/avatar-photo-trial-NEW /tmp/gumwheel-ui-check-env/bin/python scripts/check-avatar-photo-trial.py --upload PHOTO1 PHOTO2 PHOTO3
```

For the Mac phase, copy only the trial worker.json into a newly created mode-0700
temporary directory, add a private spool path and use mode 0600 for the config.
Forward Mac loopback port 3496 to Pi loopback 3492 over the trusted SSH connection.
Run the installed `worker.py --config TEST_CONFIG --once` with the pinned Mac
runtime three times: two claims/checks and one empty claim. Do not use production
worker credentials or inject verdicts. Then run:

```sh
GUMWHEEL_AVATAR_TRIAL_DIR=data/avatar-photo-trial-NEW /tmp/gumwheel-ui-check-env/bin/python scripts/check-avatar-photo-trial.py --results
python3 -m unittest discover -s workers/avatar -p test_worker.py
npm run lint
```

The reproduction harness intentionally cannot spend. A future trial with a Mac
pass must separately exercise the existing admin approval and guarded generator;
do not set a passing verdict or lift gates to force a visual result.

## Verification and cleanup

Upload/result browser checks passed under three independent 390px accounts;
protected Admin review passed at 390/1440px. Own summaries never exposed another
job, and cross-account admin photo reads returned 403. User views acknowledged
their results. Whole Profile/Admin screens were visually reviewed for regular
feedback text, action spacing, contained source previews and no overflow/errors.
The seven Python gate tests, lint and optimized build passed.

Captured-transport notification checks used the actual reminder function on the
private queue and a disposable copy representing unread results: zero sends
before the five-minute boundary, one captured reminder per affected account when
unread, and zero duplicate reminders after Profile review. No real message was
sent. This does not verify inbox delivery.

The test API/frontend stopped after verification. Temporary Mac config/spool,
private queue copies and test credentials were removed. Private screenshots and
result metadata remain for review; supplied photos are not committed or published.
The [sanitized report](results/avatar-photo-trial-2026-11-16.json) retains source
revision/digests and corrected test-harness failures. No API restart or deployment
is needed for these verification scripts/docs. Physical devices, paid generation,
likeness, background removal and concurrent-user capacity remain outside this trial.
