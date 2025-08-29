'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  UserCheck, 
  UserX, 
  Mail, 
  Shield, 
  Key, 
  Ban,
  Trash2,
  AlertTriangle,
  Send
} from 'lucide-react';

interface UserActionsProps {
  userId: string;
  className?: string;
}

export function UserActions({ userId, className }: UserActionsProps) {
  const [emailDialog, setEmailDialog] = useState(false);
  const [resetPasswordDialog, setResetPasswordDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [banDialog, setBanDialog] = useState(false);
  
  const [emailForm, setEmailForm] = useState({
    subject: '',
    message: ''
  });
  
  const [banForm, setBanForm] = useState({
    reason: '',
    duration: 'permanent'
  });

  const handleActivateUser = async () => {
    try {
      // API call to activate user
      console.log('Activating user:', userId);
      // Show success toast
    } catch (error) {
      console.error('Failed to activate user:', error);
      // Show error toast
    }
  };

  const handleDeactivateUser = async () => {
    try {
      // API call to deactivate user
      console.log('Deactivating user:', userId);
      // Show success toast
    } catch (error) {
      console.error('Failed to deactivate user:', error);
      // Show error toast
    }
  };

  const handleSendEmail = async () => {
    try {
      // API call to send email
      console.log('Sending email to user:', userId, emailForm);
      setEmailDialog(false);
      setEmailForm({ subject: '', message: '' });
      // Show success toast
    } catch (error) {
      console.error('Failed to send email:', error);
      // Show error toast
    }
  };

  const handleResetPassword = async () => {
    try {
      // API call to reset password
      console.log('Resetting password for user:', userId);
      setResetPasswordDialog(false);
      // Show success toast
    } catch (error) {
      console.error('Failed to reset password:', error);
      // Show error toast
    }
  };

  const handleBanUser = async () => {
    try {
      // API call to ban user
      console.log('Banning user:', userId, banForm);
      setBanDialog(false);
      setBanForm({ reason: '', duration: 'permanent' });
      // Show success toast
    } catch (error) {
      console.error('Failed to ban user:', error);
      // Show error toast
    }
  };

  const handleDeleteUser = async () => {
    try {
      // API call to delete user
      console.log('Deleting user:', userId);
      setDeleteDialog(false);
      // Show success toast and redirect
    } catch (error) {
      console.error('Failed to delete user:', error);
      // Show error toast
    }
  };

  return (
    <>
      <div className={`space-y-2 ${className}`}>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start"
          onClick={handleActivateUser}
        >
          <UserCheck className="mr-2 h-4 w-4" />
          Activate User
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start"
          onClick={handleDeactivateUser}
        >
          <UserX className="mr-2 h-4 w-4" />
          Deactivate User
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start"
          onClick={() => setEmailDialog(true)}
        >
          <Mail className="mr-2 h-4 w-4" />
          Send Email
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start"
          onClick={() => setResetPasswordDialog(true)}
        >
          <Key className="mr-2 h-4 w-4" />
          Reset Password
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start"
        >
          <Shield className="mr-2 h-4 w-4" />
          Reset MFA
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start text-yellow-600 hover:text-yellow-700"
          onClick={() => setBanDialog(true)}
        >
          <Ban className="mr-2 h-4 w-4" />
          Ban User
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start text-red-600 hover:text-red-700"
          onClick={() => setDeleteDialog(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete User
        </Button>
      </div>

      {/* Send Email Dialog */}
      <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Email to User
            </DialogTitle>
            <DialogDescription>
              Send a direct email to this user. They will receive it at their registered email address.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                placeholder="Enter email subject..."
                value={emailForm.subject}
                onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="email-message">Message</Label>
              <Textarea
                id="email-message"
                placeholder="Enter your message..."
                rows={4}
                value={emailForm.message}
                onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={!emailForm.subject || !emailForm.message}>
              <Send className="mr-2 h-4 w-4" />
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialog} onOpenChange={setResetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Reset User Password
            </DialogTitle>
            <DialogDescription>
              This will generate a new temporary password and send it to the user's email address. 
              They will be required to change it on their next login.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword}>
              <Key className="mr-2 h-4 w-4" />
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={banDialog} onOpenChange={setBanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-yellow-600" />
              Ban User
            </DialogTitle>
            <DialogDescription>
              Banned users will be unable to access the platform. This action can be reversed later.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="ban-reason">Reason for Ban</Label>
              <Textarea
                id="ban-reason"
                placeholder="Enter reason for banning this user..."
                rows={3}
                value={banForm.reason}
                onChange={(e) => setBanForm(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBanUser}
              disabled={!banForm.reason.trim()}
            >
              <Ban className="mr-2 h-4 w-4" />
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All user data including conversations, 
              files, and settings will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Warning:</strong> This will permanently delete all user data and cannot be recovered.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}