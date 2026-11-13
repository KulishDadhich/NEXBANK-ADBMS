// One-command local setup: node scripts/setup-local.mjs <mysql-root-password> [host] [port]
// Creates .env and backend/.env with random secrets (never overwrites existing files).
import { writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
const [pw, host = "127.0.0.1", port = "3306"] = process.argv.slice(2);
if (!pw) {
  console.error("Usage: node scripts/setup-local.mjs <mysql-root-password> [host] [port]");
  process.exit(1);
}
const enc = encodeURIComponent(pw);
const url = (db) => `mysql://root:${enc}@${host}:${port}/${db}`;
const adminPass = randomBytes(9).toString("base64url") + "-Aa1";
const backendEnv = `NODE_ENV=development
PORT=4000
DATABASE_URL=${url("nexbank")}
MIGRATION_DATABASE_URL=${url("nexbank")}
JWT_SECRET=${randomBytes(32).toString("hex")}
FRONTEND_ORIGINS=http://localhost:5173
ADMIN_EMAIL=admin@nexbank.local
ADMIN_PASSWORD=${adminPass}
SEED_DEMO=true
LAB_ENABLED=true
LAB_DATABASE_URL=${url("nexbank_lab")}
`;
for (const [file, body] of [
  ["backend/.env", backendEnv],
  [".env", backendEnv + `MYSQL_ROOT_PASSWORD=${pw}\nMYSQL_PASSWORD=${randomBytes(12).toString("hex")}\n`],
]) {
  if (existsSync(file)) console.log(file, "already exists - left unchanged");
  else { writeFileSync(file, body); console.log("created", file); }
}
console.log(`\nAdmin login: admin@nexbank.local / ${adminPass}`);
console.log("Demo users: alice@nexbank.invalid and bob@nexbank.invalid (same password as admin)");
