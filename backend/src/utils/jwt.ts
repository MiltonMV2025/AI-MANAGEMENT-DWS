import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { normalizeUserRole, type UserRole } from "./access.js";

export type AccessTokenPayload = {
  sub: string;
  username: string;
  role: UserRole;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  const secret = env.jwtSecret as Secret;
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, secret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as {
    sub?: unknown;
    username?: unknown;
    role?: unknown;
  };

  const sub = String(decoded.sub ?? "").trim();
  const username = String(decoded.username ?? "").trim();
  if (!sub || !username) {
    throw new Error("Invalid token payload");
  }

  return {
    sub,
    username,
    role: normalizeUserRole(decoded.role),
  };
}
