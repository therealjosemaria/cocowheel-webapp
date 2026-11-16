# Avatar photo guide — 16 November 2026

Baseline `0533a6c`. A public static `/avatar-photo-guide` page supports Profile’s
Avatar upload area. Photo guide appears once beside initial Upload photo,
Update photo, rejected-result recovery and selected-photo requirements. It uses
an ordinary underlined link, accessible new-tab name and noopener/noreferrer.
Opening it leaves the existing tab’s photo and submission ID intact.
Queued jobs and avatar-display editing keep their existing controls. No new modal,
upload endpoint, storage, checker threshold, pricing or admin approval rule.

The entry is in the relevant Avatar section, without a main-menu/footer/Privacy/
Terms addition. Anyone can read the guide without signing in. Its Back link goes
to Profile’s Avatar section. Clean canonical/social metadata and the public
sitemap include the guide as a seventh information page; private pages retain
their noindex/authorization rules. Historical six-page search evidence is
superseded only for the current allowlist, not rewritten as a seven-page test.

## Content and presentation

The guide shows a relaxed, front-facing generic figure inside a centred portrait
frame. Transparent margins and a faint grid demonstrate room around the head,
both hands and both feet. The original map waiting-person artwork is unchanged.
The caption is “Leave space around your whole body.” Four tips say:

- Stand upright and relaxed, facing the camera.
- Keep your head, both hands and both feet visible, with space around them. Hold
  your hands slightly away from your body.
- Use good, even light and a plain background. Avoid blur, other people and
  objects covering your body.
- Upload the original photo rather than a screenshot or tight crop.

The file line repeats actual client limits: JPG/PNG/WebP, up to 10 MB, at least
256px wide and 512px tall. Existing backend normalization and independent guards
remain unchanged. The example is a framing aid, not a photograph or proof that
every pose/image will pass automated visibility estimates.

Back/H1 align left. Existing Help/body/link/control tokens are reused; body tips
remain regular weight. The 240px-max 2:3 frame uses line/surface-subtle/control
radius tokens and a 20% grid. The entire 128×256 figure fits with clear margins.
Phones stack example/tips; 700px+ uses two columns. Profile has no extra example
image, long tips or duplicated requirements after rejection.

## Artwork provenance

`public/brand/avatar-photo-guide-front-v1.webp` is a new guide-only asset from the
built-in image-generation tool, using the existing shipped
`public/brand/journey-person-standing-v2.webp` as its edit target. No customer
photo or Tripo generation was used. The original generated alpha PNG is preserved
in the image tool’s output directory; the project copy is normalized with sharp
to 256×512 transparent WebP (quality 90, alpha 100), without semantic retouching.
Its tested alpha range is 0–255. Maps/default previews keep their original sprite.

Final built-in prompt:

> Use case: precise-object-edit. Asset type: a GUMWHEEL avatar-photo-guide illustration. The supplied image is the edit target: our existing generic, featureless grey 3D waiting-person mannequin. Repose and turn ONLY this same mannequin into a perfectly straight-on front view, facing directly at the camera. Preserve its matte grey featureless head, grey casual jacket, light plain shirt, grey trousers, dark grey shoes, soft polished 3D shading, realistic adult proportions and the same visual style. It must stand upright but relaxed, shoulders level, arms naturally down and slightly away from the torso with clear small gaps between both hands and hips. Both complete hands must be clearly visible, fingers naturally relaxed, not in pockets, no objects. Both legs and entire shoes visible, feet comfortably apart and equally facing forward. Full body centred, head to toe, no turning, no three-quarter angle, no walking, no dramatic pose. Leave generous empty margins on every side. Portrait composition. Truly transparent background with alpha, no ground, no ground shadow, no checkerboard, no frame, no text, no watermark. This is only a generic framing example, not a real person's portrait.

## Verification

Optimized build and lint pass. All six named SEO regressions pass, covering the
seven-page public allowlist and unchanged private matching-entry rules. The first
sandboxed TypeScript test invocation reported file completion without the named
assertions; rerunning with the loader’s process permissions executed all six.
That first result was not counted as full test coverage.

`scripts/check-avatar-photo-guide.py` passes at 320/390/844/1440px against the
optimized isolated frontend. It verifies unsigned guide access, image decoding,
24px+ surrounding margins on all four sides, aligned Back/H1, canonical/robots/
sitemap, Upload/Update/rejected-state links, new-tab photo retention,
no avatar upload writes, and no page exceptions or horizontal overflow. The
source tab’s unchanged photo state retains the existing submission UUID;
no new submission ID or consent handler was added by the guide link.

