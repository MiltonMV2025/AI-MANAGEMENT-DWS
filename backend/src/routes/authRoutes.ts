import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAdmin, requireAuth } from "../middleware/requireAuth.js";
import { deterministicDecryptEmail, deterministicEncryptEmail, hashSha256 } from "../utils/crypto.js";
import { signAccessToken } from "../utils/jwt.js";
import { getRolePermissions, normalizeUserRole, type UserRole } from "../utils/access.js";

type LoginRow = {
  id: string;
  username: string;
  role_key: string | null;
};

type UserRow = {
  id: string;
  username: string;
  email_encrypted: string;
  password_sha256: string;
  role_key: string | null;
  created_at: string;
};

export const authRouter = Router();

function toApiUser(user: UserRow) {
  const role = normalizeUserRole(user.role_key);
  return {
    id: user.id,
    username: user.username,
    email: deterministicDecryptEmail(user.email_encrypted),
    role,
    permissions: getRolePermissions(role),
    createdAt: user.created_at,
  };
}

function isUniqueConstraintError(rawMessage: string): boolean {
  return (
    rawMessage.includes("UX_users_username") ||
    rawMessage.includes("UX_users_email_encrypted") ||
    rawMessage.includes("UNIQUE KEY") ||
    rawMessage.includes("duplicate")
  );
}

function parseRoleOrFallback(value: unknown, fallbackRole: UserRole): UserRole {
  const clean = String(value ?? "").trim().toLowerCase();
  if (!clean) return fallbackRole;
  if (clean === "admin" || clean === "user") return clean;
  throw new Error("Role must be 'admin' or 'user'.");
}

authRouter.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required." });
      return;
    }

    const encryptedEmail = deterministicEncryptEmail(email);
    const passwordHash = hashSha256(password);

    const result = await query<LoginRow>(
      `
      SELECT TOP 1 id, username, role_key
      FROM users
      WHERE email_encrypted = $1
        AND password_sha256 = $2
      `,
      [encryptedEmail, passwordHash]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ message: "Invalid credentials." });
      return;
    }

    const role = normalizeUserRole(user.role_key);
    const token = signAccessToken({ sub: user.id, username: user.username, role });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role,
        permissions: getRolePermissions(role),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login error";
    res.status(500).json({ message });
  }
});

authRouter.get("/auth/me", requireAuth, async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const result = await query<UserRow>(
    "SELECT TOP 1 id, username, email_encrypted, password_sha256, role_key, created_at FROM users WHERE id = $1",
    [authUser.userId]
  );

  const user = result.rows[0];
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ user: toApiUser(user) });
});

authRouter.put("/auth/profile", requireAuth, async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const { username, email, currentPassword, newPassword } = req.body as {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const cleanUsername = String(username ?? "").trim();
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  const current = String(currentPassword ?? "");
  const next = String(newPassword ?? "");

  if (!cleanUsername || !cleanEmail) {
    res.status(400).json({ message: "username and email are required." });
    return;
  }

  if (!cleanEmail.includes("@")) {
    res.status(400).json({ message: "Please provide a valid email." });
    return;
  }

  const currentUser = await query<UserRow>(
    "SELECT TOP 1 id, username, email_encrypted, password_sha256, role_key, created_at FROM users WHERE id = $1",
    [authUser.userId]
  );

  const user = currentUser.rows[0];
  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  let nextPasswordHash = user.password_sha256;
  if (next) {
    if (!current) {
      res.status(400).json({ message: "Current password is required to set a new password." });
      return;
    }

    if (next.length < 8) {
      res.status(400).json({ message: "New password must be at least 8 characters." });
      return;
    }

    const currentHash = hashSha256(current);
    if (currentHash !== user.password_sha256) {
      res.status(400).json({ message: "Current password is incorrect." });
      return;
    }

    if (current === next) {
      res.status(400).json({ message: "New password must be different from current password." });
      return;
    }

    nextPasswordHash = hashSha256(next);
  }

  const nextEmailEncrypted = deterministicEncryptEmail(cleanEmail);

  try {
    const updated = await query<UserRow>(
      `
      UPDATE users
      SET username = $2,
          email_encrypted = $3,
          password_sha256 = $4
      OUTPUT inserted.id, inserted.username, inserted.email_encrypted, inserted.password_sha256, inserted.role_key, inserted.created_at
      WHERE id = $1
      `,
      [authUser.userId, cleanUsername, nextEmailEncrypted, nextPasswordHash]
    );

    const saved = updated.rows[0];
    if (!saved) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    res.json({ user: toApiUser(saved) });
  } catch (error) {
    const err = error as { message?: string };
    const rawMessage = String(err?.message ?? "");
    if (isUniqueConstraintError(rawMessage)) {
      res.status(409).json({ message: "Username or email is already in use." });
      return;
    }
    const message = error instanceof Error ? error.message : "Profile update failed";
    res.status(500).json({ message });
  }
});

