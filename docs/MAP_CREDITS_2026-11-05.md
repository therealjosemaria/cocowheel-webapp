# Shared map credits — 5 November 2026

Home previously used Leaflet's bottom-right default attribution, while journey
maps used a bottom-left custom paragraph. Both now render MapCredits, preserving
Leaflet and OpenStreetMap contributor links; road-path views additionally retain
Geoapify. The built-in Leaflet control is disabled on both renderers so credits
are not duplicated. Other maps already reuse JourneyMap.

Shared styling: left7px/bottom10px, existing caption size/line-height1.25, regular
weight links, 3px/6px padding, 5px corners, white at70% opacity and no shadow.
The subtle backing protects readability over map detail; maximum width leaves
58px for right-side controls and lets the longer provider credit wrap. Links
retain visible keyboard focus and open provider credit pages in a new tab.

The owner approved colour tiles on Home. Remove its grayscale/opacity override;
Home and journey maps now use the same unfiltered OpenStreetMap tiles. Existing
car/person art, Home marker caps, noninteractive preview, empty hiding, privacy,
polling and all journey interactions remain unchanged. No API restart needed.

Verification uses the built frontend at :3201 and synthetic API records:
scripts/check-home-presence.py checks Home at320/390/844/1440; and
scripts/check-journey-role-art.py checks journey details at390/1440. Assertions
cover single shared credits, correct links, bottom-left placement, transparent
backing, soft corners/no shadow and Home colour tiles. Build and lint pass. Both browser suites pass at the stated widths with no
runtime errors or overflow. Whole Home and journey-detail screens were visually
reviewed at390/1440px, including the wrapped Geoapify credit beside the zoom
buttons. Caption weight/backing remain subtle and Home's colour map retains the
main action hierarchy. React review: shared presentational component, no new
hooks, effects, data fetches, handlers or duplicated attribution controls.
APIs are synthetic; only read-only public map tiles are allowed externally.
Physical Safari and authenticated production journeys remain unverified.
Production activation is recorded after deployment.


Production implementation 50b9c8b1a56199a5af8e3b7c01c63cca9b448780 is pushed;
Vercel dpl_vqGMJ2ZYMYajb8uthCV1bXGWb9Q1 is READY and aliased to www.gumwheel.com.
Fresh guest Chromium at390/1440px verifies the deployed colour tiles and single
bottom-left translucent/rounded/shadow-free credits. The Home feed was replaced
in the test browser with a synthetic cell to exercise populated rendering; no
live posts, account/GPS changes or backend restart. Journey credits were verified
with local synthetic records; authenticated production journeys remain untested.
