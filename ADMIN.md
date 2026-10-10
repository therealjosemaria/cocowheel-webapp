# Read-only admin

Sign in with the verified `jmos0905` UniKey, then use the Admin menu link.
The page and API reject all other accounts, including the Gmail testing account.
No separate admin password is required. Overview shows all-time ride
counts (including samples); Trips provides status filters and 25-record pages;
Trip inspector shows route details, up to 200 recent requests/events, and the
latest retained GPS positions. It does not claim to retain a GPS history.
No ride edits, cancellation, deletion, payment identifiers, pickup codes, or
guest-session credentials are exposed by the admin API.

Admin access uses the verified owner's university session (30-day absolute TTL).
Every API request checks that session; signing out or expiry removes access.
Report polling does not extend it. Sign out through the profile menu. The browser
receives only an HttpOnly cookie, and the database stores its hash.

## Retired password setup

The old provisioning utility remains for historical compatibility only. Its
credentials and admin cookies no longer authorize the API. Do not run it for
normal setup; access is granted solely by verified UniKey. Legacy utility:

```bash
read -r -p 'Admin username: ' admin_username
read -r -s -p 'Admin password: ' admin_password
printf '\n'
printf '%s\n%s\n' "$admin_username" "$admin_password" | npx tsx scripts/admin-setup.ts
unset admin_username admin_password
```

Set `COCOWHEELS_DB_PATH` first if the service uses a non-default database. The
setup command stores a salted scrypt hash and revokes all existing admin
sessions. No default credentials are checked into the repository.

Existing offer expiry and rider-facing screens are unchanged by this panel.
