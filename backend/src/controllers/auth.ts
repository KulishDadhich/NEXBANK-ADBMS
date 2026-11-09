import type { Response, RequestHandler } from "express";
import * as service from "../services/auth.js";
import { registerSchema, loginSchema } from "../validation/schemas.js";
const options = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: 7 * 86400000,
});
function respond(res: Response, s: { refresh: string; accessToken: string }) {
  res.cookie("refresh", s.refresh, options());
  res.json({ accessToken: s.accessToken });
}
export const register: RequestHandler = async (req, res) =>
  respond(res, await service.register(registerSchema.parse(req.body)));
export const login: RequestHandler = async (req, res) =>
  respond(res, await service.login(loginSchema.parse(req.body)));
export const refresh: RequestHandler = async (req, res) =>
  respond(res, await service.rotate(req.cookies.refresh || ""));
export const logout: RequestHandler = async (req, res) => {
  await service.logout(req.cookies.refresh || "");
  res.clearCookie("refresh", options());
  res.sendStatus(204);
};
