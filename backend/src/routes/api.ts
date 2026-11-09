import { Router } from "express";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import * as auth from "../controllers/auth.js";
import { authenticate, admin } from "../middleware/auth.js";
import { rows, pool } from "../database/pool.js";
import {
  createAccount,
  transfer,
  history,
  retryDeadlock,
} from "../services/banking.js";
import { transferSchema, beneficiarySchema } from "../validation/schemas.js";
import { ApiError } from "../utilities/errors.js";
import { csvCell, parseMoney } from "../utilities/money.js";
import { hash } from "../services/auth.js";
import { runLab, experiments } from "../database/lab.js";
export const api = Router();
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
api.post("/auth/register", authLimit, auth.register);
api.post("/auth/login", authLimit, auth.login);
api.post("/auth/refresh", authLimit, auth.refresh);
api.post("/auth/logout", auth.logout);
api.use(authenticate);
api.get("/me", (req, res) => res.json(req.user));
api.patch("/me", async (req, res) => {
  const data = z
    .object({
      fullName: z.string().trim().min(2).max(100),
      phone: z.string().max(30).default(""),
    })
    .parse(req.body);
  await rows("UPDATE users SET full_name=?,phone=? WHERE id=?", [
    data.fullName,
    data.phone,
    req.user!.id,
  ]);
  res.json({ success: true });
});
api.get("/accounts", async (req, res) =>
  res.json(
    await rows("SELECT * FROM accounts WHERE user_id=? ORDER BY created_at", [
      req.user!.id,
    ]),
  ),
);
api.post("/accounts", async (req, res) => {
  const { type } = z
    .object({ type: z.enum(["SAVINGS", "CURRENT"]) })
    .parse(req.body);
  res.status(201).json(await createAccount(req.user!.id, type));
});
api.get("/accounts/:id", async (req, res) => {
  const [a] = await rows("SELECT * FROM accounts WHERE id=? AND user_id=?", [
    req.params.id,
    req.user!.id,
  ]);
  if (!a) throw new ApiError(404, "Account not found");
  const entries = await rows(
    "SELECT l.*,t.reference_number,t.description FROM ledger_entries l JOIN transactions t ON t.id=l.transaction_id WHERE l.account_id=? ORDER BY l.id DESC LIMIT 100",
    [a.id],
  );
  res.json({ account: a, entries });
});
api.get("/accounts/:id/statement", async (req, res) => {
  const result: any = await rows("CALL account_statement(?,?)", [
    req.user!.id,
    req.params.id,
  ]);
  const csv = [
    "Reference,UTC date,Description,Amount (paise)",
    ...result[0].map((r: any) =>
      [
        r.reference_number,
        new Date(r.created_at).toISOString(),
        r.description,
        r.amount,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");
  res.type("text/csv").attachment("nexbank-statement.csv").send(csv);
});
api.get("/analytics", async (req, res) => {
  const result: any = await rows("CALL transaction_summary(?)", [req.user!.id]);
  res.json(result[0]);
});
api.post(
  "/transfers",
  rateLimit({ windowMs: 60000, limit: 20 }),
  async (req, res) => {
    const key = z
      .string()
      .min(16)
      .max(100)
      .parse(req.headers["idempotency-key"]);
    res
      .status(201)
      .json(await transfer(req.user!.id, transferSchema.parse(req.body), key));
  },
);
api.get("/transactions", async (req, res) =>
  res.json(await history(req.user!.id, req.query)),
);
api.get("/transactions/:id", async (req, res) => {
  const [t] = await rows(
    "SELECT t.* FROM transactions t JOIN accounts s ON s.id=t.sender_account_id JOIN accounts r ON r.id=t.receiver_account_id WHERE t.id=? AND (s.user_id=? OR r.user_id=?)",
    [req.params.id, req.user!.id, req.user!.id],
  );
  if (!t) throw new ApiError(404, "Transaction not found");
  res.json(t);
});
api.get("/beneficiaries", async (req, res) =>
  res.json(
    await rows(
      "SELECT b.*,a.account_number FROM beneficiaries b JOIN accounts a ON a.id=b.beneficiary_account_id WHERE b.user_id=?",
      [req.user!.id],
    ),
  ),
);
api.post("/beneficiaries", async (req, res) => {
  const b = beneficiarySchema.parse(req.body);
  const [a] = await rows(
    "SELECT id FROM accounts WHERE account_number=? AND status='ACTIVE' AND account_type<>'EQUITY'",
    [b.accountNumber],
  );
  if (!a) throw new ApiError(404, "Account not found");
  const id = randomUUID();
  await rows(
    "INSERT INTO beneficiaries(id,user_id,beneficiary_account_id,nickname) VALUES(?,?,?,?)",
    [id, req.user!.id, a.id, b.nickname],
  );
  res.status(201).json({ id });
});
api.patch("/beneficiaries/:id", async (req, res) => {
  const nickname = z.string().trim().min(1).max(80).parse(req.body.nickname);
  const [b] = await rows(
    "SELECT id FROM beneficiaries WHERE id=? AND user_id=?",
    [req.params.id, req.user!.id],
  );
  if (!b) throw new ApiError(404, "Beneficiary not found");
  await rows("UPDATE beneficiaries SET nickname=? WHERE id=? AND user_id=?", [
    nickname,
    req.params.id,
    req.user!.id,
  ]);
  res.json({ success: true });
});
api.delete("/beneficiaries/:id", async (req, res) => {
  await rows("DELETE FROM beneficiaries WHERE id=? AND user_id=?", [
    req.params.id,
    req.user!.id,
  ]);
  res.sendStatus(204);
});
api.use("/admin", admin);
api.get("/admin/overview", async (_req, res) => {
  const [statistics] = await rows("SELECT * FROM admin_transaction_statistics");
  const [counts] = await rows(
    "SELECT (SELECT COUNT(*) FROM users WHERE role<>'SYSTEM') AS users,(SELECT COUNT(*) FROM accounts WHERE account_type<>'EQUITY') AS accounts,(SELECT COUNT(*) FROM failed_attempts) AS failed",
  );
  res.json({ ...statistics, ...counts });
});
api.get("/admin/users", async (_req, res) =>
  res.json(
    await rows(
      "SELECT id,full_name,email,role,status,created_at FROM users WHERE role<>'SYSTEM' ORDER BY created_at DESC LIMIT 200",
    ),
  ),
);
api.patch("/admin/users/:id", async (req, res) => {
  const status = z.enum(["ACTIVE", "SUSPENDED"]).parse(req.body.status);
  if (req.params.id === req.user!.id)
    throw new ApiError(400, "Cannot suspend yourself");
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [u]: any = await c.execute(
      "SELECT id,status FROM users WHERE id=? AND role='USER' FOR UPDATE",
      [req.params.id],
    );
    if (!u.length) throw new ApiError(404, "User not found");
    await c.execute("UPDATE users SET status=? WHERE id=?", [
      status,
      req.params.id,
    ]);
    await c.execute(
      "INSERT INTO audit_logs(actor_user_id,action,table_name,record_id,old_values,new_values) VALUES(?,'USER_STATUS','users',?,?,?)",
      [
        req.user!.id,
        req.params.id,
        JSON.stringify({ status: u[0].status }),
        JSON.stringify({ status }),
      ],
    );
    await c.commit();
    res.json({ success: true });
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
});
api.get("/admin/accounts", async (_req, res) =>
  res.json(
    await rows(
      "SELECT * FROM user_account_overview ORDER BY full_name LIMIT 200",
    ),
  ),
);
api.patch("/admin/accounts/:id", async (req, res) => {
  const status = z.enum(["ACTIVE", "FROZEN"]).parse(req.body.status);
  const c = await pool.getConnection();
  try {
    await c.query("SET @actor_id=?", [req.user!.id]);
    await c.execute(
      "UPDATE accounts SET status=? WHERE id=? AND account_type<>'EQUITY'",
      [status, req.params.id],
    );
    res.json({ success: true });
  } finally {
    await c.query("SET @actor_id=NULL");
    c.release();
  }
});
api.post("/admin/adjustments", async (req, res) => {
  const b = z
    .object({
      accountId: z.uuid(),
      amount: z.string(),
      reason: z.string().trim().min(10).max(255),
    })
    .parse(req.body);
  const key = z.string().min(16).max(100).parse(req.headers["idempotency-key"]);
  const amount = parseMoney(b.amount);
  const result: any = await retryDeadlock(() =>
    rows("CALL controlled_adjustment(?,?,?,?,?,?)", [
      req.user!.id,
      b.accountId,
      amount,
      key,
      hash(JSON.stringify([b.accountId, amount, b.reason])),
      b.reason,
    ]),
  );
  res.json(result[0][0].result);
});
api.get("/admin/transactions", async (req, res) =>
  res.json(await history(req.user!.id, req.query, true)),
);
api.get("/admin/failures", async (req, res) => {
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(req.query.page)) || 1),
  );
  const conditions: string[] = [];
  const args: any[] = [];
  if (req.query.search) {
    conditions.push("(reason LIKE ? OR actor_user_id LIKE ?)");
    const value = "%" + String(req.query.search).slice(0, 100) + "%";
    args.push(value, value);
  }
  for (const [key, op] of [
    ["from", ">="],
    ["to", "<="],
  ] as const) {
    if (req.query[key]) {
      const value = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .parse(req.query[key]);
      conditions.push("created_at " + op + " ?");
      args.push(value + (key === "to" ? " 23:59:59.999" : " 00:00:00"));
    }
  }
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const [{ total }] = await rows(
    "SELECT COUNT(*) AS total FROM failed_attempts" + where,
    args,
  );
  const items = await rows(
    "SELECT * FROM failed_attempts" +
      where +
      " ORDER BY created_at DESC LIMIT 20 OFFSET " +
      (page - 1) * 20,
    args,
  );
  res.json({
    items,
    total: Number(total),
    page,
    pages: Math.ceil(Number(total) / 20),
  });
});
api.get("/admin/audit", async (_req, res) =>
  res.json(await rows("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100")),
);
api.get("/admin/database", async (_req, res) => {
  const [version] = await rows(
    "SELECT VERSION() AS version,@@transaction_isolation AS isolation",
  );
  const reconciliation = await rows(
    "SELECT * FROM account_transaction_summary WHERE balance<>ledger_balance",
  );
  const imbalance = await rows(
    "SELECT transaction_id FROM ledger_entries GROUP BY transaction_id HAVING SUM(amount)<>0 OR COUNT(*)<>2",
  );
  res.json({ ...version, reconciliation, imbalance });
});
api.get("/admin/lab", (_req, res) =>
  res.json({ enabled: process.env.LAB_ENABLED === "true", experiments }),
);
api.post(
  "/admin/lab/:experiment",
  rateLimit({ windowMs: 60000, limit: 5 }),
  async (req, res) => {
    if (process.env.LAB_ENABLED !== "true")
      throw new ApiError(
        503,
        "Laboratory execution disabled; run the isolated local laboratory",
      );
    res.json(await runLab(String(req.params.experiment)));
  },
);
