# Security model and limits

This is an educational simulation, not audited banking software.

- Argon2id hashes passwords; passwords are never returned by an API. Zod limits lengths before hashing.
- Access tokens use HS256 with an environment secret, fixed issuer/audience and 10-minute expiry. They remain in memory, never localStorage. User status is reloaded on every authenticated request.
- Opaque 48-byte refresh tokens are SHA-256 hashed in the database. A row lock makes rotation single-use. Cookies are HttpOnly, Secure in production, SameSite=Lax and scoped to /api/auth. Logout revokes refresh access; an already-issued access token remains usable until its 10-minute expiry unless the user is suspended.
- Mutations require an exact allowed Origin. Bearer authorization protects banking endpoints; Origin checking protects cookie-based refresh/logout. The Vercel same-origin proxy avoids third-party-cookie dependence.
- APIs parameterize SQL. Dynamic sort is selected from fixed ASC/DESC values; dynamic laboratory identifiers come solely from generated UUIDs. Pagination values are bounded integers.
- Admin endpoints never return password hashes or session tokens. Ordinary users cannot self-promote. Seed refuses to promote an existing ordinary account to admin.
- Financial writes go through a single SQL procedure and restricted runtime privileges. Immutable triggers defend posted records. Admin grants are journaled against the equity account.
- In-memory rate limiting is appropriate only for the initial single-instance educational deployment. Multiple API replicas need a shared rate-limit store. Confirm the trusted proxy hop configuration for the deployed Vercel/Railway request chain before release; a broad proxy setting can weaken IP-based limits.
- Labs require a distinct database name ending \_lab and are disabled in production by default. CI requires a \_test database. Never point either URL at production or reuse production credentials.
- Logs contain error codes, not request bodies, password hashes, tokens or connection URLs. CSV cells neutralize formula prefixes.
- Root/migration credentials are reserved for provisioning and migration. Provision a least-privilege runtime user using scripts/provision-users.mjs. Production public release remains blocked until this is verified.
- Database backups, recovery drills, centralized rate limits, session-family theft revocation, MFA, password reset/email verification and external security review are not implemented. These limits must be understood before extending this beyond a university simulation.

Never commit .env files. Put production secrets directly in Railway and GitHub protected environment settings. No database secrets belong in Vercel frontend variables. The tracked CI database password is ephemeral and valid only inside the GitHub service container.
