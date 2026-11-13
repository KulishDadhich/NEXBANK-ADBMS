import "dotenv/config";
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
// AWS RDS: set DB_SSL_CA_FILE to the downloaded global-bundle.pem (or DB_SSL_CA to the PEM text).
const sslCa = process.env.DB_SSL_CA_FILE
  ? readFileSync(process.env.DB_SSL_CA_FILE, "utf8")
  : process.env.DB_SSL_CA;
export function connectPool(url: string) {
  return mysql.createPool({
    uri: url,
    connectionLimit: 10,
    supportBigNumbers: true,
    bigNumberStrings: true,
    timezone: "Z",
    multipleStatements: false,
    ...(sslCa ? { ssl: { ca: sslCa, rejectUnauthorized: true } } : {}),
  });
}
export const pool = connectPool(
  process.env.DATABASE_URL || "mysql://invalid@127.0.0.1:3306/nexbank",
);
export async function rows<T = Record<string, any>>(
  sql: string,
  args: any[] = [],
): Promise<T[]> {
  const [r] = await pool.execute(sql, args);
  return r as T[];
}
