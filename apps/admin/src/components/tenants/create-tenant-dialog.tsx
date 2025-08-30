'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,\n} from '@penny/ui';
import { Loader2 } from 'lucide-react';

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTenantDialog({ open, onOpenChange }: CreateTenantDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({\n    name: '',\n    slug: '',
    plan: 'starter',\n    adminEmail: '',\n    adminName: '',
    enableSso: false,
    enableMfa: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsLoading(false);
    onOpenChange(false);
    // Reset form
    setFormData({\n      name: '',\n      slug: '',
      plan: 'starter',\n      adminEmail: '',\n      adminName: '',
      enableSso: false,
      enableMfa: false,
    });
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()\n      .replace(/[^a-z0-9]+/g, '-')\n      .replace(/^-|-$/g, '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Tenant</DialogTitle>
            <DialogDescription>
              Set up a new tenant organization with initial configuration
            </DialogDescription>
          </DialogHeader>
\n          <div className="grid gap-4 py-4">\n            <div className="grid gap-2">\n              <Label htmlFor="name">Organization Name</Label>
              <Input\n                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    name: e.target.value,
                    slug: generateSlug(e.target.value),
                  });
                }}\n                placeholder="Acme Corporation"
                required
              />
            </div>
\n            <div className="grid gap-2">\n              <Label htmlFor="slug">URL Slug</Label>
              <Input\n                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}\n                placeholder="acme-corp"\n                pattern="[a-z0-9-]+"
                required
              />\n              <p className="text-sm text-muted-foreground">
                This will be used in URLs: {formData.slug || 'your-org'}.penny.ai
              </p>
            </div>
\n            <div className="grid gap-2">\n              <Label htmlFor="plan">Subscription Plan</Label>
              <Select
                value={formData.plan}
                onValueChange={(value) => setFormData({ ...formData, plan: value })}
              >\n                <SelectTrigger id="plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>\n                  <SelectItem value="free">Free</SelectItem>\n                  <SelectItem value="starter">Starter</SelectItem>\n                  <SelectItem value="pro">Pro</SelectItem>\n                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
\n            <div className="grid gap-2">\n              <Label htmlFor="adminEmail">Admin Email</Label>
              <Input\n                id="adminEmail"\n                type="email"
                value={formData.adminEmail}
                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}\n                placeholder="admin@example.com"
                required
              />
            </div>
\n            <div className="grid gap-2">\n              <Label htmlFor="adminName">Admin Name</Label>
              <Input\n                id="adminName"
                value={formData.adminName}
                onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}\n                placeholder="John Doe"
                required
              />
            </div>
\n            <div className="space-y-4">\n              <div className="flex items-center justify-between">\n                <Label htmlFor="enableSso">Enable SSO</Label>
                <Switch\n                  id="enableSso"
                  checked={formData.enableSso}
                  onCheckedChange={(checked) => setFormData({ ...formData, enableSso: checked })}
                />
              </div>
\n              <div className="flex items-center justify-between">\n                <Label htmlFor="enableMfa">Require MFA</Label>
                <Switch\n                  id="enableMfa"
                  checked={formData.enableMfa}
                  onCheckedChange={(checked) => setFormData({ ...formData, enableMfa: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button\n              type="button"\n              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>\n            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>\n                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Tenant'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
