# Email accounts and Personal details — 24 October 2026

## Implemented contract

Any syntactically valid email can request an OTP; mailbox delivery/verification is
still required. No email-age checks, new bot challenge or IP limiter were added.
Existing 60-second resend, 3 sends/account/15 minutes, 100 sends/hour service-wide,
10-minute codes, 5 guesses/code and 15 guesses/account/15 minutes remain unchanged.
An address is normalized to lowercase; provider aliases are not deduplicated.
Sydney four-letter/four-digit full university emails canonicalize to the existing
bare UniKey. Guest and the existing Gmail test account remain separate accounts.

Personal details is the first initially collapsed Profile accordion. It uses the
shared field/button tokens and Edit, Save, Cancel pattern. Email is visible only
to its owner and cannot be edited. Username accepts 3–8 ASCII letters/digits,
normalizes lowercase, and has database-backed case-insensitive uniqueness.
Reserved staff/system names are unavailable. Conflicts return HTTP 409 with
USERNAME_UNAVAILABLE; malformed names return 400 INVALID_USERNAME. No rename
cooldown was added. Old names remain reserved to the same account to prevent
another participant taking over an old name. The owner may reuse them.

An initial name is derived from the sanitized email prefix, truncated to eight;
collisions get a random suffix. Email domains are never public display names.
Existing UniKeys keep their names where available. Public ride/request/history
and conversation peer names resolve via immutable principal IDs, not email.
Compact 24px avatars accompany the shared participant-name display in navigation,
discovery and ride/activity details. Photos are optional, not identity checks.

## Photos and authorization

The header's shared mobile/desktop Profile trigger also displays the owner's
photo. It reads the existing authenticated profile endpoint once on mount and
on profile-change events, using the versioned public photo URL. No additional
polling or API/schema changes. Identity changes remount the image component;
late/unmounted or superseded responses are ignored. Missing metadata, request
errors and failed image loads fall back to the original person icon. The unread
badge, accessible button name, menu actions and dimensions remain unchanged.

Header checks (24 October 2026): `npm test` 160/160, lint and production build
passed. Run `/tmp/gumwheel-pickup-check-env/bin/python scripts/check-profile-menu-photo.py`
against local frontend :3201. Mocked API/browser checks passed at 320/390/844/1440px:
missing photo, image refresh, failed image, sign-out, menu/Escape, unread badge
visibility, unchanged button dimensions and no overflow/JS exceptions. Initial
test expected a relative failed-image URL; Next normalizes it to absolute, so the
assertion now checks the path suffix. Mobile/desktop whole-screen screenshots
reviewed for header alignment, badge layering, spacing and hierarchy. React review
checked effect cleanup, stale-response guards and decorative-image accessibility.
Physical Safari and production frontend deployment remain unverified; no restart
is required and no production records were changed.

Add photo/Update photo appears in edit mode; no Remove control. Cancel discards
the draft. JPG/PNG/WebP only, maximum input 10 MB and 32 million decoded pixels in
the browser. Center-crop to 512px square WebP, preview before Save. HEIC, SVG, GIF
and animated images are unsupported. Browser compression is not a security gate.
The server independently limits the profile JSON to 710,000 bytes, the data URL
to 700,000 characters, decoded bytes to 512,000, and decoder input to 16 million
pixels; verifies format/non-animation, rotates orientation, resizes to at most
512px square and re-encodes WebP quality 85, stripping metadata. Only one server
photo conversion runs at a time; concurrent conversions receive 429 PHOTO_BUSY
and may retry. Invalid images return 400 INVALID_PROFILE_PHOTO. Body oversize
returns 413. No promised compression ratio; small images are not enlarged.

GET/POST /api/profile requires the current verified session; body principal/email
fields cannot select another account. Save rechecks session after asynchronous
photo conversion and does not automatically replay after a frontend login change.
Username reservation and photo replacement are atomic. Failure leaves saved data
unchanged. Public GET /api/profile-photo/:username returns sanitized WebP or a
fixed SVG placeholder, no-store and nosniff. It reveals no email or original file.
Photo updates refresh local identity displays; other clients see updates on reload.

## Persistence and migration

Startup adds account_profiles (principal FK, unique username, photo BLOB/version)
and username_reservations, then idempotently backfills existing verified accounts
inside a transaction. Existing accounts, sessions, rides, aliases, ratings and
principal ownership are not replaced. Admin continues to require the original
verified jmos0905 login identity, never a chosen username. Legacy internal table,
cookie, route and service names are unchanged. Email copy resolves current names
when new alerts are prepared; already persisted email retries keep their payload.

SQLite stores only the current photo; replacement overwrites that image, not trip
history. Older backups can retain earlier images. Reservations/history remain
retained. Privacy/Terms now describe open email registration and public profiles.
No migration to another auth provider or external image host.

## Checks and deployment

Baseline regression: 150/155 passed; old university-only/public-email expectations
and a synthetic legacy schema fixture failed. Updated those expectations and
fixture initialization. Added real SQLite/HTTP tests for signup, canonical login,
collisions, renames, admin identity, photo decoding, authorization, atomic failure,
body limits and persistence. `npm test`: 159/159 passed before final UI refinements.
`npm run build`: passed. Final checks/deployment evidence recorded below when run.
Reproduce browser checks with a local frontend on 3201 and
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-personal-details.py`;
all browser API responses are mocked, no emails or production trips created.

Frontend push does not restart the API. Deployment requires a consistent database
backup and API restart only after confirming no accepted/active trips. Real inbox
delivery, iOS photo selection and provider dashboard delivery are separate checks;
mocked browser tests do not prove these.

### Final verification evidence

Source baseline: c68b28dd364bad89f3312061442e64d52b77deec plus this change series.
`npm test`: 160/160 pass, including explicit legacy-table migration preservation.
`npm run lint`: pass. `npm run test:security`: 52/52 pass on isolated SQLite and
loopback HTTP with external networking disabled. Its initial 51/52 result was
the superseded rejection of valid public emails, not a weakened authorization
assertion; both sanitized reports are retained in docs/testing.
Profile browser checks cover 320/390/844/1440px: collapsed/read/edit/save/cancel,
collision errors, valid browser image conversion, invalid images, private email,
eight-character names and email-code login. Existing vehicle checks cover both
roles at 320/390/1440px. Screenshots reviewed for spacing, borders, type, name/avatar
alignment and overflow. Maps use mocked routes/blocked tiles, not real providers.

The audit flagged the previously transitive Sharp 0.34.5; the new photo endpoint
now pins patched Sharp 0.35.5 (libvips 8.18.7). All regressions pass with that
decoder. Existing Next 16.1.0 (including its nested older Sharp), PostCSS and Zod
advisories remain open and require a separately tested dependency update. This
change does not claim the whole application is vulnerability-free. Public profile
images deliberately bypass Next image optimization; they are server-sanitized.

### API activation

Approved restart completed 24 October 2026, 16:16:50 AEDT, after a zero
ACCEPTED/RIDE_ACTIVE/CO_RIDE_ACTIVE preflight and consistent private local backup.
Seven profiles backfilled; database integrity is ok and foreign-key check empty.
Accounts, sessions, all 129 rides and request records match the backup byte-for-byte.
Local and public proxied health returned ok; anonymous profile GET returned 401;
the public avatar route returned 200 after the canonical-domain redirect.
No live login codes, test photos or rides were created. Frontend deployment remains
separate from API activation and must not be inferred from these checks.
