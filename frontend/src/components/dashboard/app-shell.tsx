import { Activity, LayoutDashboard, LogOut, PanelTop, Settings, ShieldUser, UserCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

type AppShellProps = {
  active: "projects" | "prompt" | "users" | "support" | "terms" | "settings";
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
};

function getStoredRole(): string {
  if (typeof window === "undefined") return "user";

  const directRole = String(window.localStorage.getItem("auth_role") || "").toLowerCase();
  if (directRole === "admin" || directRole === "user") return directRole;

  const token = window.localStorage.getItem("auth_token") || "";
  if (!token) return "user";

  try {
    const payload = token.split(".")[1];
    if (!payload) return "user";
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(window.atob(base64)) as { role?: unknown };
    const tokenRole = String(decoded.role ?? "").toLowerCase();
    if (tokenRole === "admin" || tokenRole === "user") {
      window.localStorage.setItem("auth_role", tokenRole);
      return tokenRole;
    }
  } catch {
    return "user";
  }

  return "user";
}

export function AppShell({ active, title, subtitle, children, headerAction }: AppShellProps): React.JSX.Element {
  const username = typeof window !== "undefined" ? window.localStorage.getItem("auth_username") || "user" : "user";
  const role = getStoredRole();
  const isAdmin = role === "admin";

  function logout(): void {
    window.localStorage.removeItem("auth_token");
    window.localStorage.removeItem("auth_username");
    window.localStorage.removeItem("auth_role");
    window.location.href = "/";
  }

  return (
    <div className="grid min-h-screen bg-[#f5f7fc] md:grid-cols-[260px_1fr]">
      <aside className="flex flex-col border-r border-border/80 bg-[#eef2fa] p-4 md:p-5">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">Niro</p>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Precision Testing</p>
          </div>
        </div>

        <nav className="space-y-1 text-sm">
          <a
            href="/projects"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200",
              active === "projects"
                ? "bg-white font-semibold text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:bg-white hover:text-foreground"
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            Projects
          </a>
          {isAdmin ? (
            <a
              href="/prompt-panel"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200",
                active === "prompt"
                  ? "bg-white font-semibold text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-white hover:text-foreground"
              )}
            >
              <PanelTop className="h-4 w-4" />
              Prompt Panel
            </a>
          ) : null}
          {isAdmin ? (
            <a
              href="/user-admin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200",
                active === "users"
                  ? "bg-white font-semibold text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-white hover:text-foreground"
              )}
            >
              <ShieldUser className="h-4 w-4" />
              User Admin
            </a>
          ) : null}
          <a
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200",
              active === "settings"
                ? "bg-white font-semibold text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:bg-white hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </a>
        </nav>

        <div className="mt-auto border-t pt-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Account
          </p>
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-border/70 bg-white px-3 py-2 text-sm font-medium text-foreground shadow-sm">
            <UserCircle2 className="h-4 w-4 text-muted-foreground" />
            <span>{username}</span>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start px-3 text-muted-foreground transition-all duration-200 hover:bg-white hover:text-foreground"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <section className="min-h-screen">
        <header className="border-b border-border/80 bg-white px-5 py-4 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {headerAction}
          </div>
        </header>

        <div className="space-y-6 px-5 py-6 md:px-8">{children}</div>
      </section>
    </div>
  );
}
