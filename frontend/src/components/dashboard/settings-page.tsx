import { useEffect, useState } from "react";
import { ExternalLink, FileText, LifeBuoy, LogOut, Save, ShieldCheck } from "lucide-react";
import { AppShell } from "./app-shell";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

export function SettingsPage({ apiBase }: { apiBase: string }): React.JSX.Element {
  const [authToken, setAuthToken] = useState("");
  const [username, setUsername] = useState("user");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("auth_token") || "";
    const savedUsername = window.localStorage.getItem("auth_username") || "user";
    if (!token) {
      window.location.href = "/";
      return;
    }

    setAuthToken(token);
    setUsername(savedUsername);
  }, []);

  useEffect(() => {
    if (!authToken) return;

    async function loadProfile(): Promise<void> {
      try {
        setLoading(true);
        const response = await fetch(`${apiBase}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Failed to load profile.");
        }

        const nextUsername = String(data.user?.username || "user");
        const nextEmail = String(data.user?.email || "");
        const nextRole = String(data.user?.role || "user");
        setUsername(nextUsername);
        setEmail(nextEmail);
        window.localStorage.setItem("auth_username", nextUsername);
        window.localStorage.setItem("auth_role", nextRole);
        setStatus("");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load profile.");
      } finally {
        setLoading(false);
        setProfileLoaded(true);
      }
    }

    void loadProfile();
  }, [apiBase, authToken]);

  function logout(): void {
    window.localStorage.removeItem("auth_token");
    window.localStorage.removeItem("auth_username");
    window.localStorage.removeItem("auth_role");
    window.location.href = "/";
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!authToken || submitting) return;

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!cleanUsername || !cleanEmail) {
      setStatus("Username and email are required.");
      return;
    }

    const hasPasswordInput = Boolean(currentPassword || newPassword || confirmPassword);
    if (hasPasswordInput) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setStatus("To change password, complete current, new and confirm fields.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setStatus("New password and confirmation do not match.");
        return;
      }
    }

    try {
      setSubmitting(true);
      setStatus("");
      const response = await fetch(`${apiBase}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          username: cleanUsername,
          email: cleanEmail,
          currentPassword: hasPasswordInput ? currentPassword : undefined,
          newPassword: hasPasswordInput ? newPassword : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to update profile.");
      }

      const savedUsername = String(data.user?.username || cleanUsername);
      const savedEmail = String(data.user?.email || cleanEmail);
      const savedRole = String(data.user?.role || "user");
      setUsername(savedUsername);
      setEmail(savedEmail);
      window.localStorage.setItem("auth_username", savedUsername);
      window.localStorage.setItem("auth_role", savedRole);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus("Profile updated successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      active="settings"
      title="Settings"
      subtitle="Manage your profile, credentials and account resources."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Account Settings
              </CardTitle>
              <CardDescription>
                Keep your account details up to date and manage your sign-in credentials in one place.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!profileLoaded && loading ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-3 h-4 w-44 animate-pulse rounded bg-muted" />
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <div className="h-10 w-24 animate-pulse rounded-md bg-muted" />
                    <div className="h-10 w-36 animate-pulse rounded-md bg-muted" />
                  </div>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSaveProfile}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="settings-username">
                        Username
                      </label>
                      <Input
                        id="settings-username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder="Username"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="settings-email">
                        Email
                      </label>
                      <Input
                        id="settings-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="email@domain.com"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="mb-3 text-sm font-semibold">Change password (optional)</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        autoComplete="current-password"
                        placeholder="Current password"
                        disabled={loading}
                      />
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        autoComplete="new-password"
                        placeholder="New password"
                        disabled={loading}
                      />
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        placeholder="Confirm password"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={logout}
                      disabled={loading || submitting}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                    <Button type="submit" disabled={loading || submitting}>
                      <Save className="mr-2 h-4 w-4" />
                      {submitting ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                  {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none bg-gradient-to-br from-primary to-indigo-700 text-white">
            <CardHeader>
              <CardTitle className="text-white">Help & Support</CardTitle>
              <CardDescription className="text-white/80">
                Need assistance with this QA workspace? We are here to help.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="secondary" className="w-full justify-between bg-white/15 text-white hover:bg-white/20">
                <a href="/support">
                  Documentation
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full border-white/30 bg-white text-primary hover:bg-white/90">
                <a href="/support">
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  Contact Support
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <a href="/terms-and-conditions">
                  <FileText className="mr-2 h-4 w-4" />
                  Terms and Conditions
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <a href="/support">
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  Support
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
