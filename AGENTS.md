# GUMWHEEL contributor rules

Read README.md, docs/UI_STANDARDS.md and docs/DESIGN_TOKENS.md before changing
architecture, behaviour or UI. Consult the linked specialist guide for the area.

## Mandatory documentation upkeep

Every change to infrastructure, configuration, APIs, database schema, permissions,
authentication, privacy, lifecycle, TTLs, caches, GPS, providers or user-visible
behaviour must update the relevant documentation in the same commit series.
Update README.md for architecture/behaviour and the specialist guide for details.

- Verify statements against code and observed configuration. Distinguish proposals,
  implemented features, tested behaviour and verified deployments.
- Keep timeouts, transitions, exceptions and failure behaviour explicit.
- Report checks performed and any unverified browser/deployment steps in the handoff.
- Reliability/fault/capacity campaigns must update docs/TESTING_PROGRESS.md and
  retain a reproducible command plus a dated sanitized result. Record source
  revision, isolation, failures/findings and untested boundaries. Preserve failed
  baselines; close findings only with remediation and relevant retest evidence.
- Never document secrets, live tokens, private GPS samples or credentials.
- CURRENT_CONTEXT.md contains history; newer verified README/guides/code supersede
  older notes. Mark superseded decisions instead of relying on chat memory.

## Safety and consistency

For requested implementation work, complete relevant tests, visual review and
documentation, then commit and push without waiting for a separate reminder.
Never skip the full source/staged diff review below. Explicit requests to plan,
inspect only or hold a push override this default; stop and report genuine safety
or verification blockers rather than pushing unreviewed or unrelated changes.

GUMWHEEL is the visible brand. Preserve legacy internal COCOWHEELS identifiers,
URLs, cookies, storage keys, IDs and services unless migration is explicitly asked.
Keep authorization server-side and preserve trip history. Never stress-test live
trips. A push is not a verified deployment; frontend deploys do not restart the API.

Before every commit and push, inspect git status and the full source/staged diff.
Confirm every changed file and hunk is intended, review tests and documentation,
and exclude unrelated edits or generated artifacts. Production safety requires
checking the actual diff, not trusting a replacement command or passing tests
alone. Contact-copy changes must not alter login identities, permissions,
delivery configuration or backend identifiers without explicit authorization.

Design mobile-first and review desktop too. Reuse shared views, maps, modals,
buttons and typography tokens. Backend changes need relevant regression tests;
role-specific UI must be reviewed for both driver and rider.

Keep sections single-purpose. Messaging contains only conversation and messaging
controls; ride actions and support belong in their own sections. Reusing a shared
component is not permission to duplicate unrelated controls or destinations.
Check section responsibilities alongside typography and spacing on every UI edit.

After every UI or copy change, visually review the whole affected screen on mobile
and desktop for competing emphasis: headings versus body, text weights, icon
prominence, colours and spacing. Reassess existing bold formatting when shortening
copy; do not let former lead-ins become an all-bold body. Tests alone do not replace
this aesthetic review. Record what was visually checked and what remains unverified.
