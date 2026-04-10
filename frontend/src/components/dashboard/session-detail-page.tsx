import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { AppShell } from "./app-shell";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";

type ApiSession = {
  id: string;
  projectId: string;
  name: string;
  sourceInput: string | null;
};

type ApiProject = {
  id: string;
  name: string;
};

export function SessionDetailPage({ apiBase }: { apiBase: string }): React.JSX.Element {
  const [authToken, setAuthToken] = useState("");
  const [projectId, setProjectId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [projectName, setProjectName] = useState("Project");
  const [session, setSession] = useState<ApiSession | null>(null);

  const [featureName, setFeatureName] = useState("");
  const [sourceInput, setSourceInput] = useState("");
  const [status, setStatus] = useState("");
  const [loadingSession, setLoadingSession] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("auth_token") || "";
    if (!token) {
      window.location.href = "/";
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const pId = params.get("projectId") || "";
    const sId = params.get("sessionId") || "";

    if (!pId || !sId) {
      window.location.href = "/projects";
      return;
    }

    setAuthToken(token);
    setProjectId(pId);
    setSessionId(sId);
  }, []);

  useEffect(() => {
    if (!authToken || !projectId || !sessionId) return;

    async function loadData(): Promise<void> {
      try {
        setLoadingSession(true);
        setStatus("Loading session...");

        const sessionResponse = await fetch(`${apiBase}/api/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const sessionData = await sessionResponse.json();
        if (!sessionResponse.ok) {
          throw new Error(sessionData?.message || "Failed to load session.");
        }

        const normalizedSession: ApiSession = {
          id: String(sessionData.session.id),
          projectId: String(sessionData.session.projectId),
          name: String(sessionData.session.name || "Session"),
          sourceInput: sessionData.session.sourceInput ? String(sessionData.session.sourceInput) : "",
        };

        setSession(normalizedSession);
        setFeatureName("");
        setSourceInput("");

        const projectsResponse = await fetch(`${apiBase}/api/projects`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const projectsData = await projectsResponse.json();
        if (projectsResponse.ok) {
          const project = (projectsData.projects || []).find((item: ApiProject) => String(item.id) === projectId);
          if (project) setProjectName(String(project.name || "Project"));
        }

        setStatus("");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load session.");
      } finally {
        setLoadingSession(false);
      }
    }

    void loadData();
  }, [apiBase, authToken, projectId, sessionId]);

  async function processWithAI(): Promise<void> {
    if (!authToken || !sessionId) return;
    const cleanInput = sourceInput.trim();
    const cleanFeatureName = featureName.trim();

    if (!cleanFeatureName) {
      setStatus("Feature name is required.");
      return;
    }
    if (!cleanInput) {
      setStatus("Requirement description is required before generating preview.");
      return;
    }

    try {
      setProcessing(true);
      setStatus("Generating preview cards...");
      const response = await fetch(`${apiBase}/api/sessions/${sessionId}/process-preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ input: cleanInput, featureName: cleanFeatureName }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to generate preview.");
      }

      const params = new URLSearchParams({
        projectId,
        sessionId: String(data?.session?.id || sessionId),
      });
      window.location.href = `/session-preview?${params.toString()}`;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to generate preview.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <AppShell
      active="projects"
      title={`${projectName} >`}
      headerAction={
        <Button asChild variant="outline">
          <a href={`/project-detail?projectId=${projectId}`}>Back To Sessions</a>
        </Button>
      }
    >
      <section className="rounded-2xl border border-border/70 bg-white/90 px-6 py-8 md:px-8 md:py-10">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
          <span>Projects</span>
          <span>{">"}</span>
          <span>{projectName}</span>
          <span>{">"}</span>
          <span>New Session</span>
        </div>
        <h2 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Add New Session</h2>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">
          Define your new testing parameters. Our AI architect will analyze your requirements to generate comprehensive test cases and edge-case scenarios.
        </p>
      </section>

      {!session ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-lg font-semibold">Session not found</p>
            <p className="text-sm text-muted-foreground">Create sessions from project detail and reopen this screen.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex w-full justify-center">
          <Card className="w-full max-w-[700px] rounded-2xl border border-border/75 bg-white shadow-[0_22px_48px_-30px_rgba(15,23,42,0.5)]">
            <CardContent className="flex min-h-[560px] flex-col gap-8 p-7 sm:p-8 md:p-10">
              <div className="space-y-3">
                <label className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-600" htmlFor="feature-name">
                  Feature Name
                </label>
                <Input
                  id="feature-name"
                  value={featureName}
                  onChange={(event) => setFeatureName(event.target.value)}
                  placeholder="e.g., User Authentication Flow"
                  className="h-14 rounded-xl border-0 bg-[#f1f4f9] px-5 text-lg text-slate-700 placeholder:text-[#8fa0ba] focus-visible:ring-2 focus-visible:ring-primary/35"
                  disabled={processing || loadingSession}
                />
              </div>

              <div className="space-y-3">
                <label className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-600" htmlFor="requirement-description">
                  Requirement Description
                </label>
                <textarea
                  id="requirement-description"
                  value={sourceInput}
                  onChange={(event) => setSourceInput(event.target.value)}
                  placeholder="Describe feature requirements, user stories, edge cases, and technical details..."
                  className="min-h-[260px] w-full rounded-xl border-0 bg-[#f1f4f9] px-5 py-4 text-base leading-relaxed text-slate-700 placeholder:text-[#8fa0ba] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  disabled={processing || loadingSession}
                />
              </div>

              <div className="mt-auto flex justify-end pt-2">
                <Button
                  className="h-14 min-w-[232px] rounded-xl px-8 text-lg font-semibold shadow-md shadow-primary/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90"
                  onClick={() => void processWithAI()}
                  disabled={processing || loadingSession}
                >
                  {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {processing ? "Generating..." : "Generate with AI"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </AppShell>
  );
}
