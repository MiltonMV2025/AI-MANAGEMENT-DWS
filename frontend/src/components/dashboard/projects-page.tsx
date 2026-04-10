import { useEffect, useState } from "react";
import { FolderOpen, Plus, Search } from "lucide-react";
import { AppShell } from "./app-shell";
import { IconPicker } from "./icon-picker";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
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

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ProjectsPage({ apiBase }: { apiBase: string }): React.JSX.Element {
  const [authToken, setAuthToken] = useState("");
  const [query, setQuery] = useState("");
  const [createdSort, setCreatedSort] = useState<"desc" | "asc">("desc");
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [status, setStatus] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectIcon, setProjectIcon] = useState<IconName>("folder");
  const [projectSubmitting, setProjectSubmitting] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("auth_token") || "";
    if (!token) {
      window.location.href = "/";
      return;
    }
    setAuthToken(token);
  }, []);

  useEffect(() => {
    if (!authToken) return;

    const controller = new AbortController();

    async function loadProjects(): Promise<void> {
      try {
        setLoadingProjects(true);
        const params = new URLSearchParams();
        if (query.trim()) {
          params.set("q", query.trim());
        }
        params.set("order", createdSort);

        const response = await fetch(`${apiBase}/api/projects?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          signal: controller.signal,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Failed to load projects.");
        }

        const normalized: ApiProject[] = (data.projects || []).map((item: any) => ({
          id: String(item.id),
          name: String(item.name || "Untitled project"),
          description: item.description ? String(item.description) : null,
          iconName: String(item.iconName || "folder"),
          createdAt: String(item.createdAt || ""),
          sessionCount: Number(item.sessionCount ?? item.runCount ?? 0),
        }));

        setProjects(normalized);
        setStatus("");
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus(error instanceof Error ? error.message : "Failed to load projects.");
      } finally {
        if (!controller.signal.aborted) {
          setLoadingProjects(false);
        }
      }
    }

    void loadProjects();
    return () => controller.abort();
  }, [apiBase, authToken, createdSort, query, reloadToken]);

  function openProject(projectId: string): void {
    const params = new URLSearchParams({ projectId });
    window.location.href = `/project-detail?${params.toString()}`;
  }

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const cleanName = projectName.trim();
    if (!cleanName) {
      setStatus("Project name is required.");
      return;
    }

    if (!authToken) return;

    try {
      setProjectSubmitting(true);
      setStatus("Creating project...");

      const response = await fetch(`${apiBase}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: cleanName,
          description: projectDescription.trim() || undefined,
          iconName: projectIcon,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to create project.");
      }

      setProjectName("");
      setProjectDescription("");
      setProjectIcon("folder");
      setProjectDialogOpen(false);
      setStatus("Project created.");
      setReloadToken((current) => current + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create project.");
    } finally {
      setProjectSubmitting(false);
    }
  }

  return (
    <AppShell
      active="projects"
      title="Projects"
      subtitle="Open a project to manage sessions and preview Trello cards before sync."
      headerAction={
        <Button onClick={() => setProjectDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      }
    >
      <Card className="border-none shadow-soft">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects by name or description..."
                className="h-11 pl-10"
              />
            </div>
            <div className="flex items-center gap-2 md:w-auto">
              <label className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground" htmlFor="created-sort">
                Created
              </label>
              <select
                id="created-sort"
                value={createdSort}
                onChange={(event) => setCreatedSort(event.target.value as "desc" | "asc")}
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loadingProjects
          ? Array.from({ length: 6 }).map((_, index) => (
              <Card key={`project-skeleton-${index}`} className="h-full bg-white">
                <CardHeader>
                  <div className="mb-3 h-12 w-12 animate-pulse rounded-xl bg-muted" />
                  <div className="h-6 w-3/4 animate-pulse rounded-md bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-muted/70 px-3 py-2">
                    <div className="h-3 w-20 animate-pulse rounded-md bg-muted" />
                    <div className="h-6 w-10 animate-pulse rounded-md bg-muted" />
                  </div>
                  <div className="h-3 w-28 animate-pulse rounded-md bg-muted" />
                </CardContent>
              </Card>
            ))
          : null}

        {!loadingProjects
          ? projects.map((project) => {
              const Icon = getIconByName(project.iconName || "folder");
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => openProject(project.id)}
                  className="text-left"
                >
                  <Card className="h-full bg-white transition hover:-translate-y-0.5 hover:shadow-md">
                    <CardHeader>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle>{project.name}</CardTitle>
                      <CardDescription>{project.description || "Project ready for QA session architecture."}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg bg-muted/70 px-3 py-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sessions</span>
                        <Badge variant="secondary" className="rounded-md px-2 py-1 text-sm">
                          {project.sessionCount}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Updated {formatDate(project.createdAt)}</p>
                    </CardContent>
                  </Card>
                </button>
              );
            })
          : null}
      </div>

      {!loadingProjects && !projects.length ? (
        <Card className="border-dashed bg-transparent">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-semibold">No projects found</p>
            <p className="text-sm text-muted-foreground">Create one to start organizing sessions.</p>
            <Button onClick={() => setProjectDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Pick project name and icon. We send `iconName` now so backend can persist it later.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateProject}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="project-name">
                Project name
              </label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Alpha App v1.0"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="project-description">
                Description
              </label>
              <textarea
                id="project-description"
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                placeholder="Short context about this product area"
                className="min-h-[7rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Project icon</p>
              <IconPicker selected={projectIcon} onSelect={setProjectIcon} />
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setProjectDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={projectSubmitting}>
                {projectSubmitting ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
