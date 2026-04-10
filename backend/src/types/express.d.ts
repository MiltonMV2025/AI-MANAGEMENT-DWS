import type { Permission, UserRole } from "../utils/access.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        userId: string;
        username: string;
        role: UserRole;
        permissions: Permission[];
      };
    }
  }
}

export {};