Whole guide and Profile screens (initial, selected, rejected and assigned) were
visually reviewed on phone/desktop for front-facing pose, margins, subtle grid,
regular body/link weight, clear H1/H2 hierarchy, tips and action spacing. React
review: static server page, no extra client state/hooks/listeners, no provider
calls; existing Profile cleanup and submission guards remain.

Reproduce with synthetic fixtures only:

```sh
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 npm run build
# Separate terminal; the shipped guide art is sufficient as a test assignment:
COCOWHEELS_DB_PATH=/tmp/gumwheel-guide-unused.sqlite GUMWHEEL_AVATAR_FIXTURE=1 GUMWHEEL_AVATAR_RENDER=public/brand/avatar-photo-guide-front-v1.webp node --import tsx scripts/serve-map-avatar-fixture.mts
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3491
# Create /tmp/gumwheel-avatar-guide-photo.png as a synthetic 512×768 PNG, then:
/tmp/gumwheel-ui-check-env/bin/python scripts/check-avatar-photo-guide.py
node --import tsx --test tests/seo.test.ts
npm run lint
```

The browser script uses verified synthetic owner/driver sessions and one mocked
rejection, not live account data. No paid generation or real email was sent. A
manual front-facing artwork correction supersedes the first side-facing guide
preview; map artwork remains unchanged. Physical devices and authenticated
production upload use remain unverified. This frontend/static page change needs
no API restart; exact frontend activation is recorded after push.

## Follow-up: one submission action

The user subsequently removed the extra creation checkbox. Requirements and the
Photo guide link remain above this regular-weight sentence: “We’ll check that
your photo meets these requirements before creating your avatar and notify you
with the results.” Submit photo requests checking and creation through the same
required `consent: true` API contract; selecting a file alone submits nothing.
The checkbox-specific assertions from the first guide run are historical and
superseded; the current browser checks assert its absence and draft retention.
Manual admin approval, photo checks, provider boundaries and notifications remain
unchanged. No API restart is required for this frontend submission simplification.
Provider/data-use details remain in Privacy; internal approval steps are documented in this repository. Final follow-up checks and activation
are recorded below.

Follow-up verification, baseline `97a740e`:

- `node --import tsx --test tests/avatar-jobs.test.ts tests/avatar-admin.test.ts tests/seo.test.ts`: all 29 named tests pass, including false consent rejection, manual generation gates, notification review/delay and private access.
- `npm run lint` and the optimized `COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 npm run build` pass. The first restricted build could not bind Turbopack's local worker port; rerunning with local process/socket access passed. This was a sandbox limitation, not a product failure.
- With the isolated fixture commands above, `scripts/check-avatar-photo-guide.py` passes four widths (320/390/844/1440). `scripts/check-avatar-upload.py` passes 320/390/1440 against the real API and a fake provider: no POST on file selection; one Submit photo request with the required true flag; persisted queue, rejection/unread result/deep link, passed check, explicit admin approval, generated assignment and display Save. Both sample files are synthetic solid-colour images, not customer photos. Create `/tmp/gumwheel-avatar-upload-synthetic.jpg` as a 400×800 JPEG before running the upload script.
- Whole Profile screens were visually reviewed on phone/desktop: requirements and guide remain separate from the regular-weight process sentence, existing Submit/Cancel controls retain their spacing, and Personal avatar's display checkbox is unchanged. Privacy's updated avatar paragraph was reviewed at 390/1440 with existing body weight and no horizontal overflow. The initial Privacy capture attempt occurred after the fixture had shut down; reopening the isolated fixture allowed both captures.
- React review: removed unused consent state/guard, no new effects/listeners, no submission on selection or guide navigation, unchanged submission UUID/reconciliation/duplicate-submit guard. No schema, backend permission, provider configuration or notification-timing change.
- No real emails, paid requests or production account writes. The real Mac/photo likeness and physical Safari/Android devices were not exercised by this UI change. The photo-trial script's obsolete checkbox selection is updated but the private three-photo trial was not rerun.

Initial guide commit `97a740efa63a42e8673e678bcfd3f80ce26d1179` reached READY
as `dpl_4uvFV621YEx5nyEzHF4fz86pWrnQ`, aliased to both public domains.
The submission follow-up's exact activation is recorded after its push.

## Policy review: submitted-job cancellation is admin-only

Supersedes the earlier submitter-cancellation behaviour and the UI-only “no API
restart” boundary above. The policy audit covered Profile/draft/queued/passed
controls, user result messages, Privacy, Terms, Help, public photo guide, API
permissions and current README/creation/admin/UI guides. Terms/Help cancellation
answers refer explicitly to journey requests/rides, not avatar submissions, and
remain unchanged. Historical dated result reports are preserved as earlier evidence.

