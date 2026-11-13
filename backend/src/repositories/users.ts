import { rows } from "../database/pool.js";
export type UserRecord = {
  id: string;
  status: string;
  role: string;
  passwordHash: string;
};
export async function findUserByEmail(
  email: string,
): Promise<UserRecord | undefined> {
  const [u] = await rows(
    "SELECT id,status,role,password_hash AS passwordHash FROM users WHERE email=?",
    [email],
  );
  return u as UserRecord | undefined;
}
export async function createUser(u: {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
}) {
  await rows(
    "INSERT INTO users(id,full_name,email,password_hash) VALUES(?,?,?,?)",
    [u.id, u.fullName, u.email, u.passwordHash],
  );
}
