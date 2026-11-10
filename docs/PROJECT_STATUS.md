# Project status — 10 November 2026

Source is published at https://github.com/KulishDadhich/NEXBANK-ADBMS. The CI repair fixes migration lock result handling, uses the MySQL query protocol for rollback-test trigger DDL, and pins Ubuntu 24.04 for the installed Playwright version.

## Implemented

Registration/login, access JWT, rotating refresh cookie, logout, account creation/list/detail, SQL posting, idempotency, integer money, balanced ledger, audits, immutable financial records, beneficiary CRUD, searchable/paginated history, CSV statements, monthly charts, theme/profile, admin statistics/user/account controls, simulated grants, failed-attempt records, reconciliation, isolated database lab, health endpoints, Docker, migrations and gated CI/CD.

## Verification

See TESTING.md for the exact CI evidence and coverage. Test databases are disposable and separate from ordinary application data.

## Deployment status

No public application or production database has been deployed. Railway and Vercel connections are authorized, but hosting projects, production variables, release credentials and target IDs are not configured. The deploy job remains disabled until RELEASE_ENABLED and the required target configuration are set. Follow DEPLOYMENT.md for the architecture, provisioning and release instructions.

## Remaining production verification

- Provision persistent MySQL storage and the restricted runtime user; verify its grants and TLS/network configuration.
- Configure hosting origins, GitHub environment/secrets and branch protection.
- Deploy the verified revision; verify live registration/login, transfers, statements, admin controls, readiness and route refresh.
- Perform responsive/mobile and keyboard usability review; admin lists currently cap at 200 and audits at 100.
- Verify durability across a controlled database restart and validate backup/restore separately.

Concurrency, destructive failure injection and deadlock demonstrations run only in isolated test/lab environments. No production credentials are included.
