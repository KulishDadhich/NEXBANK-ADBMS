# Project status — 9 November 2026

## Overall

Implementation prepared, not a verified complete banking application. No public deployment and no GitHub push have succeeded. Do not use the presence of source files as proof of full functionality.

| Phase                                       | State                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| 1 Architecture and database planning        | Delivered: architecture, ER diagram, normalized schema, ledger and API contract  |
| 2 Database implementation                   | SQL written; MySQL runtime verification blocked                                  |
| 3 Backend implementation                    | Implemented and typechecked; unit tests pass; API/MySQL integration unverified   |
| 4 Frontend implementation                   | Implemented, component-tested and production-built; browser runtime unverified   |
| 5 ADBMS laboratory                          | Ten executable experiment paths written; actual multi-session results unverified |
| 6 Security and testing                      | Unit/component checks pass; real MySQL and E2E gates supplied, not passed here   |
| 7 Integration, documentation and deployment | Docs/configuration supplied; GitHub/hosting and final live verification blocked  |

## Implemented paths

Registration/login, access JWT, rotating refresh cookie, logout, account creation/list/detail, a single SQL posting implementation, canonical idempotency, exact integer money, balanced ledger, account audits, immutable financial records, beneficiary CRUD, searchable/paginated history, CSV statements, monthly charts, theme/profile, admin statistics/user/account controls, simulated grants, failed-attempt records, database reconciliation, isolated database lab, health endpoints, Docker setup, MySQL migrations, CI/CD configuration.

## Verification and blockers

See TESTING.md for exact outcomes. MySQL 8.4.5 initialized on disk but failed to open its Unix socket with Operation not permitted. Integration setup could not connect and all 24 dependent tests were skipped; the suite failed. Browser preview failed with uv_interface_addresses / Operation not permitted. These are not successful runtime checks.

GitHub: connected identity KulishDadhich; NEXBANK-ADBMS not found; repository creation not supported by exposed connector; gh is not authenticated. User must create the repository and grant integration access, or use the exact gh publishing commands in DEPLOYMENT.md.

Vercel: team authorization is now resolved and project listing succeeded. No NEXBANK Vercel project or deployment has been created.

Railway: identity authenticated. No project, service or database provisioned. Provisioning was not advanced to public release because source publication and required runtime verification are unresolved.

## Still needed before claiming completion

- Execute MySQL migrations and all integration tests; fix any runtime SQL or API failures.
- Execute Playwright and inspect the responsive UI in a browser.
- Verify runtime database grants using the restricted user, and confirm trust-proxy settings on actual hosting.
- Verify the implemented point/range isolation demonstrations and restricted-view SQL-user integration test.
- Admin user/account lists currently cap at 200 and audit at 100; failure monitoring is independently searchable, date-filtered and paginated.
- Verify transaction detail dialogs and native browser confirmations using keyboard and mobile layouts.
- Validate all dashboard metrics and failed-attempt filters against actual persisted data.
- Configure GitHub protected branch/environment, hosting variables, CI tokens and production targets.
- Provision MySQL persistent storage and least-privilege runtime identity, deploy exact verified code, verify all live flows and record real URLs.

No concurrency, destructive failure injection or deadlock demonstration may run on ordinary production data. No production credentials are included in this package.
