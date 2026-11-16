# Avatar photo guide — 16 November 2026

Baseline `0533a6c`. A public static `/avatar-photo-guide` page supports Profile’s
Avatar upload area. Photo guide appears once beside initial Upload photo,
Update photo, rejected-result recovery and selected-photo requirements. It uses
an ordinary underlined link, accessible new-tab name and noopener/noreferrer.
Opening it leaves the existing tab’s photo, consent and submission ID intact.
Queued jobs and avatar-display editing keep their existing controls. No new modal,
upload endpoint, storage, checker threshold, consent, pricing or approval rule.

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
sitemap, Upload/Update/rejected-state links, new-tab photo-and-consent retention,
no avatar upload writes, and no page exceptions or horizontal overflow. The
source tab’s unchanged photo state also retains the existing submission UUID;
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
