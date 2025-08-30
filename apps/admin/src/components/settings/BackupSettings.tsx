'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label, Switch } from '@penny/ui';
import { Database, Download, Upload, Clock } from 'lucide-react';

export function BackupSettings() {
  const backups = [
    { id: 1, date: '2024-01-15 03:00', size: '2.3 GB', status: 'completed' },
    { id: 2, date: '2024-01-14 03:00', size: '2.2 GB', status: 'completed' },
    { id: 3, date: '2024-01-13 03:00', size: '2.2 GB', status: 'completed' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Backup Settings
        </CardTitle>
        <CardDescription>
          Configure automatic backups and restore data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch id="auto-backup" defaultChecked />
            <Label htmlFor="auto-backup">Enable Automatic Backups</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="backup-frequency">Backup Frequency</Label>
            <Select defaultValue="daily">
              <SelectTrigger id="backup-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="backup-time">Backup Time</Label>
            <Select defaultValue="03:00">
              <SelectTrigger id="backup-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="00:00">12:00 AM</SelectItem>
                <SelectItem value="03:00">03:00 AM</SelectItem>
                <SelectItem value="06:00">06:00 AM</SelectItem>
                <SelectItem value="12:00">12:00 PM</SelectItem>
                <SelectItem value="18:00">06:00 PM</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="retention">Retention Period</Label>
            <Select defaultValue="30">
              <SelectTrigger id="retention">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Recent Backups</h4>
          <div className="space-y-2">
            {backups.map((backup) => (
              <div key={backup.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{backup.date}</span>
                  <span className="text-muted-foreground">({backup.size})</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Create Backup Now
          </Button>
          <Button variant="outline">
            Restore from Backup
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}