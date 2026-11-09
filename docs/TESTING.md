# Verification record

Checks were run on 9 November 2026 in the build environment. Consult the final delivery message for any later rerun totals.

| Check                                 | Result                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm install                           | Passed; pinned dependencies and lockfile created                                                                                                              |
| Prisma client generation              | Passed                                                                                                                                                        |
| Backend TypeScript                    | Passed                                                                                                                                                        |
| Frontend TypeScript                   | Passed                                                                                                                                                        |
| Backend Vitest unit tests             | 13 passed                                                                                                                                                     |
| Frontend Vitest tests                 | 13 passed, including dashboard, transaction search and protected navigation                                                                                   |
| Backend production build              | Passed                                                                                                                                                        |
| Frontend Vite production build        | Passed                                                                                                                                                        |
| MySQL 8.4.5 binary and initialization | Binary runs and initial data directory created                                                                                                                |
| MySQL server startup                  | Blocked: Unix socket Operation not permitted                                                                                                                  |
| MySQL integration suite               | FAILED during setup: ECONNREFUSED; 24 tests skipped, zero verified                                                                                            |
| Offline init-file migration attempt   | Not a valid verification result: initialization returned SQL 1064 while processing the init-file representation; ordinary migration runner remains unverified |
| Browser preview                       | Blocked by environment: uv_interface_addresses, Operation not permitted                                                                                       |
| Playwright E2E                        | Written but not executed successfully here                                                                                                                    |
| GitHub Actions                        | Workflow prepared; no remote run                                                                                                                              |
| Vercel/Railway deployment             | Not performed                                                                                                                                                 |
| Public end-to-end verification        | Not performed                                                                                                                                                 |

The MySQL suite is intentionally not silently skipped when DATABASE_URL is missing or wrong. It refuses databases whose name does not end in \_test. The lab requires a separate \_lab database. CI provisions an actual mysql:8.4 service; mocks or SQLite do not count as evidence of MySQL semantics.

## Integration coverage

Balanced posting; same-key replay; conflicting-key rejection; insufficient funds; injected failure after balance updates; competing withdrawals; sender ownership; FK rejection; immutable ledger; audit capture; balance reconciliation; stored statement authorization; admin access; beneficiary CRUD; history and CSV; CSRF Origin; refresh replay; suspension; all ten isolated lab paths including actual deadlock detection and point/range isolation observations. A 25th integration test verifies a view-only SQL user cannot query the base ledger; it was added after the blocked 24-test attempt and remains unexecuted.

## Frontend and browser coverage

Component tests cover labeled auth forms, validation, exact formatting, transfer input, dashboard emptiness, history query parameters and protected navigation. Playwright covers registration, account creation, persistence after refresh, protected admin navigation, logout, admin overview and laboratory navigation. API/financial tests provide separate coverage for transfer correctness; browser transfer confirmation coverage should be extended after runtime integration is available.

## Reproduce

See README.md for Windows commands and .github/workflows/ci.yml for the full ordered Linux pipeline. Never run the failure-injection integration suite against production.
