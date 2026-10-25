# Shared route warning — 25 October 2026

Baseline: 939524a. Find and Offer now use the same enabled-before-entry behaviour.
Either missing endpoint opens RouteRequiredPrompt, a thin wrapper around the
existing Message dialog: regular sentence “Choose where from and where to.”,
one OKAY action and an accessible Route required name, without a visible heading.
The ride-preview fallback uses the same component instead of duplicated markup.
No route-specific headings or second explanatory sentence remain.

Reuse the centred cancel-prompt styling and useDialogFocus: initial OKAY focus,
Tab containment, Escape dismissal and trigger focus restoration. No new CSS.
Dismissal preserves selected addresses, schedule and fare; no automatic picker
navigation. Missing route takes priority over driver departure/payment validation.
Complete routes retain their prior validation/search/publication behaviour and
driver busy-state guard. Other notices, confirmation and picker designs are not
changed by this scoped fix. Backend validation/permissions are unchanged.

Verification: npm test, npm run lint, npm run build and
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-calendar-search.py`.
The browser script blocks external traffic and mocks APIs at localhost:3201;
checks cover both roles with neither/origin-only/destination-only endpoints,
no submission on warning, no heading, focus/Escape, preserved inputs and valid
route progression. All 167 tests passed, lint and production build passed, and
browser checks passed at 320/390/844/1440px. Whole-screen mobile and desktop
screenshots of both roles were reviewed: regular message, no competing heading,
shared button/spacing and unchanged surrounding form. React review confirmed
shared component reuse and focus handling. Physical phones and production
frontend deployment were not verified. The preview fallback was source-reviewed
to use the same component; its missing-context entry was not separately exercised.
No API restart is required; a push is not verified frontend deployment.