Profile has no Cancel photo check / Cancel creation action after submission.
The ordinary POST `/api/avatar/jobs/cancel` requires sign-in and then returns
403 `AVATAR_CANCELLATION_ADMIN_ONLY`, regardless of actor/job state; no former
owner-cancel helper remains. Legacy clients get a support-email next step. Only
`/api/admin/avatar-jobs/:id/cancel` retains cancellation, with its existing immutable
owner-admin authorization, confirmation, photo removal, lease invalidation, late
result protection and user notification. Admin does not gain a user-route bypass.
Local draft Cancel and unsaved Personal avatar Edit/Cancel remain available.

Privacy removes the inaccurate user cancellation claim and internal worker,
background-removal and manual-approval steps. It retains meaningful disclosures:
submission purpose, requirements review, Tripo as image recipient, private admin
review access, seven-day source/30-day result retention, independent backup/provider
copies, support email, public display choice and five-minute unread result email.
Profile's requirements/process sentence and guide remain unchanged.

Verification on the policy follow-up (baseline `76c1386`):

- Build and lint pass. All 35 named avatar jobs/admin/Seedream/SEO regressions pass; all seven avatar API tests pass again after the final denial-before-expiry guard and admin-on-user-endpoint assertion. Eight synthetic job phases reject user cancellation with 403 and preserve job/photo state; an overdue source also remains unchanged on that denied request. Unauthenticated access is 401. Existing immutable-admin cancellation, photo erasure/lease invalidation, user result event and generation cancellation-race tests pass.
- The isolated optimized browser fixture passes the guide flow at 320/390/844/1440 and the actual upload/API/fake-provider flow at 320/390/1440. Queued/passed states have no submitted-job cancel action; draft Submit/Cancel and display Edit/Save/Cancel retain their own responsibilities. No paid calls, production accounts or emails are used.
- Whole Profile states and the final Privacy avatar paragraphs were visually reviewed at phone/desktop sizes: regular body weight, left alignment, existing headings/buttons/spacing and no horizontal overflow. The first Privacy capture used an obsolete text locator; updating it to the shortened paragraph produced both final captures. The four-width guide checks continue to pass with the frontal example and preserved draft.
- Reproduce with the fixture/build commands above, `scripts/check-avatar-photo-guide.py`, `scripts/check-avatar-upload.py`, and `node --import tsx --test tests/avatar-jobs.test.ts tests/avatar-admin.test.ts tests/avatar-seedream.test.ts tests/seo.test.ts`. Real paid generation, physical mobile devices and authenticated production cancellation are not exercised by these checks.

This backend permission change needs a separate API restart. A read-only live
preflight currently found zero accepted/active rides and zero checking/submitting/
generating avatars. Repeat the check immediately before the private SQLite backup
and API-only restart under the user's standing no-underway-trip approval. Exact
source/deployment/restart evidence follows after activation.


## Verified activation

Final policy implementation `ee7fc3082314d6c93fe47baf950ac78c1a5d0023`
includes the guide and single-action upload from `97a740e` / `76c1386`.
Vercel `dpl_Cw9ta6yy1mx8fH9uEYfEh4giTQNb` is READY for that exact source and
aliased to www.gumwheel.com and gumwheel.com. Anonymous production browser checks
pass at 320/390/844/1440: guide/H1, frontal illustration, surrounding margins,
canonical/indexing/sitemap and containment. All browser non-read requests were
blocked. Public Privacy contains the final purpose/support copy and no user
cancellation or internal approval-step claim. The live frontal WebP hash equals
the committed asset. Public `/api/health` returns 200 / status ok.
Python urllib requests returned 403 from the public path; direct curl and browser
checks succeeded. No application change was made to bypass access controls.

At 2026-11-16T08:56:35Z, a fresh read-only preflight found zero accepted/active
journeys and zero checking/submitting/generating avatars. A private 0700/0600
online SQLite/config backup passed quick/integrity and foreign-key checks before
restarting only `cocowheels-api` under the standing conditional restart approval.
The process PID changed, loopback health recovered, database quick_check is ok,
foreign-key violations are zero, and every previously terminal journey/request
row matched its pre-restart hash. Source was clean at the exact implementation
revision. Backup/config files remain ignored and private; no private photo,
credential, token, GPS record or account identifier was added to this evidence.

Authenticated production upload/cancellation was not exercised; the permission
and workflow assertions use isolated real API fixtures. No production account
mutation, paid generation or real notification was triggered by verification.
Physical mobile browsers remain unverified. The subsequent same-tab versus
new-tab discussion is a recommendation only: this release still opens Photo guide
in a new tab to preserve the selected-photo draft.
