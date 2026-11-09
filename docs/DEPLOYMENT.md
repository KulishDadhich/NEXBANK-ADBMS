# GitHub, Railway and Vercel deployment

## Recorded state — 9 November 2026

Source exists locally and has passed TypeScript, unit/component tests and builds. No repository was created or pushed. No application or database was deployed. Railway authentication succeeded. GitHub is connected as KulishDadhich but the available integration cannot create repositories, and local gh is unauthenticated. Repository search returned no NEXBANK-ADBMS. Vercel initially returned 403, but team authorization subsequently succeeded and the project list is accessible. Live URLs therefore do not exist yet.

## Deployment topology

```mermaid
flowchart TD
 Browser[Browser] -->|HTTPS| Frontend[Vercel React SPA]
 Frontend -->|Same-origin /api rewrite| API[Railway Express service]
 API -->|Private Railway network| DB[MySQL 8.4 persistent volume]
 GitHub[GitHub main] --> CI[Tests, MySQL integration, types, builds, browser E2E]
 CI -->|Pass only| BackendRelease[Deploy backend and check readiness]
 BackendRelease --> Stage[Stage Vercel production build]
 Stage --> Smoke[Route and API smoke tests]
 Smoke -->|Pass only| Promote[Promote frontend domain]
```

## Publish source from Windows PowerShell

Install Git and GitHub CLI. Open the extracted NEXBANK-ADBMS folder in VS Code.

Use one of the two publishing paths below.

The archive includes a portable Git bundle rather than a hidden .git directory. To preserve the local commit history, first restore it from a parent directory:

```powershell
git clone .\NEXBANK-ADBMS\NEXBANK-history.bundle NEXBANK-repository
cd NEXBANK-repository
git remote remove origin
gh auth login
gh repo create KulishDadhich/NEXBANK-ADBMS --public --source=. --remote=origin --push
```

If using the ordinary extracted source without the bundle:

```powershell
git init -b main
git add .
git commit -m "Build NEXBANK educational banking application"
gh auth login
gh repo create KulishDadhich/NEXBANK-ADBMS --public --source=. --remote=origin --push
```

If the repository was created in the browser, use this instead of gh repo create:

```powershell
git remote add origin https://github.com/KulishDadhich/NEXBANK-ADBMS.git
git push -u origin main
```

Never add .env files, database dumps, credentials, .vercel state or private keys. The ignore rules and CI path check cover common credential paths; review git diff --cached before committing.

## Railway

1. Create a project NEXBANK and a production environment. Confirm the available Railway plan/credits first; hosting is not guaranteed to remain free. Local Docker does not need a paid service.
2. Add a MySQL service using mysql:8.4 with a persistent volume mounted at /var/lib/mysql. Generate a unique root password directly in Railway. Do not create a public TCP proxy for ordinary production access. Set MYSQL_DATABASE=nexbank and TZ=UTC.
3. Create an API service from this monorepo with repository root as build context. Use backend/Dockerfile and railway.toml. Disable direct Git push deployments; the CI job is the only release path. Do not let an unverified push trigger deployment independently.
4. Configure backend variables in Railway, never in Vercel's VITE\_\* variables:

| Variable               | Value                                             |
| ---------------------- | ------------------------------------------------- |
| NODE_ENV               | production                                        |
| PORT                   | Railway-provided port or 4000                     |
| DATABASE_URL           | restricted runtime user on MySQL private hostname |
| MIGRATION_DATABASE_URL | migration credential on same private database     |
| JWT_SECRET             | at least 32 random bytes, generated privately     |
| FRONTEND_ORIGINS       | exact https:// production frontend origin         |
| LAB_ENABLED            | false                                             |
| SEED_DEMO              | false                                             |

