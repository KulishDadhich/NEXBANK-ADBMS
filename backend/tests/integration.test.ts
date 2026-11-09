import "dotenv/config";
import mysql from "mysql2/promise";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { pool, rows } from "../src/database/pool.js";
import { migrate } from "../src/database/migrate.js";
import { seed } from "../src/database/seed.js";
import { app } from "../src/app.js";
import { prisma } from "../src/repositories/users.js";
import { hash } from "../src/services/auth.js";
import { runLab } from "../src/database/lab.js";
const origin = "http://localhost:5173",
  password = "Test-only-long-password-123!";
let tokenA = "",
  tokenB = "",
  adminToken = "",
  a = "",
  b = "",
  userA = "",
  numberB = "";
const post = (path: string, token = "") =>
  request(app)
    .post("/api" + path)
    .set("Origin", origin)
    .set("Authorization", "Bearer " + token);
beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw Error("Tests require an isolated DATABASE_URL ending _test");
  process.env.JWT_SECRET = "test-only-jwt-secret-at-least-32-characters";
  process.env.ADMIN_EMAIL = "admin@test.invalid";
  process.env.ADMIN_PASSWORD = password;
  await migrate(url);
  await seed();
  const suffix = randomUUID();
  const ra = await post("/auth/register").send({
    fullName: "Alice Test",
    email: `a-${suffix}@test.invalid`,
    password,
  });
  expect(ra.status).toBe(200);
  tokenA = ra.body.accessToken;
  const rb = await post("/auth/register").send({
    fullName: "Bob Test",
    email: `b-${suffix}@test.invalid`,
    password,
  });
  tokenB = rb.body.accessToken;
  const me = await request(app)
    .get("/api/me")
    .set("Authorization", "Bearer " + tokenA);
  userA = me.body.id;
  const admin = await post("/auth/login").send({
    email: process.env.ADMIN_EMAIL,
    password,
  });
  adminToken = admin.body.accessToken;
  const aa = await post("/accounts", tokenA).send({ type: "SAVINGS" }),
    bb = await post("/accounts", tokenB).send({ type: "SAVINGS" });
  expect(aa.status).toBe(201);
  a = aa.body.id;
  b = bb.body.id;
  numberB = bb.body.account_number;
  const grant = await post("/admin/adjustments", adminToken)
    .set("Idempotency-Key", randomUUID())
    .send({
      accountId: a,
      amount: "1000.00",
      reason: "Isolated integration test funding",
    });
  expect(grant.status).toBe(200);
}, 60000);
afterAll(async () => {
  await pool.end();
  await prisma.$disconnect();
});
const balances = () =>
  rows("SELECT id,balance FROM accounts WHERE id IN (?,?) ORDER BY id", [a, b]);
const send = (amount: string, key = randomUUID()) =>
  post("/transfers", tokenA).set("Idempotency-Key", key).send({
    senderId: a,
    recipient: numberB,
    amount,
    description: "Integration transfer",
  });
