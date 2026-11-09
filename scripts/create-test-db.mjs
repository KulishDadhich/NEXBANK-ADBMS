import mysql from "mysql2/promise";
const url = new URL(process.env.DATABASE_URL || "");
if (!url.pathname.endsWith("_test")) throw Error("Refusing non-test database");
const c = await mysql.createConnection(url.toString());
await c.query("CREATE DATABASE IF NOT EXISTS nexbank_lab");
await c.end();