authRouter.post("/auth/change-password", requireAuth, async (req, res) => {
  const authUser = req.authUser;
  if (!authUser) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  const current = String(currentPassword ?? "");
  const next = String(newPassword ?? "");

  if (!current || !next) {
    res.status(400).json({ message: "currentPassword and newPassword are required." });
    return;
  }

  if (next.length < 8) {
    res.status(400).json({ message: "New password must be at least 8 characters." });
    return;
  }

  if (current === next) {
    res.status(400).json({ message: "New password must be different from current password." });
    return;
  }

  const currentHash = hashSha256(current);
  const nextHash = hashSha256(next);

  const updated = await query<{ id: string }>(
    `
    UPDATE users
    SET password_sha256 = $3
    OUTPUT inserted.id
    WHERE id = $1
      AND password_sha256 = $2
    `,
    [authUser.userId, currentHash, nextHash]
  );

  if (!updated.rows[0]) {
    res.status(400).json({ message: "Current password is incorrect." });
    return;
  }

  res.json({ message: "Password updated successfully." });
});

authRouter.get("/admin/users", requireAuth, requireAdmin, async (_req, res) => {
  const users = await query<UserRow>(
    `
    SELECT id, username, email_encrypted, password_sha256, role_key, created_at
    FROM users
    ORDER BY created_at DESC
    `
  );

  res.json({
    users: users.rows.map((user) => toApiUser(user)),
  });
});

authRouter.post("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const payload = req.body as {
    username?: unknown;
    email?: unknown;
    password?: unknown;
    role?: unknown;
  };

  const username = String(payload.username ?? "").trim();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");

  let role: UserRole;
  try {
    role = parseRoleOrFallback(payload.role, "user");
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid role." });
    return;
  }

  if (!username || !email || !password) {
    res.status(400).json({ message: "username, email and password are required." });
    return;
  }

  if (!email.includes("@")) {
    res.status(400).json({ message: "Please provide a valid email." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ message: "Password must be at least 8 characters." });
    return;
  }

  const emailEncrypted = deterministicEncryptEmail(email);
  const passwordHash = hashSha256(password);

  try {
    const created = await query<UserRow>(
      `
      INSERT INTO users (username, email_encrypted, password_sha256, role_key)
      OUTPUT inserted.id, inserted.username, inserted.email_encrypted, inserted.password_sha256, inserted.role_key, inserted.created_at
      VALUES ($1, $2, $3, $4)
      `,
      [username, emailEncrypted, passwordHash, role]
    );

    res.status(201).json({
      user: toApiUser(created.rows[0]),
    });
  } catch (error) {
    const rawMessage = String((error as { message?: string })?.message ?? "");
    if (isUniqueConstraintError(rawMessage)) {
      res.status(409).json({ message: "Username or email is already in use." });
      return;
    }
    const message = error instanceof Error ? error.message : "User creation failed";
    res.status(500).json({ message });
  }
});

authRouter.put("/admin/users/:userId", requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const payload = req.body as {
    username?: unknown;
    email?: unknown;
    password?: unknown;
    role?: unknown;
  };

  const currentUser = await query<UserRow>(
    "SELECT TOP 1 id, username, email_encrypted, password_sha256, role_key, created_at FROM users WHERE id = $1",
    [userId]
  );
  const existingUser = currentUser.rows[0];
  if (!existingUser) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  const username =
    payload.username === undefined ? existingUser.username : String(payload.username ?? "").trim();
  const email =
    payload.email === undefined
      ? deterministicDecryptEmail(existingUser.email_encrypted).toLowerCase()
      : String(payload.email ?? "").trim().toLowerCase();

  let role: UserRole;
  try {
    role = parseRoleOrFallback(payload.role, normalizeUserRole(existingUser.role_key));
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid role." });
    return;
  }

  if (!username || !email) {
    res.status(400).json({ message: "username and email are required." });
    return;
  }

  if (!email.includes("@")) {
    res.status(400).json({ message: "Please provide a valid email." });
    return;
  }

  const passwordCandidate = String(payload.password ?? "");
  const updatePassword = passwordCandidate.length > 0;
  if (updatePassword && passwordCandidate.length < 8) {
    res.status(400).json({ message: "Password must be at least 8 characters." });
    return;
  }

  const emailEncrypted = deterministicEncryptEmail(email);
  const nextPasswordHash = updatePassword ? hashSha256(passwordCandidate) : existingUser.password_sha256;

  try {
    const updated = await query<UserRow>(
      `
      UPDATE users
      SET username = $2,
          email_encrypted = $3,
          password_sha256 = $4,
          role_key = $5
      OUTPUT inserted.id, inserted.username, inserted.email_encrypted, inserted.password_sha256, inserted.role_key, inserted.created_at
      WHERE id = $1
      `,
      [userId, username, emailEncrypted, nextPasswordHash, role]
    );

    const saved = updated.rows[0];
    if (!saved) {
      res.status(404).json({ message: "User not found." });
      return;
    }

    res.json({ user: toApiUser(saved) });
  } catch (error) {
    const rawMessage = String((error as { message?: string })?.message ?? "");
    if (isUniqueConstraintError(rawMessage)) {
      res.status(409).json({ message: "Username or email is already in use." });
      return;
    }
    const message = error instanceof Error ? error.message : "User update failed";
    res.status(500).json({ message });
  }
});
