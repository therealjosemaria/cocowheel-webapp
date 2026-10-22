# Profile and shared-route polish — 23 October 2026

## Profile label consistency follow-up

Baseline `0e10124`: saved route labels inherited muted uppercase ride-detail
captions. Profile now scopes them to the same 14px bold ink, sentence case and
normal letter spacing as vehicle labels, with no added label/value grid gap.
Values stay regular; field separation stays 12px. Ride-detail captions, editing,
consent, APIs and data remain unchanged. No server restart required.

The browser command below passed at 320/390/844/1440px, comparing computed label
colour, font size/weight/family, case and letter spacing against Number plate,
plus zero grid gap and existing route/schedule/swap checks. Whole Profile with
both disclosures open was visually reviewed at 390/1440px. Initial browser run
had no local dev server (connection refused); starting the isolated server fixed
the harness setup. ESLint passed. Initial sandboxed build could not bind a
worker port; the permission-enabled production build passed.
No production writes or emails. Real-device Safari and deployed UI unverified.

## Original route polish

Baseline: `14085a3`. Frontend-only; no API/schema/restart/retention changes.

- Profile saved addresses are one column, like editing. Removed summary cell
  insets and standardised related-content spacing at 12px, matching alerts.
- RouteFields owns Swap addresses for Profile, Offer and Find. Right-aligned
  44px secondary icon button between fields, native button keyboard support,
  accessible name/title, decorative 18px arrows. No selected colour or modal.
- Swaps coordinate-bearing pins, labels/country metadata and visible draft text.
  Remounts searches to discard old results/errors and invalidate in-flight search
  or GPS responses; the button itself stays mounted/focused. Empty/partial drafts
  work without turning typed text into a selected place. Swapping empty fields is
  a no-op. It never saves, publishes or invokes Find's automatic completion callback.
- RouteTime is reused in new-route setup and Edit schedule: Choose a time appears
  when empty and not focused. Native time picker/keyboard editing remain; time
  validation, Sydney timezone, schedule semantics and consent are unchanged.

## Reproducible checks

Run isolated frontend with
`COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090`.
Run `/tmp/gumwheel-pickup-check-env/bin/python scripts/check-profile-route-polish.py`.
Browser fixtures mock all APIs and block external traffic; no production writes,
GPS calls or emails. Checks cover stacked saved layout, swapped persisted pins,
preserved consent, empty/filled schedule hint, Offer/Find partial draft swaps,
horizontal overflow and console errors at 320/390/844/1440px.

Results: browser checks passed at all four widths; 145 regression tests, ESLint
and production build passed. Reviewed complete Profile saved/edit/schedule
screens at 390/1440px and Offer/Find visible layouts at both widths: heading/body
hierarchy, icons, shared swap placement, field spacing, native empty-time hint,
unchanged controls and no horizontal overflow. Find's mobile form extends below
the viewport as before. React review confirmed shared components, no automatic
submission, and remount cleanup for replaced searches. No new provider calls are
made by swapping. Physical-device and race-injection testing remain unverified.

Physical iOS/Safari native picker behaviour and deployed production remain
unverified; desktop Chromium/mobile viewport emulation is not a real device test.

## Centred swap refinement

The original right alignment above is superseded: Swap addresses is horizontally
centred between the stacked fields in all three shared editors. Its SVG is centred
on both axes inside the unchanged 44px button. Equal 4px surrounding gaps remain;
Use my location stays with the origin. This adapts the between-fields relationship
observed in Google Flights, not its side-by-side layout. No behaviour changes.
Re-ran the browser command at 320/390/844/1440px: all passed, including explicit
button-to-container and icon-to-button centre assertions and the 44px target.
Reviewed Profile editor and both role-form captures at 390/1440px for overall
hierarchy, spacing and alignment. No overflow or browser exceptions. Full test
suite/build results above apply to the preceding implementation; this CSS-only
refinement was checked with browser regression and git diff --check.

## Adjacent controls refinement

The centred-between-fields experiment is superseded. Swap now sits immediately
after Use my location with an 8px gap, in the same responsive action group:
below origin on mobile, before Search on desktop. Its separate row is removed.
The 44px target and centred 18px arrows remain. The hidden responsive duplicate
is excluded from keyboard/accessibility navigation by display:none. After swapping
remounts the inputs, focus returns to the visible Swap control without scrolling.
Address/pin swapping, search/GPS cleanup and save behaviour are unchanged.

Re-ran the browser command above at 320/390/844/1440px: all passed, including
8px adjacency, vertical alignment, centred icons, 44px targets and restored
keyboard focus. Profile pin persistence and Offer/Find draft swaps passed without
overflow or browser exceptions. ESLint, production build and git diff --check
passed. Visually reviewed complete Profile editor and Offer/Find captures at
390/1440px for spacing, typography, icon prominence and unchanged surrounding
controls. Physical-device Safari and deployed production remain unverified.
