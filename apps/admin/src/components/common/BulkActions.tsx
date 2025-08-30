'use client';

import { useState } from 'react';
import { Button } from '@penny/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@penny/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@penny/ui';
import { Badge } from '@penny/ui';
import { 
  ChevronDown, 
  Trash2, 
  Download, 
  Edit, 
  Mail, 
  UserCheck, 
  UserX,
  Archive,
  Ban,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { cn } from '@/utils/cn';

export interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive' | 'secondary';
  requiresConfirmation?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  disabled?: boolean;
  tooltip?: string;
}

interface BulkActionsProps {
  selectedCount: number;
  totalCount: number;
  actions: BulkAction[];
  onAction: (actionId: string) => Promise<void> | void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  loading?: boolean;
  className?: string;
}

export function BulkActions({
  selectedCount,
  totalCount,
  actions,
  onAction,
  onSelectAll,
  onClearSelection,
  loading = false,
  className
}: BulkActionsProps) {
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleAction = async (action: BulkAction) => {
    if (action.requiresConfirmation) {
      setConfirmAction(action);
      return;
    }

    await executeAction(action);
  };

  const executeAction = async (action: BulkAction) => {
    try {
      setIsExecuting(true);
      await onAction(action.id);
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setIsExecuting(false);
      setConfirmAction(null);
    }
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <div className={cn(
        'flex items-center justify-between p-3 bg-muted/50 border rounded-lg',
        className
      )}>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {selectedCount} selected
          </Badge>
         
         <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {selectedCount < totalCount && onSelectAll && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={onSelectAll}
              >
                Select all {totalCount}
              </Button>
            )}
            
            {onClearSelection && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={onClearSelection}
              >
                Clear selection
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Actions */}
          {actions.slice(0, 2).map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant={action.variant || 'outline'}
                size="sm"
                onClick={() => handleAction(action)}
                disabled={loading || isExecuting || action.disabled}
                title={action.tooltip}
              >
                {isExecuting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="mr-2 h-4 w-4" />
                )}
                {action.label}
              </Button>
            );
          })}

          {/* More Actions Dropdown */}
          {actions.length > 2 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  More
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.slice(2).map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <div key={action.id}>
                      {index === 0 && actions.length > 2 && <DropdownMenuSeparator />}
                      <DropdownMenuItem
                        onClick={() => handleAction(action)}
                        disabled={loading || isExecuting || action.disabled}
                        className={cn(
                          action.variant === 'destructive' && 
                          'text-red-600 focus:text-red-600'
                        )}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {action.label}
                      </DropdownMenuItem>
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmAction?.variant === 'destructive' ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <CheckCircle className="h-5 w-5 text-blue-600" />
              )}
              {confirmAction?.confirmTitle || `Confirm ${confirmAction?.label}`}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.confirmDescription ||
              `Are you sure you want to ${confirmAction?.label.toLowerCase()} ${selectedCount} item${selectedCount === 1 ? '' : 's'}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isExecuting}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction?.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={() => confirmAction && executeAction(confirmAction)}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {confirmAction?.icon && (
                    <confirmAction.icon className="mr-2 h-4 w-4" />
                  )}
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Predefined common actions
export const commonBulkActions: Record<string, BulkAction> = {
  delete: {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    variant: 'destructive',
    requiresConfirmation: true,
    confirmTitle: 'Delete Items',
    confirmDescription: 'This action cannot be undone. All selected items will be permanently deleted.'
  },
  export: {
    id: 'export',
    label: 'Export',
    icon: Download,
    variant: 'outline'
  },
  edit: {
    id: 'edit',
    label: 'Bulk Edit',
    icon: Edit,
    variant: 'outline'
  },
  email: {
    id: 'email',
    label: 'Send Email',
    icon: Mail,
    variant: 'outline'
  },
  activate: {
    id: 'activate',
    label: 'Activate',
    icon: UserCheck,
    variant: 'outline',
    requiresConfirmation: true
  },
  deactivate: {
    id: 'deactivate',
    label: 'Deactivate',
    icon: UserX,
    variant: 'destructive',
    requiresConfirmation: true
  },
  archive: {
    id: 'archive',
    label: 'Archive',
    icon: Archive,
    variant: 'outline',
    requiresConfirmation: true
  },
  ban: {
    id: 'ban',
    label: 'Ban',
    icon: Ban,
    variant: 'destructive',
    requiresConfirmation: true,
    confirmTitle: 'Ban Users',
    confirmDescription: 'Banned users will be unable to access the platform. This action can be reversed later.'
  }
};