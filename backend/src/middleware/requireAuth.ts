import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { getRolePermissions, roleHasPermission } from "../utils/access.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = header.replace("Bearer ", "").trim();
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.authUser = {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      permissions: getRolePermissions(payload.role),
    };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authUser = req.authUser;
  if (!authUser) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (!roleHasPermission(authUser.role, "users:manage")) {
    res.status(403).json({ message: "Admin access required." });
    return;
  }

  next();
}