5. For first provisioning, run migrations and the seed from a Railway-connected execution environment. Supply ADMIN_EMAIL and a unique ADMIN_PASSWORD privately for seeding; remove ADMIN_PASSWORD after seeding. Run scripts/provision-users.mjs with MIGRATION_DATABASE_URL and RUNTIME_DB_PASSWORD. Then set DATABASE_URL to nexbank_runtime with that password. The first bootstrap is deliberately a provisioning step; do not publish an API using the root credential as its runtime identity.
6. Railway pre-deploy runs the migration runner. MySQL DDL auto-commits; a failed partial migration needs manual inspection/repair, not a blind restart. Applied migration checksums are immutable. Use additive migrations for live changes.
7. Generate the API HTTPS domain, record it as BACKEND_URL and check /health/ready. Railway's healthcheck prevents a failed startup from becoming the active deployment.
8. Enable volume backups in the hosting plan if available. Never treat a persistent volume as a backup.

MySQL private networking avoids public exposure. If an external DB connection is necessary, require verified TLS and provide DB_SSL_CA; never use rejectUnauthorized=false. Keep the migration credential separate from the ordinary runtime URL. A stronger production separation runs migrations as a one-off job so the running API container does not retain a DDL credential.

## Vercel

Authorize the connected app for the intended team. Create a Vite project with frontend as its root directory and dist as output. The checked-in vercel.json disables Git auto-deploys. Do not enable a parallel push-to-production integration.

Set BACKEND_URL locally/CI to the actual Railway HTTPS origin and run:

```powershell
$env:BACKEND_URL="https://YOUR-SERVICE.up.railway.app"
node scripts/configure-vercel.mjs
```

This replaces the explicitly nonfunctional proxy placeholder. No database credentials are used by frontend builds. /api paths proxy to Railway; browser routes rewrite to index.html. Same-origin cookies avoid depending on third-party Railway cookies. Keep FRONTEND_ORIGINS aligned with the final public frontend URL. If testing login on a staged URL, temporarily allow that exact staged origin; do not allow arbitrary preview origins.

## GitHub Actions and release gates

The workflow .github/workflows/ci.yml runs backend unit tests, frontend component tests, TypeScript checks, real MySQL 8.4 integration tests, production builds and Playwright E2E against an isolated CI database. CI passwords are disposable test-only values, not production secrets.

Configure a production GitHub environment restricted to main; set required reviewers where appropriate. Protect main with the verify job as a required check. Store tokens directly in GitHub environment secrets; never paste them into source or chat.

Secrets: RAILWAY_TOKEN (project-scoped), VERCEL_TOKEN, and VERCEL_AUTOMATION_BYPASS_SECRET when deployment protection is enabled.
Variables: RAILWAY_PROJECT_ID, RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT_ID, VERCEL_ORG_ID, VERCEL_PROJECT_ID, BACKEND_URL. Set RELEASE_ENABLED=true only after target IDs, permissions, provisioned schema, runtime grants and health checks are confirmed.

The deploy job has needs: verify and only runs on main. It uploads the exact checked-out verified revision to Railway, waits for readiness with a matching commit revision (so an old healthy instance cannot satisfy the check), stages a production Vercel build without assigning domains, checks SPA refresh routes and the protected API proxy, then promotes that build. Failed verification cannot enter the release job. Failed frontend smoke tests cannot promote it. The pipeline file exists but has not yet run on GitHub; hosting-side settings are not configured.

Cross-host release is not atomic: a healthy new backend may become live before frontend staging fails. Keep APIs backward-compatible; rollback backend and frontend independently to the recorded prior successful deployments. Database migrations must remain compatible with both versions.

## Final verification record

After deployment record actual URLs and commit SHA in PROJECT_STATUS.md. Verify landing page, registration, login, refresh, account creation, beneficiary editing, authorized transfer and statement download, admin controls and database reconciliation. Registration creates zero-balance accounts; use a controlled admin simulated grant for the transfer demonstration. Never run rollback injections, concurrency/deadlock or destructive tests on the ordinary production database. Those belong in CI/local \_test and \_lab databases.

The deployment smoke script checks routing and API reachability; it does not claim to prove all banking flows. Full browser/financial verification must be recorded separately.
