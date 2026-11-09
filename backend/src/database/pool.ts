import "dotenv/config";
import mysql from "mysql2/promise";
export function connectPool(url: string) {
  return mysql.createPool({
    uri: url,
    connectionLimit: 10,
    supportBigNumbers: true,
    bigNumberStrings: true,
    timezone: "Z",
    multipleStatements: false,
    ...(process.env.DB_SSL_CA
      ? { ssl: { ca: process.env.DB_SSL_CA, rejectUnauthorized: true } }
      : {}),
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
