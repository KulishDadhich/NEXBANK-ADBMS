import "dotenv/config";
import argon2 from "argon2";
import { randomUUID, randomBytes } from "node:crypto";
import { pool, rows } from "./pool.js";
import { hash } from "../services/auth.js";
export async function seed() {
  if (
    !process.env.ADMIN_EMAIL ||
    !process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD.length < 12
  )
    throw Error(
      "Provide ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters",
    );
  const [existing] = await rows("SELECT id FROM users WHERE email=?", [
    process.env.ADMIN_EMAIL,
  ]);
  let adminId = existing?.id;
  if (existing) {
    const [u] = await rows("SELECT role FROM users WHERE id=?", [existing.id]);
    if (u.role !== "ADMIN") throw Error("Refusing to elevate an existing user");
  } else {
    adminId = randomUUID();
    await rows(
      "INSERT INTO users(id,full_name,email,password_hash,role) VALUES(?,'NEXBANK Administrator',?,?,'ADMIN')",
      [
        adminId,
        process.env.ADMIN_EMAIL,
        await argon2.hash(process.env.ADMIN_PASSWORD),
      ],
    );
  }
  const [equity] = await rows(
    "SELECT id FROM accounts WHERE account_type='EQUITY'",
  );
  if (!equity) {
    const uid = randomUUID();
    await rows(
      "INSERT INTO users(id,full_name,email,password_hash,role) VALUES(?,'Simulation Treasury','treasury@nexbank.invalid',?,'SYSTEM')",
      [uid, await argon2.hash(randomBytes(48).toString("hex"))],
    );
    await rows(
      "INSERT INTO accounts(id,user_id,account_number,account_type) VALUES(?,?,'NX0000000000000000','EQUITY')",
      [randomUUID(), uid],
    );
  }
  if (process.env.SEED_DEMO === "true") {
    if (process.env.NODE_ENV === "production")
      throw Error("Demo seed forbidden in production");
    for (const [name, email, number] of [
      ["Alice Demo", "alice@nexbank.invalid", "NX1111111111111111"],
      ["Bob Demo", "bob@nexbank.invalid", "NX2222222222222222"],
    ]) {
      const [found] = await rows("SELECT id FROM users WHERE email=?", [email]);
      if (found) continue;
      const uid = randomUUID(),
        aid = randomUUID();
      await rows(
        "INSERT INTO users(id,full_name,email,password_hash) VALUES(?,?,?,?)",
        [uid, name, email, await argon2.hash(process.env.ADMIN_PASSWORD)],
      );
      await rows(
        "INSERT INTO accounts(id,user_id,account_number) VALUES(?,?,?)",
        [aid, uid, number],
      );
      await rows("CALL controlled_adjustment(?,?,?,?,?,?)", [
        adminId,
        aid,
        "1000000",
        "seed-" + aid,
        hash(aid),
        "Initial simulated demo balance",
      ]);
    }
  }
  console.log("Seed completed. No credentials printed.");
}
if (
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js")
) {
  await seed();
  await pool.end();
}
