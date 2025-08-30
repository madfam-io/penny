'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { Button, Switch, Label } from '@penny/ui';

export function IntegrationSettings() {
  const integrations = [
    { id: 'slack', name: 'Slack', enabled: true, description: 'Team communication' },
    { id: 'github', name: 'GitHub', enabled: true, description: 'Code repository' },
    { id: 'jira', name: 'Jira', enabled: false, description: 'Issue tracking' },
    { id: 'stripe', name: 'Stripe', enabled: true, description: 'Payment processing' },
    { id: 'sendgrid', name: 'SendGrid', enabled: false, description: 'Email service' },
    { id: 'datadog', name: 'Datadog', enabled: false, description: 'Monitoring' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integration Settings</CardTitle>
        <CardDescription>Manage third-party service integrations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {integrations.map((integration) => (
          <div key={integration.id} className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={integration.id} className="text-base">
                {integration.name}
              </Label>
              <p className="text-sm text-muted-foreground">
                {integration.description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Configure
              </Button>
              <Switch
                id={integration.id}
                defaultChecked={integration.enabled}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}