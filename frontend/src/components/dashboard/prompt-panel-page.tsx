import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { AppShell } from "./app-shell";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { SimpleToast } from "../ui/simple-toast";

export function PromptPanelPage({ apiBase }: { apiBase: string }): React.JSX.Element {
  const [authToken, setAuthToken] = useState("");
  const [value, setValue] = useState("");
  const [initialValue, setInitialValue] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

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

    async function loadPrompt(): Promise<void> {
      try {
        setLoading(true);
        const response = await fetch(`${apiBase}/api/prompt-templates/system`, {
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
          throw new Error(data?.message || "Failed to load prompt.");
        }
        const content = String(data.template?.content || "");
        setValue(content);
        setInitialValue(content);
        setStatus("");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load prompt.");
      } finally {
        setLoading(false);
      }
    }

    void loadPrompt();
  }, [apiBase, authToken]);

  async function handleSave(): Promise<void> {
    if (!authToken || saving) return;
    try {
      setSaving(true);
      setStatus("");
      const response = await fetch(`${apiBase}/api/prompt-templates/system`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          content: value,
          title: "System Prompt",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403) {
          window.location.href = "/projects";
          return;
        }
        throw new Error(data?.message || "Failed to save prompt.");
      }

      const content = String(data.template?.content || value);
      setValue(content);
      setInitialValue(content);
      setToastOpen(true);
      window.setTimeout(() => setToastOpen(false), 2200);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save prompt.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel(): void {
    setValue(initialValue);
    setStatus("");
  }

  const hasChanges = value !== initialValue;
  const disableActions = loading || saving;
  const showSkeleton = loading && !initialValue;

  return (
    <>
      <AppShell
        active="prompt"
        title="Prompt Panel"
        subtitle="System prompt editor."
      >
        <Card className="mx-auto w-full max-w-6xl">
          <CardContent className="space-y-4 pt-6">
            {showSkeleton ? (
              <>
                <div className="min-h-72 w-full animate-pulse rounded-md border border-input bg-muted/60" />
                <div className="flex items-center justify-end gap-2">
                  <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
                  <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
                </div>
              </>
            ) : (
              <>
                <textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="min-h-72 w-full rounded-md border border-input bg-background px-4 py-4 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Write your system prompt here"
                  disabled={disableActions}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancel}
                    disabled={!hasChanges || disableActions}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => void handleSave()} disabled={!hasChanges || disableActions}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </>
            )}
            {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
          </CardContent>
        </Card>
      </AppShell>

      <SimpleToast open={toastOpen} message="Prompt updated sucessfully" />
    </>
  );
}
