# Verification record

The authoritative evidence is GitHub Actions on isolated MySQL 8.4 databases. The original local runtime could not open sockets; those local failures are superseded by the remote checks recorded below. Production deployment verification remains separate.

## Successful run — 10 November 2026

[GitHub Actions run #5](https://github.com/KulishDadhich/NEXBANK-ADBMS/actions/runs/42765079615), code revision `63c2e33e4e88b0e76298266be6c318984e0ea4b0`:

| Check | Result |
| --- | --- |
| Dependency installation | Passed |
| Backend and frontend TypeScript | Passed |
| Backend unit tests | 13 passed |
| Frontend component tests | 13 passed |
| Real MySQL integration tests | 25 passed |
| Backend and frontend production builds | Passed |
| Chromium installation and Playwright E2E | 2 passed |
| Tracked sensitive-path check | Passed; not a full secret scanner |
| Production deployment | Not configured; deploy job disabled |

Browser coverage includes registration, account creation, session refresh, user/admin navigation, logout, admin login, overview and laboratory navigation. API tests cover the financial behavior separately. This is evidence of the automated test scope, not a claim that every possible behavior or public deployment has been verified.

## CI repairs

- Accept numeric `1` or string `"1"` from mysql2 GET_LOCK, while still rejecting unsuccessful lock acquisition.
- Execute rollback-test CREATE/DROP TRIGGER DDL through `pool.query`, because the prepared statement protocol does not support that command.
- Pin Ubuntu 24.04 for Playwright 1.56.1; ubuntu-latest migrated to unsupported Ubuntu 26.04.
- Use explicit IPv4 readiness/proxy addresses and the compiled backend in CI; pipe server startup logs into the job output.

## Integration coverage

Balanced posting; same-key replay; conflicting-key rejection; insufficient funds; injected failure after balance updates; competing withdrawals; sender ownership; FK rejection; immutable ledger; audit capture; balance reconciliation; stored statement authorization; admin access; beneficiary CRUD; history and CSV; CSRF Origin; refresh replay; suspension; all ten isolated lab paths including actual deadlock detection and point/range isolation observations. The suite also verifies that a view-only SQL user cannot query the base ledger.

## Frontend and browser coverage

Component tests cover labeled auth forms, validation, exact formatting, transfer input, dashboard emptiness, history query parameters and protected navigation. Playwright covers registration, account creation, persistence after refresh, protected admin navigation, logout, admin overview and laboratory navigation. API/financial tests provide separate coverage for transfer correctness; browser transfer confirmation coverage should be extended after runtime integration is available.

## Reproduce

See README.md for Windows commands and .github/workflows/ci.yml for the full ordered Linux pipeline. Never run the failure-injection integration suite against production.