describe("MySQL financial behavior", () => {
  it("posts a balanced transfer and replays the same key exactly once", async () => {
    const key = randomUUID();
    const first = await send("100", key),
      second = await send("100", key);
    expect(first.status).toBe(201);
    expect(second.body.reference).toBe(first.body.reference);
    const [ledger] = await rows(
      "SELECT COUNT(*) AS count,SUM(amount) AS net FROM ledger_entries WHERE transaction_id=?",
      [first.body.id],
    );
    expect(Number(ledger.count)).toBe(2);
    expect(BigInt(ledger.net)).toBe(0n);
    expect((await send("101", key)).status).toBe(409);
  });
  it("rolls back insufficient funds without changing balances", async () => {
    const before = await balances();
    expect((await send("999999")).status).toBe(409);
    expect(await balances()).toEqual(before);
  });
  it("rolls back a failure injected after debit and credit", async () => {
    const before = await balances();
    await pool.query(
      "CREATE TRIGGER test_fail_post BEFORE INSERT ON transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CONTROLLED_TEST_FAILURE'",
    );
    try {
      expect((await send("1")).status).toBe(409);
      expect(await balances()).toEqual(before);
    } finally {
      await pool.query("DROP TRIGGER test_fail_post");
    }
  });
  it("prevents concurrent overdraft", async () => {
    const outcomes = await Promise.all([send("700"), send("700")]);
    expect(outcomes.map((r) => r.status).sort()).toEqual([201, 409]);
    const [source] = await rows("SELECT balance FROM accounts WHERE id=?", [a]);
    expect(BigInt(source.balance)).toBe(20000n);
  });
  it("rejects unauthorized sources", async () => {
    const r = await post("/transfers", tokenB)
      .set("Idempotency-Key", randomUUID())
      .send({ senderId: a, recipient: numberB, amount: "1" });
    expect(r.status).toBe(403);
  });
  it("enforces foreign keys and ledger immutability", async () => {
    await expect(
      rows("INSERT INTO accounts(id,user_id,account_number) VALUES(?,?,?)", [
        randomUUID(),
        randomUUID(),
        "NX9999999999999999",
      ]),
    ).rejects.toBeDefined();
    await expect(
      rows("UPDATE ledger_entries SET amount=1 LIMIT 1"),
    ).rejects.toBeDefined();
  });
  it("has audit rows and reconciles every account", async () => {
    const [count] = await rows("SELECT COUNT(*) AS n FROM audit_logs");
    expect(Number(count.n)).toBeGreaterThan(0);
    expect(
      await rows(
        "SELECT * FROM account_transaction_summary WHERE balance<>ledger_balance",
      ),
    ).toEqual([]);
  });
  it("executes statements and summary procedures with authorization", async () => {
    const statement = await rows<any>("CALL account_statement(?,?)", [
      userA,
      a,
    ]);
    expect(statement[0].length).toBeGreaterThan(0);
    await expect(
      rows("CALL account_statement(?,?)", [randomUUID(), a]),
    ).rejects.toBeDefined();
  });
});
it("allows a view-only SQL user to read the view but denies ledger access", async () => {
  const url = new URL(process.env.DATABASE_URL!);
  const schema = mysql.escapeId(url.pathname.slice(1));
  const name = "test_view_" + randomUUID().slice(0, 8),
    password = randomUUID() + randomUUID();
  await pool.query("CREATE USER ?@'%' IDENTIFIED BY ?", [name, password]);
  let connection: mysql.Connection | undefined;
  try {
    await pool.query(
      `GRANT SELECT ON ${schema}.user_account_overview TO ?@'%'`,
      [name],
    );
    url.username = name;
    url.password = password;
    connection = await mysql.createConnection(url.toString());
    const [result] = await connection.query(
      "SELECT * FROM user_account_overview",
    );
    expect(Array.isArray(result)).toBe(true);
    await expect(
      connection.query("SELECT * FROM ledger_entries"),
    ).rejects.toBeDefined();
  } finally {
    await connection?.end();
    await pool.query("DROP USER ?@'%'", [name]);
  }
});
describe("API behavior", () => {
  it("protects admin endpoints and unauthenticated account access", async () => {
    expect(
      (
        await request(app)
          .get("/api/admin/overview")
          .set("Authorization", "Bearer " + tokenA)
      ).status,
    ).toBe(403);
    expect((await request(app).get("/api/accounts")).status).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/admin/overview")
          .set("Authorization", "Bearer " + adminToken)
      ).status,
    ).toBe(200);
  });
  it("creates, edits and deletes a beneficiary", async () => {
    const r = await post("/beneficiaries", tokenA).send({
      nickname: "Bob",
      accountNumber: numberB,
    });
    expect(r.status).toBe(201);
    expect(
      (
        await request(app)
          .patch("/api/beneficiaries/" + r.body.id)
          .set("Origin", origin)
          .set("Authorization", "Bearer " + tokenA)
          .send({ nickname: "Bob Savings" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .delete("/api/beneficiaries/" + r.body.id)
          .set("Origin", origin)
          .set("Authorization", "Bearer " + tokenA)
      ).status,
    ).toBe(204);
  });
  it("filters history and serves statements", async () => {
    const r = await request(app)
      .get("/api/transactions?search=Integration")
      .set("Authorization", "Bearer " + tokenA);
    expect(r.body.items.length).toBeGreaterThan(0);
    const csv = await request(app)
      .get("/api/accounts/" + a + "/statement")
      .set("Authorization", "Bearer " + tokenA);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain("Amount (paise)");
  });
  it("rejects cross-origin mutations", async () => {
    expect(
      (
        await request(app)
          .post("/api/auth/login")
          .set("Origin", "https://evil.invalid")
          .send({})
      ).status,
    ).toBe(403);
  });
  it("rotates refresh tokens and rejects replay", async () => {
    const login = await post("/auth/login").send({
      email: process.env.ADMIN_EMAIL,
      password,
    });
    const cookie = login.headers["set-cookie"][0].split(";")[0];
    const rotated = await post("/auth/refresh").set("Cookie", cookie).send({});
    expect(rotated.status).toBe(200);
    expect(
      (await post("/auth/refresh").set("Cookie", cookie).send({})).status,
    ).toBe(401);
  });
  it("rejects suspended users immediately even with an existing JWT", async () => {
    await rows("UPDATE users SET status='SUSPENDED' WHERE id=?", [userA]);
    expect(
      (
        await request(app)
          .get("/api/accounts")
          .set("Authorization", "Bearer " + tokenA)
      ).status,
    ).toBe(401);
    await rows("UPDATE users SET status='ACTIVE' WHERE id=?", [userA]);
  });
});
describe("isolated laboratory", () => {
  it.each([
    "acid",
    "rollback",
    "procedure",
    "trigger",
    "concurrency",
    "deadlock",
    "isolation",
    "indexing",
    "normalization",
    "views",
  ])(
    "runs %s with real MySQL",
    async (id) => {
      const r = await runLab(id);
      expect(r.experiment).toBe(id);
      if (id === "rollback") expect(r.after).toEqual(r.before);
      if (id === "deadlock")
        expect(r.outcomes.some((o: any) => o.errno === 1213)).toBe(true);
      if (id === "concurrency")
        expect(
          r.outcomes.filter((o: string) => o === "Committed"),
        ).toHaveLength(1);
    },
    30000,
  );
});
