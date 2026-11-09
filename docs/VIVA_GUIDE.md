# NEXBANK viva guide

## One-minute introduction

NEXBANK is a simulated banking platform built to demonstrate advanced database concepts. Users can create accounts, transfer simulated money and inspect statements. MySQL stores every movement as two matching ledger entries. A transfer either finishes completely or rolls back completely. Administrators can review audit records and run isolated database experiments. It uses no real money. The project is intended to show why database correctness matters more than simply displaying a balance.

## Questions and answers

1. **What problem does NEXBANK solve?** It demonstrates reliable banking transactions and explains the database mechanisms behind them.
2. **Is it a real bank?** No. All balances and transfers are educational simulations.
3. **Why MySQL?** InnoDB supports transactions, row locking, relational constraints, procedures and triggers.
4. **What is ACID?** Atomicity, Consistency, Isolation and Durability: four properties of reliable transactions.
5. **What is atomicity?** Every step succeeds together, or all steps roll back. A debit cannot remain without its matching credit.
6. **What is consistency?** Rules remain true after a transaction, such as nonnegative customer balances and a balanced journal.
7. **What is isolation?** Concurrent operations cannot interfere in ways that violate the chosen transaction rules.
8. **What is durability?** Once committed, data should survive a restart, subject to storage and recovery configuration.
9. **What is a ledger?** A permanent record of financial movements, from which account balances can be reconstructed.
10. **Why two ledger entries?** One account loses what the other receives. Their sum is zero.
11. **Why not store only a balance?** An editable balance has no explanation or history. The ledger provides evidence and reconciliation.
12. **Why use BIGINT paise?** Integers represent money exactly. Floating-point arithmetic can introduce rounding errors.
13. **What is a primary key?** A column or set of columns that uniquely identifies a row.
14. **What is a foreign key?** A relationship that prevents references to nonexistent records.
15. **What is a CHECK constraint?** A database rule, such as amount greater than zero.
16. **What is normalization?** Organizing tables so data is not unnecessarily repeated and updates stay consistent.
17. **What is 1NF?** Columns contain atomic values, rather than lists of repeated values.
18. **What is 2NF?** Non-key columns depend on the entire primary key.
19. **What is 3NF?** Non-key columns depend directly on the key, not through another non-key column.
20. **Is the balance column normalized?** It is an intentional projection of the ledger, maintained transactionally for fast reads.
21. **What is a stored procedure?** SQL logic stored on the server. Our transfer procedure controls the full financial transaction.
22. **What is a trigger?** SQL that runs automatically after or before a table change. Our account trigger records audit snapshots.
23. **What are OLD and NEW?** The row values before and after an update, available inside a trigger.
24. **What does SELECT FOR UPDATE do?** It locks selected rows until commit or rollback, so competing writers must wait.
25. **What is a deadlock?** Two transactions each wait for a lock held by the other. MySQL aborts one so work can continue.
26. **How do we reduce deadlocks?** Lock the same kinds of rows in a consistent sorted order and keep transactions short.
27. **How do we retry safely?** Retry the entire rolled-back operation with the same idempotency key, a bounded count and backoff.
28. **What is idempotency?** Repeating the same request has the same effect as executing it once.
29. **What is a dirty read?** Reading another transaction's uncommitted change.
30. **What is a non-repeatable read?** Reading the same row twice and seeing a newly committed value the second time.
31. **What is a phantom read?** A repeated range query sees a changed set of matching rows. Behavior depends on isolation and read type.
32. **What is an index?** A lookup structure that speeds selected queries but adds storage and write work.
33. **What does EXPLAIN ANALYZE show?** The actual execution plan and measured execution behavior. Our lab obtains it from MySQL.
34. **What is a view?** A named query used like a table. It simplifies reports but does not replace user authorization.
35. **What is JWT?** A signed token containing identity claims and expiry; it is not a password or an encryption mechanism.
36. **Why Argon2id?** It is a password-hashing algorithm designed to make large-scale guessing expensive.
37. **What is refresh-token rotation?** Each successful refresh consumes the old token and issues a new one.
38. **What is CORS?** Browser rules controlling which origins may read cross-origin API responses; it does not replace authentication.
39. **What is CI/CD here?** GitHub verifies code and SQL behavior; only successful verification can reach the deployment job.
40. **Why separate the lab database?** Demonstrations intentionally cause failures and conflicts, so they must never touch normal user records.

## Five-minute demonstration order

1. Explain the simulation boundary and open an account.
2. Use a controlled simulated grant, then review and confirm a transfer.
3. Show the two ledger entries, statement and unchanged total balance.
4. Show audit records and one isolated rollback/concurrency experiment.
5. Show the ER diagram, actual test output and the CI release gate.

Only demonstrate steps that have actually passed in your running environment. Do not describe unexecuted tests or unavailable deployments as successful.
