'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Checkbox,
} from '@penny/ui';
import { MoreHorizontal, Mail, Shield, Ban, Trash, Key, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  tenant: string;
  role: 'admin' | 'owner' | 'member' | 'viewer';
  status: 'active' | 'pending' | 'suspended';
  lastActive: Date;
  createdAt: Date;
  mfaEnabled: boolean;
}

// Mock data
const users: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@acme.com',
    tenant: 'Acme Corp',
    role: 'owner',
    status: 'active',
    lastActive: new Date(Date.now() - 1000 * 60 * 5),
    createdAt: new Date('2024-01-15'),
    mfaEnabled: true,
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane.smith@acme.com',
    tenant: 'Acme Corp',
    role: 'admin',
    status: 'active',
    lastActive: new Date(Date.now() - 1000 * 60 * 60),
    createdAt: new Date('2024-01-20'),
    mfaEnabled: true,
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@techstart.com',
    tenant: 'TechStart Inc',
    role: 'member',
    status: 'pending',
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24),
    createdAt: new Date('2024-02-01'),
    mfaEnabled: false,
  },
];

const roleColors = {
  owner: 'destructive',
  admin: 'default',
  member: 'secondary',
  viewer: 'outline',
} as const;

const statusColors = {
  active: 'default',
  pending: 'secondary',
  suspended: 'destructive',
} as const;

interface UsersTableProps {
  searchQuery: string;
  status: 'all' | 'active' | 'pending' | 'suspended';
}

export function UsersTable({ searchQuery, status }: UsersTableProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.tenant.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = status === 'all' || user.status === status;

    return matchesSearch && matchesStatus;
  });

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map((user) => user.id));
    }
  };

  return (
    <div>
      {selectedUsers.length > 0 && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedUsers.length} user(s) selected</span>
          <Button size="sm" variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Send Email
          </Button>
          <Button size="sm" variant="outline">
            <Ban className="mr-2 h-4 w-4" />
            Suspend
          </Button>
          <Button size="sm" variant="outline" className="text-red-600">
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedUsers.length === filteredUsers.length}
                onCheckedChange={toggleAllUsers}
              />
            </TableHead>
            <TableHead>User</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead>Security</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Checkbox
                  checked={selectedUsers.includes(user.id)}
                  onCheckedChange={() => toggleUserSelection(user.id)}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>
                      {user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>{user.tenant}</TableCell>
              <TableCell>
                <Badge variant={roleColors[user.role]}>{user.role.toUpperCase()}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={statusColors[user.status]}>{user.status}</Badge>
              </TableCell>
              <TableCell>{format(user.lastActive, 'MMM d, h:mm a')}</TableCell>
              <TableCell>
                {user.mfaEnabled && (
                  <Badge variant="outline" className="text-green-600">
                    <Shield className="mr-1 h-3 w-3" />
                    MFA
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <UserCheck className="mr-2 h-4 w-4" />
                      <span>View Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Mail className="mr-2 h-4 w-4" />
                      <span>Send Email</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Key className="mr-2 h-4 w-4" />
                      <span>Reset Password</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Change Role</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {user.status === 'active' ? (
                      <DropdownMenuItem>
                        <Ban className="mr-2 h-4 w-4" />
                        <span>Suspend User</span>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem>
                        <UserCheck className="mr-2 h-4 w-4" />
                        <span>Activate User</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-red-600">
                      <Trash className="mr-2 h-4 w-4" />
                      <span>Delete User</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
