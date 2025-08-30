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
  Textarea,
  Checkbox,\n} from '@penny/ui';
import { Loader2 } from 'lucide-react';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({\n    email: '',\n    name: '',\n    tenant: '',\n    workspace: '',
    role: 'member',
    sendWelcomeEmail: true,\n    customMessage: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsLoading(false);
    onOpenChange(false);
    // Reset form
    setFormData({\n      email: '',\n      name: '',\n      tenant: '',\n      workspace: '',
      role: 'member',
      sendWelcomeEmail: true,\n      customMessage: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>Send an invitation to join the platform</DialogDescription>
          </DialogHeader>
\n          <div className="grid gap-4 py-4">\n            <div className="grid gap-2">\n              <Label htmlFor="email">Email Address</Label>
              <Input\n                id="email"\n                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}\n                placeholder="user@example.com"
                required
              />
            </div>
\n            <div className="grid gap-2">\n              <Label htmlFor="name">Full Name</Label>
              <Input\n                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}\n                placeholder="John Doe"
              />
            </div>
\n            <div className="grid gap-2">\n              <Label htmlFor="tenant">Tenant</Label>
              <Select
                value={formData.tenant}
                onValueChange={(value) => setFormData({ ...formData, tenant: value })}
              >\n                <SelectTrigger id="tenant">\n                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>\n                  <SelectItem value="acme">Acme Corporation</SelectItem>\n                  <SelectItem value="techstart">TechStart Inc</SelectItem>\n                  <SelectItem value="digital">Digital Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
\n            <div className="grid gap-2">\n              <Label htmlFor="workspace">Workspace (Optional)</Label>
              <Select
                value={formData.workspace}
                onValueChange={(value) => setFormData({ ...formData, workspace: value })}
              >\n                <SelectTrigger id="workspace">\n                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>\n                  <SelectItem value="marketing">Marketing Team</SelectItem>\n                  <SelectItem value="engineering">Engineering</SelectItem>\n                  <SelectItem value="sales">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
\n            <div className="grid gap-2">\n              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >\n                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>\n                  <SelectItem value="owner">Owner</SelectItem>\n                  <SelectItem value="admin">Admin</SelectItem>\n                  <SelectItem value="member">Member</SelectItem>\n                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
\n            <div className="flex items-center space-x-2">
              <Checkbox\n                id="sendWelcomeEmail"
                checked={formData.sendWelcomeEmail}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, sendWelcomeEmail: checked as boolean })
                }
              />\n              <Label htmlFor="sendWelcomeEmail">Send welcome email with login instructions</Label>
            </div>

            {formData.sendWelcomeEmail && (\n              <div className="grid gap-2">\n                <Label htmlFor="customMessage">Custom Message (Optional)</Label>
                <Textarea\n                  id="customMessage"
                  value={formData.customMessage}
                  onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}\n                  placeholder="Add a personal message to the invitation..."
                  rows={3}
                />
              </div>
            )}
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
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
