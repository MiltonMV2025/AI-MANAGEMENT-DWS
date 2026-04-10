import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, PencilLine, Send, X } from "lucide-react";
import { AppShell } from "./app-shell";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";

type TrelloStatus = "pending" | "sent" | "failed";
type SessionStatus = "draft" | "preview_ready" | "synced" | "partial" | "error";
type QaPriority = "high" | "medium" | "low";
type QaListType = "functional" | "negative" | "edge" | "regression";

type ApiPreviewCard = {
  id: string;
  sessionId: string;
  title: string;
  steps: string[];
  expectedResult: string;
  priority: QaPriority;
  listType: QaListType;
  trello: {
    status: TrelloStatus;
    cardId: string | null;
    cardUrl: string | null;
    error: string | null;
  };
};

type ApiSession = {
  id: string;
  projectId: string;
  name: string;
  status: SessionStatus;
  errorMessage: string | null;
  previewCards: ApiPreviewCard[];
};

type ApiProject = {
  id: string;
  name: string;
};

type CardDraft = {
  title: string;
  stepsText: string;
  expectedResult: string;
  priority: QaPriority;
  listType: QaListType;
};

const listTypeOptions: Array<{ value: QaListType; label: string }> = [
  { value: "functional", label: "Test Case" },
  { value: "edge", label: "Edge Case" },
  { value: "negative", label: "Bug Identified" },
  { value: "regression", label: "Regression" },
];

const priorityOptions: QaPriority[] = ["high", "medium", "low"];

const listTypeStyles: Record<QaListType, string> = {
  functional: "border-blue-100 bg-blue-50 text-blue-700",
  edge: "border-amber-100 bg-amber-50 text-amber-700",
  negative: "border-rose-100 bg-rose-50 text-rose-700",
  regression: "border-violet-100 bg-violet-50 text-violet-700",
};

function normalizePreviewCard(card: any): ApiPreviewCard {
  const listType = String(card?.listType || "functional").toLowerCase() as QaListType;
  const priority = String(card?.priority || "medium").toLowerCase() as QaPriority;
  const trelloStatus = String(card?.trello?.status || "pending").toLowerCase() as TrelloStatus;
  return {
    id: String(card?.id || ""),
    sessionId: String(card?.sessionId || ""),
    title: String(card?.title || "Untitled test case"),
    steps: Array.isArray(card?.steps) ? card.steps.map((step: unknown) => String(step ?? "").trim()).filter(Boolean) : [],
    expectedResult: String(card?.expectedResult || ""),
    priority: priorityOptions.includes(priority) ? priority : "medium",
    listType: listTypeOptions.some((option) => option.value === listType) ? listType : "functional",
    trello: {
      status: trelloStatus === "sent" || trelloStatus === "failed" ? trelloStatus : "pending",
      cardId: card?.trello?.cardId ? String(card.trello.cardId) : null,
      cardUrl: card?.trello?.cardUrl ? String(card.trello.cardUrl) : null,
      error: card?.trello?.error ? String(card.trello.error) : null,
    },
  };
}

function getSessionStatusLabel(status: SessionStatus): string {
  if (status === "preview_ready") return "PREVIEW READY";
  if (status === "synced") return "SENT TO TRELLO";
  if (status === "partial") return "PARTIAL";
  if (status === "error") return "ERROR";
  return "DRAFT";
}

function getSessionStatusClass(status: SessionStatus): string {
  if (status === "preview_ready") return "border-blue-100 bg-blue-50 text-blue-700";
  if (status === "synced") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (status === "partial") return "border-amber-100 bg-amber-50 text-amber-700";
  if (status === "error") return "border-red-100 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function toStepsText(steps: string[]): string {
  if (!steps.length) return "";
  return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
}

function parseStepsText(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+[\).\-\s]*/, "").trim())
    .filter(Boolean);
}

function toCardDraft(card: ApiPreviewCard): CardDraft {
  return {
    title: card.title,
    stepsText: toStepsText(card.steps),
    expectedResult: card.expectedResult,
    priority: card.priority,
    listType: card.listType,
  };
}

