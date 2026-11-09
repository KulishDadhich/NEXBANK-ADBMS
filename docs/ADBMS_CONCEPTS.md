# Advanced DBMS concepts

| Concept           | Executable implementation                                                     | Evidence to inspect                                                              |
| ----------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Atomicity         | transfer_funds handler rolls back any SQL exception                           | Integration test injects a failure at metadata insertion, after balances changed |
| Consistency       | positive amount CHECK, nonnegative customer balances, balanced paired journal | account_transaction_summary and grouped journal reconciliation                   |
| Isolation         | InnoDB SELECT FOR UPDATE on owners then accounts                              | Two concurrent withdrawals; exactly one can spend scarce funds                   |
| Durability        | InnoDB committed transactions on persistent storage                           | Restart MySQL locally and compare persisted postings; not yet verified here      |
| Stored procedures | transfer_funds, controlled_adjustment, account_statement, transaction_summary | Actual CALLs in services and integration tests                                   |
| Triggers          | account_audit, immutable ledger/transaction triggers                          | Compare OLD and NEW in audit_logs                                                |
| Deadlocks         | Two lab sessions acquire opposite row locks                                   | MySQL errno 1213; losing transaction rolls back, full operation retries          |
| Isolation levels  | lab sets each of four SESSION levels                                          | Records actual values before, during and after a competing write                 |
| Indexes           | Unique and composite production indexes; 10,002-row seeded lab                | EXPLAIN ANALYZE before/after category index, no invented timings                 |
| Views             | Four reporting views                                                          | Statements and reports query aggregate/overview views                            |
| Constraints       | PK/FK/UNIQUE/NOT NULL/CHECK and restrictive deletes                           | Tests reject unknown FK and mutation of immutable ledger                         |
| Normalization     | users/accounts/transactions/ledger/beneficiaries split                        | ER diagram and functional-dependency explanation                                 |

## Run a laboratory experiment

Set backend/.env LAB_DATABASE_URL to a distinct isolated database ending \_lab. The application DB must have a different name. The lab credential needs CREATE/DROP TABLE, VIEW, TRIGGER, ROUTINE and ordinary DML on that lab database only.

```powershell
npm run db:lab -w backend -- rollback
npm run db:lab -w backend -- concurrency
npm run db:lab -w backend -- deadlock
npm run db:lab -w backend -- isolation
npm run db:lab -w backend -- indexing
```

The admin UI runs the same functions when LAB_ENABLED=true. Each invocation uses UUID-named temporary demonstration objects, its own two MySQL connections and cleanup in finally. These are real tables in the isolated lab database, not fake UI output.

The small lab transfer demonstrates transaction mechanics using two rows; the production posting procedure is independently exercised by integration tests. The procedure demonstration creates a small isolated routine and does not duplicate production ledger logic.

## What isolation observations mean

READ UNCOMMITTED can see a competing uncommitted value. READ COMMITTED sees a new committed value on a later statement. REPEATABLE READ preserves the consistent-read snapshot. SERIALIZABLE within an explicit transaction may block the writer with shared read locks, and the lab records its lock-wait timeout. These are predictions to compare with returned observations, not claimed outcomes from this environment.

The implemented experiment records both repeated point reads and range counts while another session inserts a matching row. InnoDB consistent reads and locking reads differ; do not generalize these observations to all MySQL statements. Runtime results remain unverified here.

## Least privilege and views

A view limits the shape of a query result, not who owns each row. The backend still filters user-owned accounts. Provisioning grants read access to views but no direct runtime writes to the financial ledger. A dedicated reporting-only SQL user can be granted SELECT on those views alone; that restricted-view-user demonstration remains to be verified on a running MySQL instance.
