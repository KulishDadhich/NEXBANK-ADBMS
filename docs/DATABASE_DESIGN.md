# Relational design

The executable schema is in database/migrations/001_core.sql and 002_procedures.sql. SQL migrations are authoritative; there is no ORM, all access goes through mysql2.

```mermaid
erDiagram
 users ||--o{ accounts : owns
 users ||--o{ beneficiaries : saves
 accounts ||--o{ beneficiaries : referenced
 users ||--o{ login_sessions : authenticates
 users ||--o{ idempotency_records : deduplicates
 users ||--o{ transactions : initiates
 accounts ||--o{ transactions : sends_or_receives
 transactions ||--|{ ledger_entries : posts
 accounts ||--o{ ledger_entries : records
 users ||--o{ failed_attempts : attempts
 users {
  char36 id PK
  varchar email UK
  varchar password_hash
  enum role
  enum status
 }
 accounts {
  char36 id PK
  char36 user_id FK
  varchar account_number UK
  bigint balance
  enum account_type
  enum status
 }
 transactions {
  char36 id PK
  varchar reference_number UK
  char36 actor_user_id FK
  char36 sender_account_id FK
  char36 receiver_account_id FK
  bigint amount
 }
 ledger_entries {
  bigint id PK
  char36 transaction_id FK
  char36 account_id FK
  bigint amount
 }
 beneficiaries {
  char36 id PK
  char36 user_id FK
  char36 beneficiary_account_id FK
  varchar nickname
 }
 login_sessions {
  char36 id PK
  char36 user_id FK
  char64 token_hash UK
  datetime expires_at
  datetime revoked_at
 }
 idempotency_records {
  bigint id PK
  char36 user_id FK
  varchar idempotency_key
  char64 request_hash
  json response_data
 }
 failed_attempts {
  char36 id PK
  char36 actor_user_id FK
  varchar reason
  json request_data
 }
```

Audit logs additionally store actor_user_id, action, table_name, record_id, OLD/NEW JSON and UTC creation time. Actor is an audit snapshot identifier, deliberately without a cascading relationship. Financial FKs use restrictive deletion. No user deletion endpoint exists. Beneficiaries are ordinary removable preferences; financial records cannot be deleted through the API.

## Normalization

1NF: scalar columns contain one value; users do not store lists of accounts or beneficiaries. Audit JSON stores historical snapshots, not active relational entities.
2NF: each non-key field depends on the entire primary key. Ledger uniqueness additionally covers (transaction_id, account_id); idempotency uniqueness covers (user_id, idempotency_key).
3NF: users hold identity; accounts reference users; ledger entries reference accounts and transactions. Names and email are not repeated in financial rows. The balance column is intentional denormalization: a transactionally maintained projection of SUM(ledger_entries.amount). Reconciliation detects divergence.

## Money and journal semantics

BIGINT holds exact paise. A positive ledger amount increases a customer's claim; a negative amount decreases it. Treasury equity may be negative to offset simulated issuance. Internal transfers preserve the sum of all balances. All JSON financial values are strings. Charts alone convert to Number for approximate visual display; postings never do.

Only the posting procedure writes ledger entries in the runtime privilege model. It inserts exactly two equal-and-opposite entries. CHECK constraints cannot enforce cross-row balancing in MySQL, so procedure-only write access plus reconciliation enforce that invariant. Immutable triggers prevent editing or deleting posted entries and transactions. They do not produce ledger entries.

## Indexes

Unique email, account number and reference indexes support direct lookups. Composite (sender_account_id,created_at), (receiver_account_id,created_at), (account_id,created_at) indexes support activity access. Additional timestamp indexes serve admin queries. Every index adds write and storage cost; use the isolated indexing lab to measure query plans rather than inventing performance numbers.

## SQL/application boundary

Backend: authenticate, parse strings, enforce request bounds, create a canonical request hash, map errors, retry complete procedure calls only for deadlocks/timeouts.
SQL: lock owners and accounts, enforce live statuses and sender ownership, check balance, debit, credit, post journal, store idempotency response, commit or rollback.

The controlled-adjustment procedure delegates to transfer_funds, avoiding a second independent posting implementation. Registration grants no balance. Seeding and admin simulated grants use the same procedure.
