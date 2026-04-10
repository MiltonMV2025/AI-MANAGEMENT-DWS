import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { AppShell } from "./app-shell";
import { IconPicker } from "./icon-picker";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { getIconByName, type IconName } from "../../lib/icon-library";

type ApiProject = {
  id: string;
  name: string;
  description: string | null;
  iconName: string;
  createdAt: string;
  sessionCount: number;
};

type ApiSession = {
  id: string;
  name: string;
  iconName: string;
  status: string;
  createdAt: string;
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getStatusMeta(rawStatus: string): { label: string; textClassName: string; dotClassName: string; badgeClassName: string } {
  const normalized = rawStatus.toLowerCase();
  if (normalized === "synced") {
    return {
      label: "SENT TO TRELLO",
      textClassName: "text-emerald-700",
      dotClassName: "bg-emerald-500",
      badgeClassName: "bg-emerald-50 border-emerald-100",
    };
  }
  if (normalized === "draft") {
    return {
      label: "DRAFT",
      textClassName: "text-slate-600",
      dotClassName: "bg-slate-400",
      badgeClassName: "bg-slate-100 border-slate-200",
    };
  }
  if (normalized === "preview_ready") {
    return {
      label: "PREVIEW READY",
      textClassName: "text-blue-700",
      dotClassName: "bg-blue-500",
      badgeClassName: "bg-blue-50 border-blue-100",
    };
  }
  if (normalized === "partial") {
    return {
      label: "PARTIAL",
      textClassName: "text-amber-700",
      dotClassName: "bg-amber-500",
      badgeClassName: "bg-amber-50 border-amber-100",
    };
  }
  if (normalized === "error") {
    return {
      label: "ERROR",
      textClassName: "text-red-700",
      dotClassName: "bg-red-500",
      badgeClassName: "bg-red-50 border-red-100",
    };
  }

  return {
    label: normalized.toUpperCase(),
    textClassName: "text-slate-600",
    dotClassName: "bg-slate-400",
    badgeClassName: "bg-slate-100 border-slate-200",
  };
}

function formatSessionCount(value: number): string {
  return String(value).padStart(2, "0");
}

export function ProjectDetailPage({ apiBase }: { apiBase: string }): React.JSX.Element {
  const [authToken, setAuthToken] = useState("");
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState<ApiProject | null>(null);
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sessionQuery, setSessionQuery] = useState("");
  const [status, setStatus] = useState("");

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [sessionIcon, setSessionIcon] = useState<IconName>("folder");
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteSessionDialogOpen, setDeleteSessionDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ApiSession | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("auth_token") || "";
    if (!token) {
      window.location.href = "/";
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get("projectId") || "";
    if (!id) {
      window.location.href = "/projects";
      return;
    }

    setAuthToken(token);
    setProjectId(id);
  }, []);

  useEffect(() => {
    if (!projectId || !authToken) return;

    async function loadProjectData(): Promise<void> {
      try {
        setLoadingData(true);
        setStatus("");

        const projectResponse = await fetch(`${apiBase}/api/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const projectData = await projectResponse.json();
        if (!projectResponse.ok) {
          throw new Error(projectData?.message || "Failed to load project.");
        }

        setProject({
          id: String(projectData.project.id),
          name: String(projectData.project.name || "Untitled project"),
          description: projectData.project.description ? String(projectData.project.description) : null,
          iconName: String(projectData.project.iconName || "folder"),
          createdAt: String(projectData.project.createdAt || ""),
          sessionCount: Number(projectData.project.sessionCount ?? 0),
        });

        const sessionsResponse = await fetch(`${apiBase}/api/projects/${projectId}/sessions`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const sessionsData = await sessionsResponse.json();
        if (!sessionsResponse.ok) {
          throw new Error(sessionsData?.message || "Failed to load sessions.");
        }

        const normalized: ApiSession[] = (sessionsData.sessions || []).map((session: any) => ({
          id: String(session.id),
          name: String(session.name || "Untitled session"),
          iconName: String(session.iconName || "folder"),
          status: String(session.status || "draft"),
          createdAt: String(session.createdAt || ""),
        }));

        setSessions(normalized);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load project.");
      } finally {
        setLoadingData(false);
      }
    }

    void loadProjectData();
  }, [apiBase, authToken, projectId]);

  function openSessionDetail(sessionId: string): void {
    const params = new URLSearchParams({ projectId, sessionId });
    window.location.href = `/session-preview?${params.toString()}`;
  }

  async function handleCreateSession(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!authToken || !projectId) return;

    const cleanName = sessionName.trim();
    if (!cleanName) return;

    try {
      setSessionSubmitting(true);
      const response = await fetch(`${apiBase}/api/projects/${projectId}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: cleanName,
          iconName: sessionIcon,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to create session.");
      }

      setSessionDialogOpen(false);
      setSessionName("");
      setSessionIcon("folder");

      const params = new URLSearchParams({ projectId, sessionId: String(data.session.id) });
      window.location.href = `/session-detail?${params.toString()}`;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create session.");
    } finally {
      setSessionSubmitting(false);
    }
  }

  async function handleDeleteProject(): Promise<void> {
    if (!authToken || !projectId || deletingProject) return;
    try {
      setDeletingProject(true);
      const response = await fetch(`${apiBase}/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to delete project.");
      }

      window.location.href = "/projects";
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete project.");
    } finally {
      setDeletingProject(false);
      setDeleteProjectDialogOpen(false);
    }
  }

  function openDeleteSessionDialog(target: ApiSession): void {
    setSessionToDelete(target);
    setDeleteSessionDialogOpen(true);
  }

  async function handleDeleteSession(): Promise<void> {
    if (!authToken || !sessionToDelete || deletingSession) return;
    try {
      setDeletingSession(true);
      const response = await fetch(`${apiBase}/api/sessions/${sessionToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to delete session.");
      }

      setSessions((current) => current.filter((session) => session.id !== sessionToDelete.id));
      setProject((current) =>
        current
          ? {
              ...current,
              sessionCount: Math.max(0, current.sessionCount - 1),
            }
          : current
      );
      setDeleteSessionDialogOpen(false);
      setSessionToDelete(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete session.");
    } finally {
      setDeletingSession(false);
    }
  }

  const filteredSessions = useMemo(() => {
    const query = sessionQuery.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => session.name.toLowerCase().includes(query));
  }, [sessionQuery, sessions]);

  const sentToTrelloCount = useMemo(
    () => sessions.filter((session) => session.status.toLowerCase() === "synced").length,
    [sessions]
  );
  const draftCount = useMemo(
    () =>
      sessions.filter((session) => {
        const normalized = session.status.toLowerCase();
        return normalized === "draft" || normalized === "preview_ready";
      }).length,
    [sessions]
  );
  const completionRate = useMemo(() => {
    if (!sessions.length) return 0;
    return Math.round((sentToTrelloCount / sessions.length) * 100);
  }, [sentToTrelloCount, sessions.length]);
  const totalSessionsCount = Math.max(project?.sessionCount ?? 0, sessions.length);

  return (
    <AppShell
      active="projects"
      title={project?.name || "Project Detail"}
      subtitle="Active project overview and testing sessions."
    >
      <Card className="border border-border/70 bg-white shadow-soft">
        <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <span className="rounded-md bg-primary/10 px-2.5 py-1 font-semibold text-primary">Active Project</span>
              <span>{formatSessionCount(totalSessionsCount)} Testing Sessions</span>
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground lg:text-5xl">{project?.name || "Loading..."}</h2>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {project?.description || "A comprehensive testing suite covering core user journeys and API edge cases."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              className="h-12 min-w-[148px] border-red-200 bg-red-50/50 text-red-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-100 hover:text-red-700"
              onClick={() => setDeleteProjectDialogOpen(true)}
              disabled={deletingProject || loadingData}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button
              className="h-12 min-w-[148px] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => setSessionDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Session
            </Button>
          </div>
        </CardContent>
      </Card>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[310px_minmax(0,1fr)]">
        <Card className="border border-border/70 bg-white shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold uppercase tracking-[0.12em] text-slate-500">Status Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-base text-slate-700">Sent to Trello</span>
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                {formatSessionCount(sentToTrelloCount)} Sessions
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base text-slate-700">Draft Mode</span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {formatSessionCount(draftCount)} Sessions
              </span>
            </div>
            <div className="space-y-2">
              <div className="h-2.5 rounded-full bg-muted">
                <div className="h-2.5 rounded-full bg-primary transition-all duration-300" style={{ width: `${completionRate}%` }} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{completionRate}% completion rate</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 bg-white shadow-soft">
          <CardHeader className="border-b pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-2xl font-semibold text-foreground">Recent Testing Sessions</CardTitle>
              <div className="relative w-full md:w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={sessionQuery}
                  onChange={(event) => setSessionQuery(event.target.value)}
                  placeholder="Filter..."
                  className="h-10 rounded-md border-input/90 pl-9 focus-visible:ring-primary/40"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingData ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`session-skeleton-${index}`} className="rounded-xl border border-border/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="h-5 w-56 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : filteredSessions.length ? (
              <div className="divide-y divide-border/80">
                {filteredSessions.map((session) => {
                  const SessionIcon = getIconByName(session.iconName);
                  const statusMeta = getStatusMeta(session.status);

                  return (
                    <div
                      key={session.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openSessionDetail(session.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openSessionDetail(session.id);
                        }
                      }}
                      className="w-full cursor-pointer text-left transition-colors duration-200 hover:bg-muted/35"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                            <SessionIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-lg font-semibold text-foreground">{session.name}</p>
                            <p className="text-sm text-muted-foreground">Created on {formatDate(session.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusMeta.badgeClassName} ${statusMeta.textClassName}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${statusMeta.dotClassName}`} />
                            {statusMeta.label}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDeleteSessionDialog(session);
                            }}
                            disabled={deletingSession}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center">
                <p className="text-lg font-semibold text-foreground">No sessions found</p>
                <p className="text-sm text-muted-foreground">Create your first session to start generating QA previews.</p>
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Session</DialogTitle>
            <DialogDescription>Choose session name and icon. This will open the session detail view.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateSession}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="session-name">
                Session name
              </label>
              <Input
                id="session-name"
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                placeholder="Critical Path Authentication"
                required
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Session icon</p>
              <IconPicker selected={sessionIcon} onSelect={setSessionIcon} />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setSessionDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sessionSubmitting}>
                {sessionSubmitting ? "Creating..." : "Create Session"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteProjectDialogOpen} onOpenChange={setDeleteProjectDialogOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
            <DialogDescription>
              Once deleted, this project and its sessions will only be removed from Niro. Existing cards in Trello will remain in your Trello board.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDeleteProjectDialogOpen(false)} disabled={deletingProject}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDeleteProject()} disabled={deletingProject}>
              {deletingProject ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteSessionDialogOpen}
        onOpenChange={(open) => {
          setDeleteSessionDialogOpen(open);
          if (!open) setSessionToDelete(null);
        }}
      >
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Delete Session?</DialogTitle>
            <DialogDescription>
              Once deleted, this session will only be removed from Niro. Existing cards in Trello will remain in your Trello board.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium text-foreground">{sessionToDelete ? `Session: ${sessionToDelete.name}` : ""}</p>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeleteSessionDialogOpen(false);
                setSessionToDelete(null);
              }}
              disabled={deletingSession}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDeleteSession()} disabled={deletingSession || !sessionToDelete}>
              {deletingSession ? "Deleting..." : "Delete Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
