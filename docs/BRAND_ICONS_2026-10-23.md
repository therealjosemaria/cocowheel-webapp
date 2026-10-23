# Browser and matching-email brand icons — 23 October 2026

Baseline `717f91a`. Reuse `/brand/gumwheel-original.png` unchanged (1254×1254,
transparent PNG). No image regeneration, resizing, recompression or new assets.

- Root metadata supplies PNG icon and Apple touch icon links, using the original
  image. Browsers scale it to their tab/bookmark UI; small display size inherently
  loses detail even with a high-resolution source. Browser icon caches may need
  a new tab/reload. No Safari monochrome pinned-tab SVG is introduced.
- Matching-ride email uses a presentation-table brand row, existing 16px bold
  Arial wordmark, 0.08em tracking, 6px gap and 15×15px image. This matches the
  mobile menu wordmark and the shared header icon dimensions without copying
  the header's extra reserved navigation footprint into email.
- Image URL derives from the configured public origin, with no recipient IDs or
  tracking parameters. Email clients may block, proxy or cache remote images.
  Empty alt is decorative; readable text remains if images are unavailable.
- Plain text, message body, links, consent, provider settings and OTP emails are
  unchanged. Existing persisted outbox payloads keep their original content.
- Frontend deployment enables icon metadata; new email branding needs the Pi API
  restart. Original public asset already exists; no DNS or infrastructure changes.

## Verification

`npm test`: 150/150 passed, including HTML escaping with exactly one trusted logo
image and unchanged plain-text output. Browser checks extend
`scripts/check-matching-email.py` to assert icon metadata and load the exact local
1254px source for the email preview, while blocking real external traffic.
`npm run lint` and `npm run build` passed. Running
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-matching-email.py`
against the production build on localhost:3090 passed at 320, 390 and 1440px,
including existing deep-link and mute-control flows. Mobile (390px) and desktop
(1440px) email screenshots were visually reviewed: aligned compact branding,
consistent spacing, clear heading/body hierarchy and no overflow.

With user approval and no trips underway, a local SQLite backup was verified
before restarting only `cocowheels-api` at 13:13:12 AEDT. The service is active
and local `/api/health` returns `status: ok`. Frontend production verification
must follow the push; a local build is not a verified deployment. Real Safari tab
rendering and Gmail/Outlook inbox rendering are not established by Chromium.
