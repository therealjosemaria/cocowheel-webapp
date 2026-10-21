# Shared route entry — 22 October 2026

Source baseline: `67019e7`; this report describes the following working changes,
not a verified deployment. No database/schema, provider configuration, API
permissions, active-trip tracking or production service restart.

## Behavior

- Profile, normal Offer a ride and Find a ride reuse `components/route-fields.tsx`.
  It contains the existing explicit place-search API and scrollable results,
  with Where from?/Where to? placeholders and persistent accessible names.
  Selected address text stays in each input; redundant Selected lines are removed.
- Focus the first empty input once on entry; choosing an origin advances to an
  unselected destination. Do not refocus on each keystroke or when both are filled.
  Browser focus is requested without forced scrolling; physical mobile keyboard
  opening remains browser-controlled.
- Editing clears that field's selected coordinates; typed text alone cannot
  publish, save or search for rides. Late lookup responses are ignored after
  further edits, selection or unmount. Searches remain explicitly triggered.
- Normal Offer/Find no longer have current-location consent/setup buttons or
  recent-device-GPS prefilling. Obsolete setup-only helpers/PinControls are removed.
  Active ride location updates and the saved Profile route's fresh-GPS shortcut
  remain unchanged. No history or internal identifiers are migrated/deleted.
- Find opens the existing map/chooser once both places are selected, regardless
  of selection order. Back retains selected addresses. Editing clears the old
  completed-search draft to prevent restoring stale selected coordinates.
- DepartureChoice keeps Now/In 30 min/In 1 hour and its accessible Leaving name;
  its visible legend and flexibility helper sentence are removed everywhere it
  is reused. Existing scheduling calculations remain unchanged.

## Profile draft boundary

After authenticated session and usual-route reads resolve in parallel, restore
only that UniKey's draft when no saved server route exists. The key is
`cocowheels:profile-route-draft:v1:<unikey>` in sessionStorage. It retains typed
address text, chosen pins, days/time and email preference for 30 minutes from the
last write. No PayID or fare is added to browser storage. Saved server routes
override/clear drafts; successful save clears the draft. Invalid/expired data and
storage exceptions are ignored. This is convenience state, not authorization or
server auto-save. It is local to a tab, not cross-browser/device synchronization.
Changing identity clears the mounted form before reloading the correct account.

## Reproduction and evidence

Use the isolated Next dev fixture at `127.0.0.1:3090`, with API proxy pointed at
unreachable loopback `127.0.0.1:1`. Browser scripts intercept all `/api/**` and block
external traffic. Never run these synthetic flows through a live account.

```sh
npm test
npm run lint
npm run build
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-usual-route.py
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-free-rides.py
```

128 unit/regression tests passed, including draft ownership, expiry, invalid data,
clear and unavailable-storage handling. Lint and production frontend build passed.
Browser suites cover 320/390/844/1440px: initial focus, destination-first Find,
map transition/back, Profile navigation/reload with selected and unfinished text,
no accidental save, successful save clearing, time input containment, mute flows,
saved-route GPS denial/success, normal free/paid Offer payloads and role-specific
payment visibility. Edited-address invalidation assertions additionally cover
blocked publishing until re-selection and returning to the Find chooser.

Both browser scripts passed their final four-width run, including edited-address
invalidation. Whole-screen screenshots reviewed for mobile and desktop Profile, Offer and Find:
shared spacing, heading hierarchy, input containment and unchanged payment UI.
Initial Find screenshots caught the existing entry transition; final captures
disable animations. Existing mobile Find panel minimum height is unchanged.
Screenshots/logs stay in `/tmp`, not Git.
React review prompted a standalone shared component, mount-only focus, invalidation
of stale coordinates/results and account-scoped rather than global private drafts.

Boundaries: mocked provider/API responses are not a real end-to-end live journey;
no external emails, provider quota/load tests or production data writes. Physical
iPhone Safari keyboard/picker and actual deployment remain unverified. The prior
standalone `tsc --noEmit` test-file typing failures are documented in
PROFILE_POLISH_2026-10-22.md; the app production build is the checked compile gate.

## Owner walkthrough

1. Open Profile with no saved route: origin focused, destination next after choice.
2. Leave an unfinished destination, visit another tab, return: text/places remain.
   Finish days/time and Save route: saved route appears normally.
3. Open Offer a ride: type/select both addresses without a location prompt. Check
   departure buttons, free default, optional contribution/PayID and validation.
4. Open Find a ride: select both places, check the usual map/ride chooser. Go back,
   edit an address and select its replacement; no old location should be submitted.
5. Check on your actual iPhone in portrait/landscape as well as desktop.
