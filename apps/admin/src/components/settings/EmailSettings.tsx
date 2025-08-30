'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { Input, Label, Switch, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@penny/ui';

export function EmailSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Settings</CardTitle>
        <CardDescription>Configure email server and notification settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="smtp-host">SMTP Host</Label>
          <Input id="smtp-host" placeholder="smtp.example.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-port">SMTP Port</Label>
          <Input id="smtp-port" type="number" defaultValue="587" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-user">SMTP Username</Label>
          <Input id="smtp-user" placeholder="noreply@example.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="smtp-pass">SMTP Password</Label>
          <Input id="smtp-pass" type="password" placeholder="••••••••" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="from-email">From Email</Label>
          <Input id="from-email" type="email" placeholder="noreply@example.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="from-name">From Name</Label>
          <Input id="from-name" placeholder="PENNY Admin" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="encryption">Encryption</Label>
          <Select defaultValue="tls">
            <SelectTrigger id="encryption">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="ssl">SSL</SelectItem>
              <SelectItem value="tls">TLS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="email-notifications" defaultChecked />
          <Label htmlFor="email-notifications">Enable Email Notifications</Label>
        </div>

        <div className="flex gap-2">
          <Button variant="outline">Test Connection</Button>
          <Button>Save Email Settings</Button>
        </div>
      </CardContent>
    </Card>
  );
}