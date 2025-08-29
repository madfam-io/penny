import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedBuiltInTools() {
  console.log('🔧 Seeding built-in tools...');

  // System tools (available to all tenants)
  const systemTools = [
    {
      name: 'get_company_kpis',
      displayName: 'Get Company KPIs',
      description: 'Retrieve key performance indicators and metrics for business analysis',
      category: 'analytics',
      icon: 'TrendingUp',
      schema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
            default: 'monthly',
            description: 'Time period for KPI data'
          },
          metrics: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['revenue', 'users', 'conversion', 'churn', 'satisfaction', 'all']
            },
            default: ['all'],
            description: 'Specific metrics to retrieve'
          },
          startDate: {
            type: 'string',
            format: 'date',
            description: 'Start date for the analysis period'
          },
          endDate: {
            type: 'string',
            format: 'date',
            description: 'End date for the analysis period'
          }
        },
        required: ['period']
      },
      config: {
        timeout: 30000,
        retryCount: 3,
        cacheResults: true,
        cacheTtl: 300
      },
      isSystem: true,
      requiresAuth: false,
      maxExecutionsPerMinute: 10,
      maxExecutionsPerHour: 100
    },
    {
      name: 'load_dashboard',
      displayName: 'Load Dashboard',
      description: 'Load and display interactive dashboard with charts and visualizations',
      category: 'visualization',
      icon: 'Dashboard',
      schema: {
        type: 'object',
        properties: {
          dashboardType: {
            type: 'string',
            enum: ['overview', 'sales', 'marketing', 'finance', 'operations', 'custom'],
            default: 'overview',
            description: 'Type of dashboard to load'
          },
          timeRange: {
            type: 'string',
            enum: ['7d', '30d', '90d', '1y', 'custom'],
            default: '30d',
            description: 'Time range for dashboard data'
          },
          filters: {
            type: 'object',
            properties: {
              department: { type: 'string' },
              region: { type: 'string' },
              product: { type: 'string' }
            },
            description: 'Filters to apply to dashboard data'
          },
          layout: {
            type: 'string',
            enum: ['grid', 'list', 'custom'],
            default: 'grid',
            description: 'Dashboard layout style'
          }
        },
        required: ['dashboardType']
      },
      config: {
        timeout: 45000,
        retryCount: 2,
        cacheResults: true,
        cacheTtl: 180
      },
      isSystem: true,
      requiresAuth: false,
      maxExecutionsPerMinute: 20,
      maxExecutionsPerHour: 200
    },
    {
      name: 'python_code',
      displayName: 'Python Code Executor',
      description: 'Execute Python code with data analysis and visualization capabilities',
      category: 'code',
      icon: 'Code',
      schema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Python code to execute'
          },
          packages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional packages to install'
          },
          timeout: {
            type: 'integer',
            default: 30,
            minimum: 1,
            maximum: 300,
            description: 'Execution timeout in seconds'
          },
          variables: {
            type: 'object',
            description: 'Variables to inject into the execution environment'
          }
        },
        required: ['code']
      },
      config: {
        timeout: 300000, // 5 minutes
        retryCount: 1,
        sandboxed: true,
        allowedPackages: [
          'pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly',
          'requests', 'json', 'datetime', 'math', 'statistics',
          'sklearn', 'scipy'
        ]
      },
      isSystem: true,
      requiresAuth: true,
      requiresConfirmation: true,
      maxExecutionsPerMinute: 5,
      maxExecutionsPerHour: 50,
      costPerExecutionCents: 10
    },
    {
      name: 'search_documents',
      displayName: 'Search Documents',
      description: 'Search through uploaded documents and knowledge base',
      category: 'search',
      icon: 'Search',
      schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          filters: {
            type: 'object',
            properties: {
              fileType: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['pdf', 'docx', 'txt', 'md', 'html']
                }
              },
              dateRange: {
                type: 'object',
                properties: {
                  from: { type: 'string', format: 'date' },
                  to: { type: 'string', format: 'date' }
                }
              },
              tags: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          limit: {
            type: 'integer',
            default: 10,
            minimum: 1,
            maximum: 100,
            description: 'Maximum number of results'
          },
          similarity_threshold: {
            type: 'number',
            default: 0.7,
            minimum: 0,
            maximum: 1,
            description: 'Minimum similarity score for results'
          }
        },
        required: ['query']
      },
      config: {
        timeout: 30000,
        retryCount: 2,
        useEmbeddings: true,
        model: 'text-embedding-ada-002'
      },
      isSystem: true,
      requiresAuth: true,
      maxExecutionsPerMinute: 30,
      maxExecutionsPerHour: 500
    },
    {
      name: 'create_chart',
      displayName: 'Create Chart',
      description: 'Generate interactive charts and visualizations',
      category: 'visualization',
      icon: 'BarChart3',
      schema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['line', 'bar', 'pie', 'scatter', 'area', 'histogram', 'heatmap'],
            description: 'Type of chart to create'
          },
          data: {
            type: 'object',
            description: 'Chart data in JSON format'
          },
          config: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              xAxis: { type: 'string' },
              yAxis: { type: 'string' },
              color: { type: 'string' },
              theme: {
                type: 'string',
                enum: ['light', 'dark', 'auto']
              }
            }
          }
        },
        required: ['type', 'data']
      },
      config: {
        timeout: 20000,
        retryCount: 2
      },
      isSystem: true,
      requiresAuth: false,
      maxExecutionsPerMinute: 50,
      maxExecutionsPerHour: 1000
    },
    {
      name: 'send_email',
      displayName: 'Send Email',
      description: 'Send emails with templates and attachments',
      category: 'communication',
      icon: 'Mail',
      schema: {
        type: 'object',
        properties: {
          to: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            description: 'Recipient email addresses'
          },
          cc: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            description: 'CC email addresses'
          },
          bcc: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            description: 'BCC email addresses'
          },
          subject: {
            type: 'string',
            description: 'Email subject line'
          },
          body: {
            type: 'string',
            description: 'Email body content'
          },
          template: {
            type: 'string',
            description: 'Email template ID to use'
          },
          variables: {
            type: 'object',
            description: 'Template variables'
          },
          attachments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                content: { type: 'string' },
                type: { type: 'string' }
              }
            }
          }
        },
        required: ['to', 'subject']
      },
      config: {
        timeout: 60000,
        retryCount: 3,
        provider: 'sendgrid'
      },
      isSystem: true,
      requiresAuth: true,
      requiresConfirmation: true,
      maxExecutionsPerMinute: 10,
      maxExecutionsPerHour: 100,
      costPerExecutionCents: 5
    },
    {
      name: 'slack_integration',
      displayName: 'Slack Integration',
      description: 'Send messages and interact with Slack channels',
      category: 'communication',
      icon: 'MessageSquare',
      schema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['send_message', 'create_channel', 'invite_user', 'get_channels'],
            description: 'Slack action to perform'
          },
          channel: {
            type: 'string',
            description: 'Slack channel ID or name'
          },
          message: {
            type: 'string',
            description: 'Message content to send'
          },
          user: {
            type: 'string',
            description: 'User ID for user-specific actions'
          },
          blocks: {
            type: 'array',
            description: 'Slack block kit components'
          }
        },
        required: ['action']
      },
      config: {
        timeout: 30000,
        retryCount: 3,
        requiresSlackBot: true
      },
      isSystem: true,
      requiresAuth: true,
      maxExecutionsPerMinute: 20,
      maxExecutionsPerHour: 200
    },
    {
      name: 'jira_integration',
      displayName: 'Jira Integration',
      description: 'Create and manage Jira issues and projects',
      category: 'project_management',
      icon: 'Ticket',
      schema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create_issue', 'update_issue', 'get_issue', 'search_issues', 'create_project'],
            description: 'Jira action to perform'
          },
          project: {
            type: 'string',
            description: 'Jira project key'
          },
          issueType: {
            type: 'string',
            enum: ['Bug', 'Task', 'Story', 'Epic'],
            description: 'Type of issue to create'
          },
          summary: {
            type: 'string',
            description: 'Issue summary/title'
          },
          description: {
            type: 'string',
            description: 'Issue description'
          },
          priority: {
            type: 'string',
            enum: ['Lowest', 'Low', 'Medium', 'High', 'Highest']
          },
          assignee: {
            type: 'string',
            description: 'Assignee username or ID'
          }
        },
        required: ['action']
      },
      config: {
        timeout: 45000,
        retryCount: 2,
        requiresJiraConnection: true
      },
      isSystem: true,
      requiresAuth: true,
      maxExecutionsPerMinute: 15,
      maxExecutionsPerHour: 150
    },
    {
      name: 'export_data',
      displayName: 'Export Data',
      description: 'Export data in various formats (CSV, Excel, JSON, PDF)',
      category: 'data',
      icon: 'Download',
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: 'Data to export'
          },
          format: {
            type: 'string',
            enum: ['csv', 'xlsx', 'json', 'pdf', 'xml'],
            default: 'csv',
            description: 'Export format'
          },
          filename: {
            type: 'string',
            description: 'Name for the exported file'
          },
          options: {
            type: 'object',
            properties: {
              headers: { type: 'boolean', default: true },
              delimiter: { type: 'string', default: ',' },
              encoding: { type: 'string', default: 'utf-8' }
            }
          }
        },
        required: ['data', 'format']
      },
      config: {
        timeout: 60000,
        retryCount: 2,
        maxFileSize: 50 * 1024 * 1024 // 50MB
      },
      isSystem: true,
      requiresAuth: true,
      maxExecutionsPerMinute: 10,
      maxExecutionsPerHour: 100
    }
  ];

  const createdTools = [];

  for (const toolData of systemTools) {
    const existingTool = await prisma.tool.findFirst({
      where: { name: toolData.name }
    });

    if (existingTool) {
      console.log(`Tool ${toolData.name} already exists, updating...`);
      
      const updatedTool = await prisma.tool.update({
        where: { id: existingTool.id },
        data: {
          displayName: toolData.displayName,
          description: toolData.description,
          category: toolData.category,
          icon: toolData.icon,
          schema: toolData.schema,
          config: toolData.config,
          isSystem: toolData.isSystem,
          isEnabled: true,
          requiresAuth: toolData.requiresAuth,
          requiresConfirmation: toolData.requiresConfirmation,
          timeoutSeconds: Math.floor(toolData.config.timeout / 1000),
          maxExecutionsPerMinute: toolData.maxExecutionsPerMinute,
          maxExecutionsPerHour: toolData.maxExecutionsPerHour,
          costPerExecutionCents: toolData.costPerExecutionCents || 0,
          tags: [toolData.category, 'system', 'built-in'],
          metadata: {
            builtIn: true,
            version: '1.0.0',
            lastUpdated: new Date().toISOString()
          }
        }
      });

      createdTools.push(updatedTool);
    } else {
      const tool = await prisma.tool.create({
        data: {
          name: toolData.name,
          displayName: toolData.displayName,
          description: toolData.description,
          category: toolData.category,
          icon: toolData.icon,
          schema: toolData.schema,
          config: toolData.config,
          isSystem: toolData.isSystem,
          isEnabled: true,
          requiresAuth: toolData.requiresAuth,
          requiresConfirmation: toolData.requiresConfirmation,
          timeoutSeconds: Math.floor(toolData.config.timeout / 1000),
          maxExecutionsPerMinute: toolData.maxExecutionsPerMinute,
          maxExecutionsPerHour: toolData.maxExecutionsPerHour,
          costPerExecutionCents: toolData.costPerExecutionCents || 0,
          version: '1.0.0',
          tags: [toolData.category, 'system', 'built-in'],
          metadata: {
            builtIn: true,
            version: '1.0.0',
            createdAt: new Date().toISOString()
          }
        }
      });

      createdTools.push(tool);
    }
  }

  // Create tool dependencies
  const dependencies = [
    {
      toolName: 'create_chart',
      dependsOn: 'python_code',
      type: 'optional'
    },
    {
      toolName: 'export_data',
      dependsOn: 'python_code',
      type: 'optional'
    }
  ];

  for (const dep of dependencies) {
    const tool = await prisma.tool.findFirst({
      where: { name: dep.toolName }
    });
    const dependencyTool = await prisma.tool.findFirst({
      where: { name: dep.dependsOn }
    });

    if (tool && dependencyTool) {
      await prisma.toolDependency.upsert({
        where: {
          toolId_dependencyToolId: {
            toolId: tool.id,
            dependencyToolId: dependencyTool.id
          }
        },
        update: {
          dependencyType: dep.type
        },
        create: {
          toolId: tool.id,
          dependencyToolId: dependencyTool.id,
          dependencyType: dep.type
        }
      });
    }
  }

  console.log(`✅ Created/updated ${createdTools.length} built-in tools`);
  console.log(`🔗 Created dependencies between related tools`);
  console.log('📊 Tools by category:');

  const categories = await prisma.tool.groupBy({
    by: ['category'],
    _count: {
      id: true
    },
    where: {
      isSystem: true
    }
  });

  for (const category of categories) {
    console.log(`   ${category.category}: ${category._count.id} tools`);
  }

  return createdTools;
}

if (require.main === module) {
  seedBuiltInTools()
    .then(() => {
      console.log('Built-in tools seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding built-in tools:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}