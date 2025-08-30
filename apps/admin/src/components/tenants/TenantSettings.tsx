'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@penny/ui';
import { Button, Input, Label, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@penny/ui';
import { Settings, Shield, Users, FileText, Globe, Mail } from 'lucide-react';

interface TenantSettingsProps {
  tenantId: string;
  settings: {
    allowSignups: boolean;
    requireEmailVerification: boolean;
    enableMFA: boolean;
    maxFileSize: number;
    retentionDays: number;
  };
}

export function TenantSettings({ tenantId, settings }: TenantSettingsProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings
          </CardTitle>
          <CardDescription>Configure security settings for this tenant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow-signups">Allow New Signups</Label>
              <p className="text-sm text-muted-foreground">
                Allow new users to sign up for this tenant
              </p>
            </div>
            <Switch id="allow-signups" defaultChecked={settings.allowSignups} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-verification">Require Email Verification</Label>
              <p className="text-sm text-muted-foreground">
                New users must verify their email address
              </p>
            </div>
            <Switch id="email-verification" defaultChecked={settings.requireEmailVerification} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-mfa">Enable Multi-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require MFA for all users in this tenant
              </p>
            </div>
            <Switch id="enable-mfa" defaultChecked={settings.enableMFA} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Data & Storage
          </CardTitle>
          <CardDescription>Configure data retention and storage limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="max-file-size">Maximum File Size (MB)</Label>
            <Input
              id="max-file-size"
              type="number"
              defaultValue={settings.maxFileSize}
              min="1"
              max="1000"
            />
            <p className="text-sm text-muted-foreground">
              Maximum size for file uploads in megabytes
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="retention-days">Data Retention (Days)</Label>
            <Select defaultValue={settings.retentionDays.toString()}>
              <SelectTrigger id="retention-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">365 days</SelectItem>
                <SelectItem value="0">Forever</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              How long to retain deleted data before permanent removal
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domain Settings
          </CardTitle>
          <CardDescription>Configure custom domain and branding</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="custom-domain">Custom Domain</Label>
            <Input
              id="custom-domain"
              type="text"
              placeholder="app.yourdomain.com"
            />
            <p className="text-sm text-muted-foreground">
              Use a custom domain for this tenant
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain</Label>
            <div className="flex gap-2">
              <Input
                id="subdomain"
                type="text"
                placeholder="acme"
              />
              <span className="flex items-center text-sm text-muted-foreground">.penny.app</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose a subdomain for this tenant
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Settings
          </CardTitle>
          <CardDescription>Configure email notifications and templates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="from-email">From Email</Label>
            <Input
              id="from-email"
              type="email"
              placeholder="noreply@yourdomain.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reply-to">Reply-To Email</Label>
            <Input
              id="reply-to"
              type="email"
              placeholder="support@yourdomain.com"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Enable Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send email notifications to users
              </p>
            </div>
            <Switch id="email-notifications" defaultChecked />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Save Settings</Button>
      </div>
    </div>
  );
}