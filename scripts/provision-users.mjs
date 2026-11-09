// Run once using the migration credential; never include credentials in command arguments.
import "dotenv/config";
import mysql from "mysql2/promise";
const url = new URL(process.env.MIGRATION_DATABASE_URL || "");
const database = decodeURIComponent(url.pathname.slice(1));
if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(database))
  throw Error("Unsafe database identifier");
const password = process.env.RUNTIME_DB_PASSWORD;
if (!password || password.length < 24)
  throw Error("Set a random RUNTIME_DB_PASSWORD of at least 24 characters");
const c = await mysql.createConnection(url.toString());
try {
  await c.query(
    "CREATE USER IF NOT EXISTS 'nexbank_runtime'@'%' IDENTIFIED BY ?",
    [password],
  );
  // Provisioning is idempotent; intentionally does not silently rotate an existing password.
  const db = mysql.escapeId(database);
  for (const table of [
    "users",
    "accounts",
    "transactions",
    "ledger_entries",
    "beneficiaries",
    "login_sessions",
    "idempotency_records",
    "audit_logs",
    "failed_attempts",
    "account_transaction_summary",
    "user_account_overview",
    "admin_transaction_statistics",
    "monthly_transaction_totals",
  ])
    await c.query(
      `GRANT SELECT ON ${db}.${mysql.escapeId(table)} TO 'nexbank_runtime'@'%'`,
    );
  for (const table of [
    "users",
    "accounts",
    "beneficiaries",
    "login_sessions",
    "failed_attempts",
    "audit_logs",
  ])
    await c.query(
      `GRANT INSERT ON ${db}.${mysql.escapeId(table)} TO 'nexbank_runtime'@'%'`,
    );
  await c.query(
    `GRANT UPDATE(full_name,phone,status) ON ${db}.users TO 'nexbank_runtime'@'%'`,
  );
  await c.query(
    `GRANT UPDATE(status) ON ${db}.accounts TO 'nexbank_runtime'@'%'`,
  );
  await c.query(
    `GRANT UPDATE(nickname),DELETE ON ${db}.beneficiaries TO 'nexbank_runtime'@'%'`,
  );
  await c.query(
    `GRANT UPDATE(revoked_at) ON ${db}.login_sessions TO 'nexbank_runtime'@'%'`,
  );
  for (const proc of [
    "transfer_funds",
    "controlled_adjustment",
    "account_statement",
    "transaction_summary",
  ])
    await c.query(
      `GRANT EXECUTE ON PROCEDURE ${db}.${mysql.escapeId(proc)} TO 'nexbank_runtime'@'%'`,
    );
  console.log(
    "Provisioned nexbank_runtime with restricted financial write privileges.",
  );
} finally {
  await c.end();
}
