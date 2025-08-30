'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@penny/ui';
import { format } from 'date-fns';

interface Conversation {
  id: string;
  userId: string;
  userName: string;
  title: string;
  messageCount: number;
  lastActivity: Date;
  status: 'active' | 'archived';
}

export function ConversationsTable() {
  const conversations: Conversation[] = [
    {
      id: '1',
      userId: 'user1',
      userName: 'John Doe',
      title: 'Help with API integration',
      messageCount: 12,
      lastActivity: new Date(),
      status: 'active',
    },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Messages</TableHead>
          <TableHead>Last Activity</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {conversations.map((conv) => (
          <TableRow key={conv.id}>
            <TableCell>{conv.userName}</TableCell>
            <TableCell>{conv.title}</TableCell>
            <TableCell>{conv.messageCount}</TableCell>
            <TableCell>{format(conv.lastActivity, 'PPp')}</TableCell>
            <TableCell>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  conv.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {conv.status}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}