export function SessionPreviewPage({ apiBase }: { apiBase: string }): React.JSX.Element {
  const [authToken, setAuthToken] = useState("");
  const [projectId, setProjectId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [projectName, setProjectName] = useState("Project");

  const [session, setSession] = useState<ApiSession | null>(null);
  const [previewCards, setPreviewCards] = useState<ApiPreviewCard[]>([]);
  const [status, setStatus] = useState("");
  const [loadingSession, setLoadingSession] = useState(false);
  const [sendingToTrello, setSendingToTrello] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardDrafts, setCardDrafts] = useState<Record<string, CardDraft>>({});
  const [savingCardId, setSavingCardId] = useState<string | null>(null);

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

        const normalizedPreviewCards: ApiPreviewCard[] = (sessionData.session.previewCards || []).map((card: any) =>
          normalizePreviewCard(card)
        );

        const normalizedSession: ApiSession = {
          id: String(sessionData.session.id),
          projectId: String(sessionData.session.projectId),
          name: String(sessionData.session.name || "Session"),
          status: String(sessionData.session.status || "draft").toLowerCase() as SessionStatus,
          errorMessage: sessionData.session.errorMessage ? String(sessionData.session.errorMessage) : null,
          previewCards: normalizedPreviewCards,
        };

        setSession(normalizedSession);
        setPreviewCards(normalizedPreviewCards);
        setEditingCardId(null);

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

  async function sendToTrello(): Promise<void> {
    if (!authToken || !sessionId || !previewCards.length) return;

    try {
      setSendingToTrello(true);
      setStatus("Sending cards to Trello...");
      const response = await fetch(`${apiBase}/api/sessions/${sessionId}/send-to-trello`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to send cards to Trello.");
      }

      const normalizedPreviewCards: ApiPreviewCard[] = (data.session.previewCards || []).map((card: any) =>
        normalizePreviewCard(card)
      );

      setPreviewCards(normalizedPreviewCards);
      setSession((current) =>
        current
          ? {
              ...current,
              status: String(data.session.status || current.status).toLowerCase() as SessionStatus,
              previewCards: normalizedPreviewCards,
              errorMessage: null,
            }
          : current
      );

      const sentCount = Number(data?.trelloSync?.sentCount ?? 0);
      const failedCount = Number(data?.trelloSync?.failedCount ?? 0);
      if (failedCount > 0) {
        setStatus(`Sent ${sentCount} card(s). ${failedCount} card(s) failed and can be retried.`);
      } else {
        setStatus(`All ${sentCount} card(s) were sent to Trello successfully.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to send cards to Trello.");
    } finally {
      setSendingToTrello(false);
    }
  }

  function openSendConfirm(): void {
    if (!previewCards.length || sendingToTrello || !!editingCardId || loadingSession || isSentToTrello) return;
    setSendConfirmOpen(true);
  }

  async function confirmAndSend(): Promise<void> {
    await sendToTrello();
    setSendConfirmOpen(false);
  }

  function startEditing(card: ApiPreviewCard): void {
    setEditingCardId(card.id);
    setCardDrafts((current) => ({
      ...current,
      [card.id]: toCardDraft(card),
    }));
    setStatus("");
  }

  function cancelEditing(cardId: string): void {
    setEditingCardId((current) => (current === cardId ? null : current));
  }

  async function saveCard(cardId: string): Promise<void> {
    if (!authToken || !sessionId) return;

    const draft = cardDrafts[cardId];
    if (!draft) return;

    const cleanTitle = draft.title.trim();
    const cleanExpected = draft.expectedResult.trim();
    const steps = parseStepsText(draft.stepsText);

    if (!cleanTitle) {
      setStatus("Card title is required.");
      return;
    }
    if (!steps.length) {
      setStatus("At least one step is required.");
      return;
    }
    if (!cleanExpected) {
      setStatus("Expected result is required.");
      return;
    }

    try {
      setSavingCardId(cardId);
      setStatus("Saving card changes...");
      const response = await fetch(`${apiBase}/api/sessions/${sessionId}/preview-cards/${cardId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          title: cleanTitle,
          steps,
          expectedResult: cleanExpected,
          priority: draft.priority,
          listType: draft.listType,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to save card changes.");
      }

      const updatedCard = normalizePreviewCard(data.card);
      setPreviewCards((current) => current.map((card) => (card.id === cardId ? updatedCard : card)));
      setSession((current) =>
        current
          ? {
              ...current,
              status: String(data?.sessionStatus || current.status).toLowerCase() as SessionStatus,
              previewCards: current.previewCards.map((card) => (card.id === cardId ? updatedCard : card)),
            }
          : current
      );
      setEditingCardId((current) => (current === cardId ? null : current));
      setStatus("Card updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save card changes.");
    } finally {
      setSavingCardId(null);
    }
  }

  const generatedLabel = useMemo(() => {
    if (!previewCards.length) return "No test cases generated yet.";
    const subject = session?.name || "this workflow";
    return `Generated ${previewCards.length} test cases based on ${subject}.`;
  }, [previewCards.length, session?.name]);
  const isSentToTrello = session?.status === "synced";

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
          <span>Session Preview</span>
          {session ? (
            <span className={`ml-2 rounded-full border px-2.5 py-1 text-[10px] tracking-[0.12em] ${getSessionStatusClass(session.status)}`}>
              {getSessionStatusLabel(session.status)}
            </span>
          ) : null}
        </div>
        <h2 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Session Preview</h2>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">{generatedLabel}</p>
      </section>

      {!session ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-lg font-semibold">Session not found</p>
            <p className="text-sm text-muted-foreground">Create sessions from project detail and reopen this screen.</p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4 rounded-2xl border border-border/70 bg-white p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-3xl font-bold tracking-tight text-slate-900">Session Preview</h3>
              <p className="mt-1 text-sm text-slate-600">
                {previewCards.length
                  ? `${previewCards.length} card(s) ready for review and edit before Trello sync.`
                  : "No cards yet. Go to New Session Page to generate them."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" asChild>
                <a href={`/session-detail?projectId=${projectId}&sessionId=${sessionId}`}>Open New Session Page</a>
              </Button>
              <Button
                className="h-11 min-w-[172px] rounded-lg px-6 font-semibold"
                onClick={openSendConfirm}
                disabled={!previewCards.length || sendingToTrello || !!editingCardId || loadingSession || isSentToTrello}
              >
                {sendingToTrello ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {sendingToTrello ? "Sending..." : isSentToTrello ? "Sent to Trello" : "Send to Trello"}
              </Button>
            </div>
          </div>

          {previewCards.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {previewCards.map((card) => {
                const isEditing = editingCardId === card.id;
                const draft = cardDrafts[card.id];
                const canRenderEditor = isEditing && draft;
                const listTypeMeta = listTypeOptions.find((option) => option.value === card.listType) || listTypeOptions[0];
                const isSaving = savingCardId === card.id;

                return (
                  <Card key={card.id} className="h-full rounded-xl border border-border/70 bg-white shadow-none">
                    <CardContent className="space-y-3 p-5">
                      {canRenderEditor ? (
                        <>
                          <div className="grid gap-3">
                            <Input
                              value={draft.title}
                              onChange={(event) =>
                                setCardDrafts((current) => ({
                                  ...current,
                                  [card.id]: { ...draft, title: event.target.value },
                                }))
                              }
                              placeholder="Card title"
                              className="h-10 rounded-lg border border-input bg-white"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={draft.listType}
                                onChange={(event) =>
                                  setCardDrafts((current) => ({
                                    ...current,
                                    [card.id]: {
                                      ...draft,
                                      listType: event.target.value as QaListType,
                                    },
                                  }))
                                }
                                className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
                              >
                                {listTypeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={draft.priority}
                                onChange={(event) =>
                                  setCardDrafts((current) => ({
                                    ...current,
                                    [card.id]: {
                                      ...draft,
                                      priority: event.target.value as QaPriority,
                                    },
                                  }))
                                }
                                className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
                              >
                                {priorityOptions.map((priority) => (
                                  <option key={priority} value={priority}>
                                    {priority.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Steps</p>
                            <textarea
                              value={draft.stepsText}
                              onChange={(event) =>
                                setCardDrafts((current) => ({
                                  ...current,
                                  [card.id]: { ...draft, stepsText: event.target.value },
                                }))
                              }
                              rows={5}
                              className="w-full rounded-lg border border-input bg-[#f8fafc] px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            />
                          </div>

                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Expected Result</p>
                            <textarea
                              value={draft.expectedResult}
                              onChange={(event) =>
                                setCardDrafts((current) => ({
                                  ...current,
                                  [card.id]: { ...draft, expectedResult: event.target.value },
                                }))
                              }
                              rows={3}
                              className="w-full rounded-lg border border-input bg-[#f8fafc] px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <Button type="button" variant="secondary" size="sm" onClick={() => cancelEditing(card.id)} disabled={isSaving}>
                              <X className="mr-1 h-3.5 w-3.5" />
                              Cancel
                            </Button>
                            <Button type="button" size="sm" onClick={() => void saveCard(card.id)} disabled={isSaving}>
                              {isSaving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                              Save
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${listTypeStyles[card.listType]}`}>
                              {listTypeMeta.label}
                            </span>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{card.priority}</span>
                          </div>

                          <h4 className="text-2xl font-semibold leading-snug text-slate-900">{card.title}</h4>

                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Steps</p>
                            <div className="rounded-lg bg-[#f5f7fb] px-3 py-2">
                              <ol className="space-y-1 text-sm leading-relaxed text-slate-700">
                                {card.steps.map((step, index) => (
                                  <li key={`${card.id}-step-${index}`}>{index + 1}. {step}</li>
                                ))}
                              </ol>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Expected Result</p>
                            <div className="rounded-lg bg-[#f5f7fb] px-3 py-2 text-sm leading-relaxed text-slate-700">{card.expectedResult}</div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="text-xs text-slate-500">
                              Trello:{" "}
                              <span
                                className={
                                  card.trello.status === "sent"
                                    ? "font-semibold text-emerald-700"
                                    : card.trello.status === "failed"
                                      ? "font-semibold text-red-700"
                                      : "font-semibold text-slate-700"
                                }
                              >
                                {card.trello.status.toUpperCase()}
                              </span>
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => startEditing(card)} disabled={!!editingCardId || sendingToTrello}>
                              <PencilLine className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed bg-slate-50/40 shadow-none">
              <CardContent className="py-10 text-center">
                <p className="text-lg font-semibold text-slate-800">No preview cards yet</p>
                <p className="text-sm text-slate-600">Go to New Session Page and generate cards with AI.</p>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      {!isSentToTrello ? (
        <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
          <DialogContent className="max-w-[500px] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_22px_55px_rgba(15,23,42,0.32)] md:p-6 [&>button]:hidden">
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="max-w-[430px] text-2xl font-bold leading-tight tracking-tight text-[#0f172a] md:text-3xl">
                Are you sure you want to send to Trello?
              </DialogTitle>
              <p className="max-w-[440px] text-base leading-relaxed text-slate-600 md:text-lg">
                Once sent, any further edits must be made directly within your Trello board.
              </p>
            </DialogHeader>
            <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-0">
              <Button
                type="button"
                variant="ghost"
                className="h-10 min-w-[110px] text-base font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setSendConfirmOpen(false)}
                disabled={sendingToTrello}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-10 min-w-[170px] rounded-lg text-base font-semibold shadow-[0_8px_18px_rgba(37,99,235,0.24)]"
                onClick={() => void confirmAndSend()}
                disabled={sendingToTrello}
              >
                {sendingToTrello ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {sendingToTrello ? "Sending..." : "Confirm & Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </AppShell>
  );
}
