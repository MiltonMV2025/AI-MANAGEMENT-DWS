import { useEffect, useMemo, useState } from "react";
import { PencilLine, Plus, Search, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "./app-shell";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";

type UserRole = "admin" | "user";

type ApiUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: string[];
  createdAt: string;
};

type CreateForm = {
  username: string;
  email: string;
  password: string;
  role: UserRole;
};

type EditForm = {
  username: string;
  email: string;
  password: string;
  role: UserRole;
};

const createFormDefault: CreateForm = {
  username: "",
  email: "",
  password: "",
  role: "user",
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function normalizeRole(value: unknown): UserRole {
  return String(value ?? "").trim().toLowerCase() === "admin" ? "admin" : "user";
}

function normalizeUser(item: unknown): ApiUser {
  const raw = item as Record<string, unknown>;
  const role = normalizeRole(raw.role);
  return {
    id: String(raw.id ?? ""),
    username: String(raw.username ?? "user"),
    email: String(raw.email ?? ""),
    role,
    permissions: Array.isArray(raw.permissions)
      ? raw.permissions.map((permission) => String(permission ?? "").trim()).filter(Boolean)
      : [],
    createdAt: String(raw.createdAt ?? ""),
  };
}

export function UserAdminPage({ apiBase }: { apiBase: string }): React.JSX.Element {
  const [authToken, setAuthToken] = useState("");
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(createFormDefault);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [userToEdit, setUserToEdit] = useState<ApiUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    username: "",
    email: "",
    password: "",
    role: "user",
  });

  useEffect(() => {
    const token = window.localStorage.getItem("auth_token") || "";
    const storedRole = window.localStorage.getItem("auth_role");
    const role = String(storedRole || "").toLowerCase();
    if (!token) {
      window.location.href = "/";
      return;
    }
    if (role && role !== "admin") {
      window.location.href = "/projects";
      return;
    }

    setAuthToken(token);
  }, []);

  useEffect(() => {
    if (!authToken) return;

    async function loadUsers(): Promise<void> {
      try {
        setLoading(true);
        setStatus("");
        const response = await fetch(`${apiBase}/api/admin/users`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 403) {
            window.location.href = "/projects";
            return;
          }
          throw new Error(data?.message || "Failed to load users.");
        }
        const normalized: ApiUser[] = Array.isArray(data.users) ? data.users.map((item: unknown) => normalizeUser(item)) : [];
        setUsers(normalized);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load users.");
      } finally {
        setLoading(false);
      }
    }

    void loadUsers();
  }, [apiBase, authToken]);

  const filteredUsers = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return users;
    return users.filter((user) => {
      return user.username.toLowerCase().includes(cleanQuery) || user.email.toLowerCase().includes(cleanQuery) || user.role.includes(cleanQuery);
    });
  }, [query, users]);

  async function createUser(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!authToken || creating) return;

    const username = createForm.username.trim();
    const email = createForm.email.trim().toLowerCase();
    const password = createForm.password;

    if (!username || !email || !password) {
      setStatus("Username, email and password are required.");
      return;
    }

    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }

    try {
      setCreating(true);
      setStatus("");
      const response = await fetch(`${apiBase}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          username,
          email,
          password,
          role: createForm.role,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          window.location.href = "/projects";
          return;
        }
        throw new Error(data?.message || "Failed to create user.");
      }

      const created = normalizeUser(data.user);
      setUsers((current) => [created, ...current]);
      setCreateForm(createFormDefault);
      setCreateOpen(false);
      setStatus(`User "${created.username}" created.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  }

  function openEditDialog(user: ApiUser): void {
    setUserToEdit(user);
    setEditForm({
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
    });
    setEditOpen(true);
  }

  async function updateUser(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!authToken || !userToEdit || editing) return;

    const username = editForm.username.trim();
    const email = editForm.email.trim().toLowerCase();
    const password = editForm.password;

    if (!username || !email) {
      setStatus("Username and email are required.");
      return;
    }
    if (password && password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }

    try {
      setEditing(true);
      setStatus("");
      const response = await fetch(`${apiBase}/api/admin/users/${userToEdit.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          username,
          email,
          role: editForm.role,
          password: password || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          window.location.href = "/projects";
          return;
        }
        throw new Error(data?.message || "Failed to update user.");
      }

      const updated = normalizeUser(data.user);
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      setEditOpen(false);
      setUserToEdit(null);
      setEditForm({ username: "", email: "", password: "", role: "user" });
      setStatus(`User "${updated.username}" updated.`);

      const currentUsername = window.localStorage.getItem("auth_username") || "";
      if (currentUsername && currentUsername === userToEdit.username) {
        window.localStorage.setItem("auth_username", updated.username);
        window.localStorage.setItem("auth_role", updated.role);
        if (updated.role !== "admin") {
          window.location.href = "/projects";
          return;
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update user.");
    } finally {
      setEditing(false);
    }
  }

  return (
    <AppShell active="users" title="User Administration" subtitle="Create users, assign roles, and update existing accounts.">
      <Card className="border border-border/70 bg-white shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl font-semibold">Workspace Users</CardTitle>
              <CardDescription>Manage who can access administrative and prompt configuration features.</CardDescription>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="h-11 min-w-[146px]">
              <Plus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full md:max-w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter users..." className="pl-9" />
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`user-skeleton-${index}`} className="h-20 animate-pulse rounded-xl border border-border/70 bg-muted/40" />
              ))}
            </div>
          ) : filteredUsers.length ? (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex flex-col gap-4 rounded-xl border border-border/70 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-semibold text-foreground">{user.username}</p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                          user.role === "admin"
                            ? "border-indigo-100 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                        }`}
                      >
                        {user.role === "admin" ? <ShieldCheck className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                        {user.role}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                      {user.permissions.length ? user.permissions.join(" · ") : "No elevated permissions"} · created {formatDate(user.createdAt)}
                    </p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => openEditDialog(user)}>
                    <PencilLine className="mr-2 h-4 w-4" />
                    Edit User
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-center">
              <p className="text-lg font-semibold text-foreground">No users found</p>
              <p className="text-sm text-muted-foreground">Create a new user account to grant workspace access.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Set initial credentials and role for the new account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createUser} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="create-username">
                Username
              </label>
              <Input
                id="create-username"
                value={createForm.username}
                onChange={(event) => setCreateForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="qa.lead"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="create-email">
                Email
              </label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="qa.lead@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="create-password">
                Password
              </label>
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Minimum 8 characters"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="create-role">
                Role
              </label>
              <select
                id="create-role"
                value={createForm.role}
                onChange={(event) => setCreateForm((current) => ({ ...current, role: normalizeRole(event.target.value) }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setUserToEdit(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update username, email, role, or set a new password. Leave password empty to keep current value.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={updateUser} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-username">
                Username
              </label>
              <Input
                id="edit-username"
                value={editForm.username}
                onChange={(event) => setEditForm((current) => ({ ...current, username: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-email">
                Email
              </label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-password">
                New Password (optional)
              </label>
              <Input
                id="edit-password"
                type="password"
                value={editForm.password}
                onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Leave empty to keep current password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-role">
                Role
              </label>
              <select
                id="edit-role"
                value={editForm.role}
                onChange={(event) => setEditForm((current) => ({ ...current, role: normalizeRole(event.target.value) }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={editing}>
                Cancel
              </Button>
              <Button type="submit" disabled={editing || !userToEdit}>
                {editing ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
