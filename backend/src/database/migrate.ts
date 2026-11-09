import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { connectPool } from "./pool.js";
export function splitSql(source: string) {
  let delimiter = ";",
    buffer = "",
    statements: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("DELIMITER ")) {
      delimiter = line.slice(10).trim();
      continue;
    }
    buffer += line + "\n";
    if (buffer.trimEnd().endsWith(delimiter)) {
      statements.push(buffer.trimEnd().slice(0, -delimiter.length));
      buffer = "";
    }
  }
  if (buffer.trim()) throw new Error("Unterminated migration statement");
  return statements;
}
export async function migrate(url: string) {
  const db = connectPool(url),
    c = await db.getConnection();
  try {
    const [lock]: any = await c.query(
      "SELECT GET_LOCK('nexbank_migrations',30) AS acquired",
    );
    if (lock[0].acquired !== 1) throw Error("Migration lock unavailable");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) PRIMARY KEY,checksum CHAR(64) NOT NULL,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    );
    const dir = fileURLToPath(
      new URL("../../../database/migrations/", import.meta.url),
    );
    for (const name of (await readdir(dir))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      const src = await readFile(dir + name, "utf8"),
        hash = createHash("sha256").update(src).digest("hex");
      const [old]: any = await c.execute(
        "SELECT checksum FROM schema_migrations WHERE name=?",
        [name],
      );
      if (old.length) {
        if (old[0].checksum !== hash)
          throw Error("Applied migration changed: " + name);
        continue;
      }
      for (const sql of splitSql(src)) await c.query(sql);
      await c.execute(
        "INSERT INTO schema_migrations(name,checksum) VALUES(?,?)",
        [name, hash],
      );
      console.log("Applied", name);
    }
  } finally {
    await c.query("SELECT RELEASE_LOCK('nexbank_migrations')");
    c.release();
    await db.end();
  }
}
if (
  process.argv[1]?.endsWith("migrate.ts") ||
  process.argv[1]?.endsWith("migrate.js")
) {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw Error("MIGRATION_DATABASE_URL required");
  await migrate(url);
  process.exit(0);
}
