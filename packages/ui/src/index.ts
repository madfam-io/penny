// Placeholder UI components for build
import React from 'react';

export const Button = ({ children, ...props }: any) => {
  return React.createElement('button', props, children);
};

export const Card = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};

export const CardHeader = Card;
export const CardTitle = Card;
export const CardDescription = Card;
export const CardContent = Card;
export const CardFooter = Card;

export const Badge = ({ children, ...props }: any) => {
  return React.createElement('span', props, children);
};

export const Progress = ({ value, ...props }: any) => {
  return React.createElement('div', props);
};

export const Modal = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};

// Additional components needed by admin app
export const Input = ({ ...props }: any) => {
  return React.createElement('input', props);
};

export const Label = ({ children, ...props }: any) => {
  return React.createElement('label', props, children);
};

export const Textarea = ({ ...props }: any) => {
  return React.createElement('textarea', props);
};

export const Select = ({ children, ...props }: any) => {
  return React.createElement('select', props, children);
};

export const SelectContent = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};

export const SelectItem = ({ children, ...props }: any) => {
  return React.createElement('option', props, children);
};

export const SelectTrigger = ({ children, ...props }: any) => {
  return React.createElement('button', props, children);
};

export const SelectValue = ({ ...props }: any) => {
  return React.createElement('span', props);
};

export const Dialog = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};

export const DialogContent = Dialog;
export const DialogDescription = Dialog;
export const DialogFooter = Dialog;
export const DialogHeader = Dialog;
export const DialogTitle = Dialog;

export const Table = ({ children, ...props }: any) => {
  return React.createElement('table', props, children);
};

export const TableBody = ({ children, ...props }: any) => {
  return React.createElement('tbody', props, children);
};

export const TableCell = ({ children, ...props }: any) => {
  return React.createElement('td', props, children);
};

export const TableHead = ({ children, ...props }: any) => {
  return React.createElement('th', props, children);
};

export const TableHeader = ({ children, ...props }: any) => {
  return React.createElement('thead', props, children);
};

export const TableRow = ({ children, ...props }: any) => {
  return React.createElement('tr', props, children);
};

export const Tabs = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};

export const TabsContent = Tabs;
export const TabsList = Tabs;
export const TabsTrigger = Tabs;

export const Avatar = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};

export const AvatarFallback = Avatar;
export const AvatarImage = ({ ...props }: any) => {
  return React.createElement('img', props);
};

export const Switch = ({ ...props }: any) => {
  return React.createElement('input', { type: 'checkbox', ...props });
};

export const Separator = ({ ...props }: any) => {
  return React.createElement('hr', props);
};

export const Checkbox = ({ ...props }: any) => {
  return React.createElement('input', { type: 'checkbox', ...props });
};

export const DropdownMenu = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};

export const DropdownMenuContent = DropdownMenu;
export const DropdownMenuItem = DropdownMenu;
export const DropdownMenuLabel = DropdownMenu;
export const DropdownMenuSeparator = Separator;
export const DropdownMenuTrigger = DropdownMenu;

export const Tooltip = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};

export const TooltipContent = Tooltip;
export const TooltipProvider = Tooltip;
export const TooltipTrigger = Tooltip;

export const Toast = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};

export const Sheet = ({ children, ...props }: any) => {
  return React.createElement('div', props, children);
};

export const SheetContent = Sheet;
export const SheetDescription = Sheet;
export const SheetHeader = Sheet;
export const SheetTitle = Sheet;
export const SheetTrigger = Sheet;