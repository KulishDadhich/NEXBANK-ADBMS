import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../services/auth.js";
import { rows } from "../database/pool.js";
import { ApiError } from "../utilities/errors.js";
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        full_name: string;
        email: string;
        phone?: string;
      };
    }
  }
}
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const value = req.headers.authorization?.replace(/^Bearer /, "");
    if (!value) throw new ApiError(401, "Sign in required");
    let payload;
    try {
      payload = jwt.verify(value, jwtSecret(), {
        algorithms: ["HS256"],
        issuer: "nexbank",
        audience: "nexbank-web",
      });
    } catch {
      throw new ApiError(401, "Session expired");
    }
    if (typeof payload === "string" || !payload.sub)
      throw new ApiError(401, "Invalid token");
    const [user] = await rows(
      "SELECT id,role,full_name,email,phone FROM users WHERE id=? AND status='ACTIVE' AND role<>'SYSTEM'",
      [payload.sub],
    );
    if (!user) throw new ApiError(401, "Account inactive");
    req.user = user as any;
    next();
  } catch (e) {
    next(e);
  }
};
export const admin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== "ADMIN")
    return next(new ApiError(403, "Administrator access required"));
  next();
};
