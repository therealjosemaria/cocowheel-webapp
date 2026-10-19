# Combined header logo — 19 October 2026

## Original asset replacement

### Full-resolution delivery refinement

Next Image now uses `unoptimized` for this logo only, serving the exact original
1254×1254 PNG rather than a small optimized variant selected by `sizes="15px"`.
This deliberately trades a larger image download (1,309,146 bytes) for retained
detail under mobile zoom. CSS size, position and all header controls are unchanged.
PNG is still raster; this does not promise unlimited vector-like magnification.

Delivery checks: local Chromium at 390px (3× device scale) and 1440px reports
naturalWidth 1254, displayed width 15, no srcset, and the direct original asset
URL. HTTP response bytes match the repository PNG exactly. Full Home screenshots
were reviewed at both widths; size, alignment and hierarchy remain unchanged.
Visual-system regression tests passed 5/5 and lint passed. Actual phone pinch
zoom/Safari and live deployment remain unverified; no production API was used.

The user rejected the generated cutout below and supplied
`gumwheel-transparent-original.zip`. Its `gumwheel-transparent.png` is copied
byte-for-byte to `public/brand/gumwheel-original.png`, without AI processing,
redrawing or image edits. The new filename avoids reuse of the old optimized
image URL. It is a 1254×1254 RGBA PNG with transparent corners; alpha >128 bounds
are x75–1182, y90–1194. Existing 15px CSS sizing and all header geometry remain
unchanged (approximately 13.2px visible artwork height). Previous assets remain
available for history but are no longer referenced by the header.

Replacement verification: visual-system tests 5/5 and lint passed. Full Home
screens were reviewed in local Chromium at 320/390/1440px with mocked APIs;
original image loads, no horizontal overflow, alignment and overall hierarchy
remain unchanged. No real-device or live deployment verification; the earlier
build result below belongs to the generated-cutout revision.

## Superseded generated cutout

The user-supplied combined pink gum/black tyre logo replaces the two separate
header icons. Source was the attached Photo 1.jpg; built-in imagegen produced
`public/brand/gumwheel-logo.png`, a 1254×1254 RGBA PNG, not an SVG.
Prompt: remove only the exterior white background, retain the existing design,
highlights, proportions and colours, no text, shadow, border or redesign.
This is an image-edited cutout, not a claim of pixel-identical vector conversion.

Alpha inspection confirms transparent corners and opaque artwork. At alpha >128,
artwork bounds are x67–1187, y80–1199. The 15px image therefore displays about
13.4px of artwork vertically versus approximately 13.2px for the old pair.
CSS compensates for transparent padding. Preserve the 6px visible text gap,
48×32px frame and 18px trailing padding; navigation does not shift. The existing
wordmark font, size, colour and position remain unchanged. No backend changes.

Verification: `npx tsx --test tests/visual-system.test.ts` passed 5/5;
`npm run lint` and `npm run build` passed. Local Chromium full-Home screenshots
at 320px, 390px and 1440px were visually reviewed for alignment, icon prominence,
spacing, typography and unchanged navigation/hero/footer. Image loaded at 15×15px
on all three; no horizontal overflow. API requests were mocked and external
requests blocked, with an unreachable local proxy target; no live rides touched.
The first browser fixture omitted `currents`, causing a mock-only runtime error;
correcting it to `currents: []` allowed the visual checks to pass.
Real-device Safari and production deployment remain unverified. A push is not
deployment verification; no API restart is needed.
