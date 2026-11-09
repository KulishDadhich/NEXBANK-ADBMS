import { randomBytes, randomUUID, createHash } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { rows, pool } from "../database/pool.js";
import { findUserByEmail, prisma } from "../repositories/users.js";
import { ApiError } from "../utilities/errors.js";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32)
    throw Error("JWT_SECRET must contain at least 32 random characters");
  return s;
}
export function accessToken(userId: string) {
  return jwt.sign({ sub: userId }, jwtSecret(), {
    expiresIn: "10m",
    issuer: "nexbank",
    audience: "nexbank-web",
  });
}
async function newSession(userId: string) {
  const refresh = randomBytes(48).toString("base64url");
  await rows(
    "INSERT INTO login_sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 7 DAY))",
    [randomUUID(), userId, hash(refresh)],
  );
  return { accessToken: accessToken(userId), refresh };
}
export async function register(data: {
  fullName: string;
  email: string;
  password: string;
}) {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      fullName: data.fullName,
      email: data.email,
      passwordHash: await argon2.hash(data.password, { type: argon2.argon2id }),
    },
  });
  return newSession(id);
}
export async function login(data: { email: string; password: string }) {
  const u = await findUserByEmail(data.email);
  if (
    !u ||
    u.status !== "ACTIVE" ||
    u.role === "SYSTEM" ||
    !(await argon2.verify(u.passwordHash, data.password))
  )
    throw new ApiError(401, "Invalid email or password");
  return newSession(u.id);
}
export async function rotate(token: string) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [sessions]: any = await c.execute(
      "SELECT s.*,u.status,u.role FROM login_sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? FOR UPDATE",
      [hash(token)],
    );
    const s = sessions[0];
    if (
      !s ||
      s.revoked_at ||
      new Date(s.expires_at) < new Date() ||
      s.status !== "ACTIVE" ||
      s.role === "SYSTEM"
    )
      throw new ApiError(401, "Session expired");
    await c.execute(
      "UPDATE login_sessions SET revoked_at=UTC_TIMESTAMP(3) WHERE id=?",
      [s.id],
    );
    const refresh = randomBytes(48).toString("base64url");
    await c.execute(
      "INSERT INTO login_sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 7 DAY))",
      [randomUUID(), s.user_id, hash(refresh)],
    );
    await c.commit();
    return { accessToken: accessToken(s.user_id), refresh };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function logout(token: string) {
  await rows(
    "UPDATE login_sessions SET revoked_at=UTC_TIMESTAMP(3) WHERE token_hash=?",
    [hash(token)],
  );
}
