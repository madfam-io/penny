'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { Input, Label, Switch, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@penny/ui';

export function SecuritySettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Settings</CardTitle>
        <CardDescription>Configure security and authentication options</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
          <Input id="session-timeout" type="number" defaultValue="30" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password-policy">Password Policy</Label>
          <Select defaultValue="strong">
            <SelectTrigger id="password-policy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Basic (8+ characters)</SelectItem>
              <SelectItem value="moderate">Moderate (8+ chars, mixed case)</SelectItem>
              <SelectItem value="strong">Strong (8+ chars, mixed case, numbers, symbols)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-attempts">Max Login Attempts</Label>
          <Input id="max-attempts" type="number" defaultValue="5" />
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="mfa" defaultChecked />
          <Label htmlFor="mfa">Require Two-Factor Authentication</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="sso" defaultChecked />
          <Label htmlFor="sso">Enable Single Sign-On (SSO)</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="audit" defaultChecked />
          <Label htmlFor="audit">Enable Audit Logging</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="encryption" defaultChecked />
          <Label htmlFor="encryption">Encrypt Data at Rest</Label>
        </div>

        <Button>Save Security Settings</Button>
      </CardContent>
    </Card>
  );
}