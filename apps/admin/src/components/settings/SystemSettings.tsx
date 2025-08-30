'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Button } from '@penny/ui';

export function SystemSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Settings</CardTitle>
        <CardDescription>Configure core system parameters</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="site-name">Site Name</Label>
          <Input id="site-name" defaultValue="PENNY Admin" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select defaultValue="utc">
            <SelectTrigger id="timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="utc">UTC</SelectItem>
              <SelectItem value="est">Eastern Time</SelectItem>
              <SelectItem value="pst">Pacific Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="language">Default Language</Label>
          <Select defaultValue="en">
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="maintenance" />
          <Label htmlFor="maintenance">Maintenance Mode</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch id="debug" />
          <Label htmlFor="debug">Debug Mode</Label>
        </div>

        <Button>Save Changes</Button>
      </CardContent>
    </Card>
  );
}