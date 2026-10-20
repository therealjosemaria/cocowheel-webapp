# Public contact email audit — 20 October 2026

Baseline `d08ddb5`. Public correspondence now uses `jose@gumwheel.com`.
This is a contact-copy update, not a login, sender-domain or email-hosting migration.

## Inventory and scope

- How it works / Have a suggestion: mailto destination changed; the existing
  `GUMWHEEL suggestion` subject and Email us label are preserved.
- Privacy and Terms: both visible email and mailto destination changed.
- README and UI standards: current contact guidance updated.
- UniKey `jmos0905`, admin permission, university domain, login tests and the
  user-facing university inbox verification explanation are intentionally unchanged.
- Gmail testing exception and guest code destination remain unchanged, as do
  WhatsApp number/draft, backend code, DNS, Resend configuration and deployment
  services. No environment files, production records or stored PayIDs are edited.

Audit searched repository source/docs/scripts/tests and hidden project files
(excluding git internals, dependencies/build output, data and private env files)
for owner identity, university domain, mailto links and contact/privacy wording.
Tracked-file search cross-checked results. Remaining owner university-email
references are intentional auth validation fixtures, not public contact links.

## Reproduction

```sh
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-contact-email.py
COCOWHEELS_DB_PATH=/tmp/gumwheel-contact-regression.db node --import tsx --test tests/contact-email.test.ts tests/university-auth.test.ts tests/admin.test.ts tests/visual-system.test.ts
npm run lint
# Stop isolated dev before building.
npm run build
git diff --check
git diff --cached
```

Browser fixtures mock unauthenticated API responses and block external requests;
they never open a mail client or send email. The actual new inbox's delivery,
DNS/MX configuration and live frontend deployment are not verified by these
checks. No API restart is needed.

## Results

- 16 contact/auth/admin/design regression tests passed using the isolated database.
- Nine Chromium cases passed: all three pages at 320, 390 and 1440 pixels;
  correct links/labels, preserved suggestion subject, no horizontal overflow or
  page JavaScript errors.
- Full-page screenshots visually reviewed at 390 and 1440 pixels for all three
  pages: heading/body hierarchy, contact wrapping, spacing and footer remain
  consistent. This is browser emulation, not physical iPhone/Safari verification.
- Lint and production build passed.
- Source diff reviewed: application changes are limited to contact link targets
  and their visible legal-page labels; no component state, hooks, layout, API or
  authorization changes. Contributor rules now require explicit full/staged diff
  review before every commit and push.
