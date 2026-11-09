import { randomUUID } from "node:crypto";
import { connectPool } from "./pool.js";
import { retryDeadlock } from "../services/banking.js";
export const experiments = [
  { id: "acid", name: "ACID transaction" },
  { id: "rollback", name: "Rollback after a partial debit" },
  { id: "procedure", name: "Stored procedure" },
  { id: "trigger", name: "Audit trigger" },
  { id: "concurrency", name: "Competing withdrawals" },
  { id: "deadlock", name: "Deadlock victim and retry" },
  { id: "isolation", name: "Four isolation levels" },
  { id: "indexing", name: "EXPLAIN ANALYZE" },
  { id: "normalization", name: "Keys and normalization" },
  { id: "views", name: "Database views" },
];
export async function runLab(experiment: string) {
  if (!experiments.some((e) => e.id === experiment))
    throw Error("Unknown experiment");
  const url = process.env.LAB_DATABASE_URL;
  if (
    !url ||
    !new URL(url).pathname.endsWith("_lab") ||
    new URL(url).pathname === new URL(process.env.DATABASE_URL || url).pathname
  )
    throw Error("A distinct LAB_DATABASE_URL ending _lab is required");
  const db = connectPool(url),
    a = await db.getConnection(),
    b = await db.getConnection();
  const suffix = randomUUID().replaceAll("-", ""),
    table = "lab_" + suffix,
    log = "audit_" + suffix;
  const evidence: any = {
    experiment,
    startedAt: new Date().toISOString(),
    database: new URL(url).pathname,
  };
  try {
    await a.query(
      `CREATE TABLE ${table}(id INT PRIMARY KEY,balance BIGINT NOT NULL CHECK(balance>=0),category INT NOT NULL DEFAULT 0) ENGINE=InnoDB`,
    );
    await a.query(`INSERT INTO ${table}(id,balance) VALUES(1,100),(2,100)`);
    const snapshot = async () => {
      const [r] = await a.query(`SELECT * FROM ${table} ORDER BY id`);
      return r;
    };
    evidence.before = await snapshot();
    if (experiment === "acid" || experiment === "rollback") {
      await a.beginTransaction();
      await a.query(`UPDATE ${table} SET balance=balance-30 WHERE id=1`);
      if (experiment === "rollback") {
        await a.rollback();
        evidence.operations = [
          "BEGIN",
          "Debit 30",
          "Controlled failure",
          "ROLLBACK",
        ];
      } else {
        await a.query(`UPDATE ${table} SET balance=balance+30 WHERE id=2`);
        await a.commit();
        evidence.operations = ["BEGIN", "Debit 30", "Credit 30", "COMMIT"];
      }
    }
    if (experiment === "procedure") {
      await a.query(
        `CREATE PROCEDURE proc_${suffix}() BEGIN START TRANSACTION; UPDATE ${table} SET balance=balance-10 WHERE id=1; UPDATE ${table} SET balance=balance+10 WHERE id=2; COMMIT; END`,
      );
      await a.query(`CALL proc_${suffix}()`);
      evidence.invocation = `CALL proc_${suffix}()`;
    }
    if (experiment === "trigger") {
      await a.query(
        `CREATE TABLE ${log}(old_balance BIGINT,new_balance BIGINT)`,
      );
      await a.query(
        `CREATE TRIGGER trigger_${suffix} AFTER UPDATE ON ${table} FOR EACH ROW INSERT INTO ${log} VALUES(OLD.balance,NEW.balance)`,
      );
      await a.query(`UPDATE ${table} SET balance=90 WHERE id=1`);
      const [audit] = await a.query(`SELECT * FROM ${log}`);
      evidence.audit = audit;
    }
    if (experiment === "concurrency") {
      const withdraw = async (c: typeof a) => {
        await c.beginTransaction();
        const [r]: any = await c.query(
          `SELECT balance FROM ${table} WHERE id=1 FOR UPDATE`,
        );
        if (BigInt(r[0].balance) < 80n) {
          await c.rollback();
          return "Rejected: insufficient balance";
        }
        await c.query(`UPDATE ${table} SET balance=balance-80 WHERE id=1`);
        await c.query(`UPDATE ${table} SET balance=balance+80 WHERE id=2`);
        await c.commit();
        return "Committed";
      };
      evidence.outcomes = await Promise.all([withdraw(a), withdraw(b)]);
    }
    if (experiment === "deadlock") {
      await a.beginTransaction();
      await b.beginTransaction();
      await a.query(`UPDATE ${table} SET balance=balance+1 WHERE id=1`);
      await b.query(`UPDATE ${table} SET balance=balance+1 WHERE id=2`);
      const finish = async (c: typeof a, id: number) => {
        try {
          await c.query(`UPDATE ${table} SET balance=balance+1 WHERE id=${id}`);
          await c.commit();
          return { status: "committed" };
        } catch (e: any) {
          await c.rollback();
          return { status: "rolled back", errno: e.errno };
        }
      };
      evidence.outcomes = await Promise.all([finish(a, 2), finish(b, 1)]);
      evidence.retry = await retryDeadlock(async () => {
        await a.beginTransaction();
        try {
          await a.query(`SELECT id FROM ${table} ORDER BY id FOR UPDATE`);
          await a.query(`UPDATE ${table} SET balance=balance+1`);
          await a.commit();
          return "Victim operation retried completely in deterministic lock order";
        } catch (e) {
          await a.rollback();
          throw e;
        }
      });
    }
    if (experiment === "isolation") {
      evidence.observations = [];
      for (const level of [
        "READ UNCOMMITTED",
        "READ COMMITTED",
        "REPEATABLE READ",
        "SERIALIZABLE",
      ]) {
        await a.query(`SET SESSION TRANSACTION ISOLATION LEVEL ${level}`);
        await b.query("SET SESSION innodb_lock_wait_timeout=1");
        await a.query(`UPDATE ${table} SET balance=100 WHERE id=1`);
        await a.beginTransaction();
        const [first] = await a.query(
          `SELECT balance FROM ${table} WHERE id=1`,
        );
        let concurrent: any = "committed";
        await b.beginTransaction();
        try {
          await b.query(`UPDATE ${table} SET balance=120 WHERE id=1`);
          const [during] = await a.query(
            `SELECT balance FROM ${table} WHERE id=1`,
          );
          await b.commit();
          const [after] = await a.query(
            `SELECT balance FROM ${table} WHERE id=1`,
          );
          evidence.observations.push({
            level,
            first,
            uncommittedRead: during,
            afterCommit: after,
            concurrent,
          });
        } catch (e: any) {
          await b.rollback();
          concurrent = {
            errno: e.errno,
            meaning: "Writer blocked by serializable reader",
          };
          evidence.observations.push({ level, first, concurrent });
        } finally {
          await a.rollback();
        }
      }
      evidence.rangeObservations = [];
      for (const level of [
        "READ UNCOMMITTED",
        "READ COMMITTED",
        "REPEATABLE READ",
        "SERIALIZABLE",
      ]) {
        await a.query(`SET SESSION TRANSACTION ISOLATION LEVEL ${level}`);
        await a.query(`DELETE FROM ${table} WHERE id=3`);
        await a.beginTransaction();
        const [first] = await a.query(
          `SELECT COUNT(*) AS matching FROM ${table} WHERE category=42`,
        );
        await b.beginTransaction();
        try {
          await b.query(
            `INSERT INTO ${table}(id,balance,category) VALUES(3,100,42)`,
          );
          const [during] = await a.query(
            `SELECT COUNT(*) AS matching FROM ${table} WHERE category=42`,
          );
          await b.commit();
          const [after] = await a.query(
            `SELECT COUNT(*) AS matching FROM ${table} WHERE category=42`,
          );
          evidence.rangeObservations.push({
            level,
            first,
            uncommittedRange: during,
            afterCommit: after,
          });
        } catch (error: any) {
          await b.rollback();
          evidence.rangeObservations.push({
            level,
            first,
            blockedWriter: { errno: error.errno },
          });
        } finally {
          await a.rollback();
        }
      }
      evidence.note =
        "Actual point and range consistent-read observations in explicit transactions. SERIALIZABLE may block the competing writer. These results do not generalize to every locking-read pattern.";
    }
    if (experiment === "indexing") {
      for (let offset = 0; offset < 10000; offset += 500) {
        const values = Array.from({ length: 500 }, (_, i) => [
          offset + i + 3,
          100,
          (offset + i) % 1000,
        ]);
        await a.query(`INSERT INTO ${table}(id,balance,category) VALUES ?`, [
          values,
        ]);
      }
      const [before] = await a.query(
        `EXPLAIN ANALYZE SELECT * FROM ${table} WHERE category=431`,
      );
      await a.query(`CREATE INDEX ix_category ON ${table}(category)`);
      const [after] = await a.query(
        `EXPLAIN ANALYZE SELECT * FROM ${table} WHERE category=431`,
      );
      evidence.plans = { before, after };
      evidence.seedRows = 10002;
    }
    if (experiment === "normalization") {
      const [ddl] = await a.query(`SHOW CREATE TABLE ${table}`);
      evidence.ddl = ddl;
      evidence.explanation =
        "Atomic values satisfy 1NF. The single-column primary key avoids partial key dependencies (2NF). Balance and category depend directly on that key (3NF). Production users, accounts, postings and beneficiaries are separate relations.";
    }
    if (experiment === "views") {
      await a.query(
        `CREATE VIEW view_${suffix} AS SELECT id,balance FROM ${table}`,
      );
      const [r] = await a.query(`SELECT * FROM view_${suffix}`);
      evidence.viewRows = r;
      evidence.note =
        "A view exposes selected columns. GRANT controls DB privileges; API ownership checks still apply.";
    }
    evidence.after =
      experiment === "indexing" ? { rows: 10002 } : await snapshot();
    return evidence;
  } finally {
    await a.rollback();
    await b.rollback();
    await a.query(`DROP VIEW IF EXISTS view_${suffix}`);
    await a.query(`DROP PROCEDURE IF EXISTS proc_${suffix}`);
    await a.query(`DROP TABLE IF EXISTS ${table}`);
    await a.query(`DROP TABLE IF EXISTS ${log}`);
    a.release();
    b.release();
    await db.end();
  }
}
