'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { Button, Switch, Label, Input, Textarea } from '@penny/ui';
import { AlertTriangle } from 'lucide-react';

export function MaintenanceMode() {
  const [isEnabled, setIsEnabled] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Maintenance Mode
        </CardTitle>
        <CardDescription>
          Enable maintenance mode to prevent user access during updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <Switch
            id="maintenance-enabled"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
          <Label htmlFor="maintenance-enabled" className="font-semibold">
            Enable Maintenance Mode
          </Label>
        </div>

        {isEnabled && (
          <div className="space-y-4 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <div className="space-y-2">
              <Label htmlFor="maintenance-title">Maintenance Title</Label>
              <Input
                id="maintenance-title"
                defaultValue="System Maintenance"
                placeholder="Enter maintenance title..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance-message">Maintenance Message</Label>
              <Textarea
                id="maintenance-message"
                rows={4}
                defaultValue="We're currently performing scheduled maintenance. The system will be back online shortly."
                placeholder="Enter message to display to users..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated-time">Estimated Downtime</Label>
              <Input
                id="estimated-time"
                type="text"
                defaultValue="30 minutes"
                placeholder="e.g., 30 minutes, 2 hours"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowed-ips">Allowed IP Addresses</Label>
              <Textarea
                id="allowed-ips"
                rows={3}
                placeholder="Enter IP addresses (one per line) that can bypass maintenance mode..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Admin users from these IPs can still access the system
              </p>
            </div>

            <Button variant="destructive">
              Activate Maintenance Mode
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}