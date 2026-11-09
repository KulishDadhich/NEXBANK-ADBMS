import { randomUUID, randomInt } from "node:crypto";
import { rows, pool } from "../database/pool.js";
import { hash } from "./auth.js";
import { parseMoney } from "../utilities/money.js";
import { ApiError } from "../utilities/errors.js";
export async function retryDeadlock<T>(fn: () => Promise<T>): Promise<T> {
  for (let n = 0; ; n++) {
    try {
      return await fn();
    } catch (e: any) {
      if (![1213, 1205].includes(e.errno) || n === 2) throw e;
      await new Promise((r) => setTimeout(r, 25 * 2 ** n + randomInt(25)));
    }
  }
}
export async function createAccount(userId: string, type: string) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    await c.execute("SELECT id FROM users WHERE id=? FOR UPDATE", [userId]);
    const [existing]: any = await c.execute(
      "SELECT id FROM accounts WHERE user_id=?",
      [userId],
    );
    if (existing.length >= 5) throw new ApiError(409, "Maximum five accounts");
    const id = randomUUID(),
      number = "NX" + Array.from({ length: 16 }, () => randomInt(10)).join("");
    await c.execute(
      "INSERT INTO accounts(id,user_id,account_number,account_type) VALUES(?,?,?,?)",
      [id, userId, number, type],
    );
    await c.commit();
    return { id, account_number: number };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function transfer(
  userId: string,
  data: {
    senderId: string;
    recipient: string;
    amount: string;
    description: string;
  },
  key: string,
) {
  const amount = parseMoney(data.amount);
  const [target] = await rows(
    "SELECT id FROM accounts WHERE account_number=?",
    [data.recipient],
  );
  if (!target) throw new ApiError(404, "Destination account not found");
  const digest = hash(
    JSON.stringify([data.senderId, target.id, amount, data.description]),
  );
  try {
    const result: any = await retryDeadlock(() =>
      rows("CALL transfer_funds(?,?,?,?,?,?,?,?)", [
        userId,
        data.senderId,
        target.id,
        amount,
        key,
        digest,
        data.description,
        "TRANSFER",
      ]),
    );
    const value = result[0][0].result;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (e: any) {
    await rows(
      "INSERT INTO failed_attempts(id,actor_user_id,reason,request_data) VALUES(?,?,?,?)",
      [
        randomUUID(),
        userId,
        e.sqlState === "45000" ? e.sqlMessage : "DATABASE_ERROR",
        JSON.stringify({
          senderId: data.senderId,
          recipient: data.recipient,
          amount,
        }),
      ],
    );
    throw e;
  }
}
export async function history(
  userId: string,
  query: Record<string, any>,
  all = false,
) {
  const page = Math.max(
      1,
      Math.min(10000, Math.floor(Number(query.page)) || 1),
    ),
    size = 20;
  const filters: string[] = [],
    args: any[] = [];
  if (!all) {
    filters.push("(s.user_id=? OR r.user_id=?)");
    args.push(userId, userId);
  }
  if (query.search) {
    filters.push("(t.reference_number LIKE ? OR t.description LIKE ?)");
    args.push(
      "%" + String(query.search).slice(0, 100) + "%",
      "%" + String(query.search).slice(0, 100) + "%",
    );
  }
  for (const [field, op] of [
    ["from", ">="],
    ["to", "<="],
  ] as const) {
    if (query[field]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(query[field]))
        throw new ApiError(400, "Invalid date");
      filters.push(`t.created_at ${op} ?`);
      args.push(
        query[field] + (field === "to" ? " 23:59:59.999" : " 00:00:00"),
      );
    }
  }
  if (query.status && query.status !== "COMPLETED") filters.push("1=0");
  const where = filters.length ? "WHERE " + filters.join(" AND ") : "";
  const base = `FROM transactions t JOIN accounts s ON s.id=t.sender_account_id JOIN accounts r ON r.id=t.receiver_account_id ${where}`;
  const [{ total }] = await rows("SELECT COUNT(*) AS total " + base, args);
  const items = await rows(
    `SELECT t.*,s.account_number AS sender_number,r.account_number AS receiver_number,s.user_id AS sender_user_id ${base} ORDER BY t.created_at ${query.sort === "asc" ? "ASC" : "DESC"},t.id LIMIT ${size} OFFSET ${(page - 1) * size}`,
    args,
  );
  return {
    items,
    total: Number(total),
    page,
    pages: Math.ceil(Number(total) / size),
  };
}
