import mysql from "mysql2/promise";
import { readFileSync, existsSync } from "node:fs";

const [pw, host = "127.0.0.1", port = "3306", dbUser = process.env.DB_USER || "admin"] = process.argv.slice(2);
if (pw === undefined) {
  console.error("Usage: node scripts/create-dbs.mjs <password> [host] [port] [user]");
  process.exit(1);
}

let ssl;
const caPath = process.env.DB_SSL_CA_FILE || "global-bundle.pem";
if (existsSync(caPath)) {
  ssl = { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true };
}

let c;
try {
  c = await mysql.createConnection({
    host,
    port: Number(port),
    user: dbUser,
    password: pw,
    ...(ssl ? { ssl } : {}),
  });
} catch (err) {
  if (dbUser === "admin" && (err.code === "ER_ACCESS_DENIED_ERROR" || err.message?.includes("Access denied"))) {
    c = await mysql.createConnection({
      host,
      port: Number(port),
      user: "root",
      password: pw,
      ...(ssl ? { ssl } : {}),
    });
  } else {
    throw err;
  }
}

for (const db of ["nexbank", "nexbank_test", "nexbank_lab"]) {
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${db}\`;`);
  console.log(`Database '${db}' verified/created.`);
}

await c.end();
console.log("All databases ready.");
