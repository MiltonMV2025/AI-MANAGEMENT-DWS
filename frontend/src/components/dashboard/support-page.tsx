import { useEffect } from "react";
import { AppShell } from "./app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function SupportPage(): React.JSX.Element {
  useEffect(() => {
    const token = window.localStorage.getItem("auth_token") || "";
    if (!token) {
      window.location.href = "/";
    }
  }, []);

  return (
    <AppShell
      active="settings"
      title="Support"
      subtitle="General guidance for workspace usage, session flow and integrations."
    >
      <Card>
        <CardHeader>
          <CardTitle>Contact Channels</CardTitle>
          <CardDescription>Use these channels for product or technical help.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Email: support@niro-qa.local</p>
          <p>Office Hours: Monday to Friday, 9:00 AM to 5:00 PM (local time)</p>
          <p>Response Target: within one business day for standard requests.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Issues</CardTitle>
          <CardDescription>Quick checks before opening a ticket.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Verify your API token is still stored after login.</p>
          <p>Confirm Trello variables are configured before syncing cards.</p>
          <p>Run AI processing first, then review preview cards before sending to Trello.</p>
          <p>Ensure your SQL Server connection string points to the active database.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escalation Policy</CardTitle>
          <CardDescription>How we handle high-impact incidents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Critical outages are prioritized immediately.</p>
          <p>Data integrity issues receive same-day review and mitigation.</p>
          <p>Feature requests are triaged in weekly planning sessions.</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
