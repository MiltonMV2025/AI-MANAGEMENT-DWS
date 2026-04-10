import { useEffect } from "react";
import { AppShell } from "./app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function TermsPage(): React.JSX.Element {
  useEffect(() => {
    const token = window.localStorage.getItem("auth_token") || "";
    if (!token) {
      window.location.href = "/";
    }
  }, []);

  return (
    <AppShell
      active="settings"
      title="Terms and Conditions"
      subtitle="Generic terms for the current QA workspace and preview-to-Trello flow."
    >
      <Card>
        <CardHeader>
          <CardTitle>1. Service Scope</CardTitle>
          <CardDescription>Applies to projects, sessions, AI previews and Trello sync.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>This platform is provided for QA planning and test case organization.</p>
          <p>AI outputs are generated suggestions and must be reviewed before operational use.</p>
          <p>Users are responsible for validating the final quality and accuracy of exported cards.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. User Responsibilities</CardTitle>
          <CardDescription>Security and responsible usage requirements.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Keep credentials and tokens confidential at all times.</p>
          <p>Do not submit unlawful, abusive or harmful content into project sessions.</p>
          <p>Use Trello integration only with boards and lists you are authorized to manage.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Data and Integrations</CardTitle>
          <CardDescription>How data moves across system components.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Session input and generated preview cards may be stored for product continuity.</p>
          <p>When Trello sync is triggered, card content is sent to external services.</p>
          <p>Availability of third-party services is outside the platform’s direct control.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Liability and Updates</CardTitle>
          <CardDescription>General legal disclaimer and versioning clause.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>The service is provided “as is” without warranties of uninterrupted operation.</p>
          <p>Terms may be updated to reflect operational, security or legal changes.</p>
          <p>Continued usage after updates implies acceptance of the revised terms.</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
