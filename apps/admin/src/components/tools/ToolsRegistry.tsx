'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@penny/ui';
import { 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2, 
  Play, 
  Pause,
  ExternalLink,
  Copy,
  Shield,
  Zap
} from 'lucide-react';

interface Tool {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  status: 'active' | 'inactive' | 'deprecated';
  provider: string;
  permissions: string[];
  usage_count: number;
  last_used: string;
  created_at: string;
  updated_at: string;
}

export function ToolsRegistry() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now - replace with actual API call
    const mockTools: Tool[] = [
      {
        id: '1',
        name: 'get_company_kpis',
        version: '1.2.0',
        description: 'Retrieve key performance indicators for company analytics',
        category: 'Analytics',
        status: 'active',
        provider: 'Internal',
        permissions: ['analytics.read', 'company.read'],
        usage_count: 1547,
        last_used: '2024-08-30T10:30:00Z',
        created_at: '2024-01-15T09:00:00Z',
        updated_at: '2024-08-15T14:20:00Z'
      },
      {
        id: '2',
        name: 'load_dashboard',
        version: '2.1.0',
        description: 'Load and render interactive dashboard components',
        category: 'Visualization',
        status: 'active',
        provider: 'Internal',
        permissions: ['dashboard.read', 'ui.render'],
        usage_count: 892,
        last_used: '2024-08-30T09:15:00Z',
        created_at: '2024-02-01T11:30:00Z',
        updated_at: '2024-08-20T16:45:00Z'
      },
      {
        id: '3',
        name: 'send_email_notification',
        version: '1.0.3',
        description: 'Send email notifications via configured providers',
        category: 'Communication',
        status: 'inactive',
        provider: 'SendGrid',
        permissions: ['email.send', 'notifications.create'],
        usage_count: 234,
        last_used: '2024-08-25T14:22:00Z',
        created_at: '2024-03-10T08:15:00Z',
        updated_at: '2024-08-25T14:22:00Z'
      },
      {
        id: '4',
        name: 'create_jira_ticket',
        version: '3.0.1',
        description: 'Create and manage Jira tickets from conversations',
        category: 'Integration',
        status: 'active',
        provider: 'Atlassian',
        permissions: ['jira.create', 'jira.read'],
        usage_count: 445,
        last_used: '2024-08-29T17:30:00Z',
        created_at: '2024-04-05T10:00:00Z',
        updated_at: '2024-08-28T12:00:00Z'
      },
      {
        id: '5',
        name: 'execute_python_code',
        version: '1.5.2',
        description: 'Execute Python code in sandboxed environment',
        category: 'Code Execution',
        status: 'active',
        provider: 'Internal',
        permissions: ['code.execute', 'sandbox.access'],
        usage_count: 1203,
        last_used: '2024-08-30T11:45:00Z',
        created_at: '2024-01-20T14:30:00Z',
        updated_at: '2024-08-10T09:15:00Z'
      }
    ];
    
    setTimeout(() => {
      setTools(mockTools);
      setLoading(false);
    }, 1000);
  }, []);

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      inactive: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      deprecated: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants] || variants.inactive}>
        {status}
      </Badge>
    );
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      'Analytics': <Zap className="h-4 w-4" />,
      'Visualization': <Eye className="h-4 w-4" />,
      'Communication': <ExternalLink className="h-4 w-4" />,
      'Integration': <Shield className="h-4 w-4" />,
      'Code Execution': <Play className="h-4 w-4" />
    };
    
    return icons[category as keyof typeof icons] || <Shield className="h-4 w-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatUsageCount = (count: number) => {
    if (count > 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Tool</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead className="text-right">Usage</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tools.map((tool) => (
              <TableRow key={tool.id}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      {getCategoryIcon(tool.category)}
                      {tool.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      v{tool.version}
                    </div>
                    <div className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {tool.description}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{tool.category}</Badge>
                </TableCell>
                <TableCell>
                  {getStatusBadge(tool.status)}
                </TableCell>
                <TableCell className="font-medium">{tool.provider}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatUsageCount(tool.usage_count)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(tool.last_used)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Tool
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Tool ID
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        {tool.status === 'active' ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Tool
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {tools.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="mx-auto h-12 w-12 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No tools found</h3>
          <p>Get started by adding your first tool to the registry.</p>
        </div>
      )}
    </div>
  );
}