# Disable production samples — 19 October 2026

Source: sample-retirement changes based on `a150f04`. API defaults samples off;
isolated sample HTTP test explicitly opts in. Startup transaction closes only
sample PUBLISHED/REQUESTED offers, discards pending requests and records a system
audit event. No deletion. Real rides, terminal history and accepted journeys are
untouched. Accepted sample journeys can finish; no replacements are created.

Verification: 92/92 regression tests, lint and production build passed. New tests
cover retained row/history counts, untouched real offer, discarded pending request,
rejected public preview/join, idempotent retirement, and repeated default-API
availability reads without new samples. Existing opted-in simulation tests pass.
No UI layout changed; discovery uses the existing empty/results presentation.

Reproduce with an isolated database:

```sh
sample_test_dir=$(mktemp -d /tmp/gumwheel-hide-samples-XXXXXX)
COCOWHEELS_DB_PATH="$sample_test_dir/default.sqlite" npm test
npm run lint
npm run build
```

Production preflight found three published samples, no real open offers and no
pending/accepted/in-progress trips. A restrictive-mode online SQLite backup in
`data/backups` passed quick_check. Restart was blocked by approval review because
production restart needs explicit authorization. **Activation pending**: no
production rides were modified and the three samples may still be public until
the API is restarted. Recheck ongoing trips before activating, then verify health,
zero public samples, retained history and unchanged real records. Do not infer
activation from committing or pushing this change.
