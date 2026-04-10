export type UserRole = "admin" | "user";
export type Permission = "prompt_panel:read" | "prompt_panel:write" | "users:manage";

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: ["prompt_panel:read", "prompt_panel:write", "users:manage"],
  user: [],
};

export function normalizeUserRole(value: unknown): UserRole {
  return String(value ?? "").trim().toLowerCase() === "admin" ? "admin" : "user";
}

export function getRolePermissions(role: UserRole): Permission[] {
  return [...rolePermissions[role]];
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
