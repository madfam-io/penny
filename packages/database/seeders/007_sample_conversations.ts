import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

export async function seedSampleConversations() {
  console.log('💬 Seeding sample conversations...');

  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'penny' }
  });

  if (!tenant) {
    throw new Error('Default tenant not found');
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      tenantId: tenant.id,
      isDefault: true
    }
  });

  if (!workspace) {
    throw new Error('Default workspace not found');
  }

  // Get sample users (excluding admin)
  const users = await prisma.user.findMany({
    where: {
      tenantId: tenant.id,
      email: { not: 'admin@penny.ai' }
    },
    take: 8
  });

  if (users.length === 0) {
    console.log('No sample users found, skipping conversation seeding');
    return [];
  }

  // Sample conversation templates
  const conversationTemplates = [
    {
      title: 'Weekly Sales Report Analysis',
      messages: [
        {
          role: 'user',
          content: 'Can you help me analyze our weekly sales data? I need insights into our performance trends and key metrics.'
        },
        {
          role: 'assistant',
          content: "I'd be happy to help you analyze your weekly sales data! To provide you with the most relevant insights, let me gather some information.\n\nLet me start by retrieving your current KPIs.",
          toolCalls: [
            {
              name: 'get_company_kpis',
              parameters: { period: 'weekly', metrics: ['revenue', 'conversion'] }
            }
          ]
        },
        {
          role: 'tool',
          name: 'get_company_kpis',
          content: JSON.stringify({
            period: 'weekly',
            revenue: { current: 125000, previous: 118000, change: 5.9 },
            conversion: { current: 3.2, previous: 2.9, change: 10.3 },
            trends: ['upward', 'seasonal_peak']
          })
        },
        {
          role: 'assistant',
          content: "Excellent! Your weekly sales data shows strong performance:\n\n**Key Insights:**\n- Revenue increased 5.9% to $125,000\n- Conversion rate improved 10.3% to 3.2%\n- Trending upward with seasonal peak indicators\n\nLet me create a visual dashboard to better illustrate these trends.",
          toolCalls: [
            {
              name: 'load_dashboard',
              parameters: { dashboardType: 'sales', timeRange: '30d' }
            }
          ]
        }
      ]
    },
    {
      title: 'Customer Data Analysis Project',
      messages: [
        {
          role: 'user',
          content: 'I have customer data in CSV format that I need to analyze. Can you help me process it and create visualizations?'
        },
        {
          role: 'assistant',
          content: "I'd be happy to help you analyze your customer data! I can help you process CSV files and create meaningful visualizations.\n\nLet me start by setting up a Python environment for data analysis.",
          toolCalls: [
            {
              name: 'python_code',
              parameters: {
                code: `import pandas as pd\nimport matplotlib.pyplot as plt\nimport seaborn as sns\n\n# Set up the analysis environment\nprint("Data analysis environment ready!")\nprint("Available libraries: pandas, matplotlib, seaborn, numpy")\n\n# Sample data structure for demonstration\nsample_data = {\n    'customer_id': range(1, 101),\n    'age': [25 + i%40 for i in range(100)],\n    'purchase_amount': [50 + (i*10)%500 for i in range(100)],\n    'satisfaction': [3 + i%3 for i in range(100)]\n}\n\ndf_sample = pd.DataFrame(sample_data)\nprint("\\nSample data structure:")\nprint(df_sample.head())`
              }
            }
          ]
        },
        {
          role: 'user',
          content: 'Great! Can you show me the distribution of customer ages and create a correlation matrix?'
        },
        {
          role: 'assistant',
          content: "I'll create visualizations showing the age distribution and correlations in your customer data.",
          toolCalls: [
            {
              name: 'python_code',
              parameters: {
                code: `# Create age distribution visualization\nplt.figure(figsize=(12, 5))\n\nplt.subplot(1, 2, 1)\nplt.hist(df_sample['age'], bins=20, edgecolor='black', alpha=0.7)\nplt.title('Customer Age Distribution')\nplt.xlabel('Age')\nplt.ylabel('Frequency')\n\n# Create correlation matrix\nplt.subplot(1, 2, 2)\ncorr_matrix = df_sample[['age', 'purchase_amount', 'satisfaction']].corr()\nsns.heatmap(corr_matrix, annot=True, cmap='coolwarm', center=0)\nplt.title('Customer Data Correlations')\n\nplt.tight_layout()\nplt.show()\n\nprint("Correlation insights:")\nprint(f"Age vs Purchase Amount: {corr_matrix.loc['age', 'purchase_amount']:.3f}")\nprint(f"Purchase Amount vs Satisfaction: {corr_matrix.loc['purchase_amount', 'satisfaction']:.3f}")`
              }
            }
          ]
        }
      ]
    },
    {
      title: 'Team Productivity Dashboard',
      messages: [
        {
          role: 'user',
          content: 'I need to create a productivity dashboard for my team. Can you help me set this up?'
        },
        {
          role: 'assistant',
          content: "I'll help you create a comprehensive team productivity dashboard. Let me start by loading the appropriate dashboard template and gathering some operational metrics.",
          toolCalls: [
            {
              name: 'load_dashboard',
              parameters: { dashboardType: 'operations', timeRange: '30d', layout: 'grid' }
            }
          ]
        },
        {
          role: 'assistant',
          content: "Perfect! I've loaded an operations dashboard template. Now let me gather your team's key performance indicators to populate it with real data.",
          toolCalls: [
            {
              name: 'get_company_kpis',
              parameters: { period: 'monthly', metrics: ['all'] }
            }
          ]
        },
        {
          role: 'user',
          content: 'This looks great! Can you also create a chart showing task completion trends over time?'
        },
        {
          role: 'assistant',
          content: "I'll create a trend chart showing task completion patterns. This will help identify productivity patterns and bottlenecks.",
          toolCalls: [
            {
              name: 'create_chart',
              parameters: {
                type: 'line',
                data: {
                  labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                  datasets: [{
                    label: 'Tasks Completed',
                    data: [85, 92, 78, 96],
                    borderColor: '#3b82f6'
                  }]
                },
                config: {
                  title: 'Task Completion Trends',
                  xAxis: 'Time Period',
                  yAxis: 'Completed Tasks'
                }
              }
            }
          ]
        }
      ]
    },
    {
      title: 'Document Search and Analysis',
      messages: [
        {
          role: 'user',
          content: 'I need to find information about our Q3 financial performance from our document repository.'
        },
        {
          role: 'assistant',
          content: "I'll help you search through your document repository for Q3 financial performance information.",
          toolCalls: [
            {
              name: 'search_documents',
              parameters: {
                query: 'Q3 financial performance revenue profit',
                filters: {
                  fileType: ['pdf', 'docx'],
                  dateRange: {
                    from: '2024-07-01',
                    to: '2024-09-30'
                  }
                },
                limit: 10
              }
            }
          ]
        },
        {
          role: 'tool',
          name: 'search_documents',
          content: JSON.stringify({
            results: [
              {
                title: 'Q3 Financial Report 2024',
                type: 'pdf',
                relevance: 0.95,
                summary: 'Comprehensive Q3 financial analysis showing 12% revenue growth'
              },
              {
                title: 'Q3 Board Presentation',
                type: 'pptx', 
                relevance: 0.89,
                summary: 'Executive summary of Q3 performance metrics'
              }
            ],
            total: 2
          })
        },
        {
          role: 'assistant',
          content: "I found 2 highly relevant documents about your Q3 financial performance:\n\n**Q3 Financial Report 2024** (95% relevance)\n- Comprehensive analysis showing 12% revenue growth\n- Full financial breakdown and analysis\n\n**Q3 Board Presentation** (89% relevance) \n- Executive summary format\n- Key performance metrics highlighted\n\nWould you like me to extract specific metrics from these documents or help you analyze particular aspects of the Q3 performance?"
        },
        {
          role: 'user',
          content: 'Can you extract the key financial metrics and create a summary chart?'
        }
      ]
    },
    {
      title: 'Automated Email Campaign Setup',
      messages: [
        {
          role: 'user',
          content: 'I need to set up an email campaign for our product launch. Can you help me create and send the emails?'
        },
        {
          role: 'assistant',
          content: "I'd be happy to help you set up an email campaign for your product launch! This is an important communication that will reach your customers, so I want to make sure we do this right.\n\nBefore I help you send emails, could you provide:\n1. The recipient list or criteria\n2. The key message about your product launch\n3. Any specific call-to-action you want to include\n\nOnce we have the content finalized, I can help you send the campaign using our email tool."
        },
        {
          role: 'user',
          content: 'Here are the details:\n- Recipients: All customers who purchased in the last 6 months\n- Product: New AI-powered analytics dashboard\n- CTA: "Try it free for 30 days"\n- Launch date: Next Monday'
        },
        {
          role: 'assistant',
          content: "Perfect! I'll help you create a professional email campaign for your AI-powered analytics dashboard launch. Let me draft the email content and set it up for sending.\n\n**Email Campaign: AI Analytics Dashboard Launch**\n- Target: Recent customers (6 months)\n- Offer: 30-day free trial\n- Launch: Next Monday\n\nHere's a draft email structure:\n\nSubject: 🚀 Introducing Our New AI-Powered Analytics Dashboard\n\nBody:\n- Personal greeting\n- Exciting product announcement\n- Key benefits highlighting\n- Clear 30-day free trial CTA\n- Launch timeline\n\nWould you like me to proceed with sending this campaign to your customer list?"
        },
        {
          role: 'user',
          content: 'Yes, please send it to our customer list.'
        },
        {
          role: 'assistant',
          content: "I'll send the email campaign to your customer list now. This is a marketing communication that will be sent to multiple recipients.",
          toolCalls: [
            {
              name: 'send_email',
              parameters: {
                to: ['customers@example.com'],
                subject: '🚀 Introducing Our New AI-Powered Analytics Dashboard',
                body: 'Dear Valued Customer,\n\nWe\'re excited to announce the launch of our new AI-powered analytics dashboard!\n\nKey benefits:\n- Real-time insights\n- Predictive analytics\n- Easy-to-use interface\n- Custom reporting\n\nTry it free for 30 days starting next Monday!\n\nBest regards,\nThe Team',
                template: 'product_launch'
              }
            }
          ]
        }
      ]
    }
  ];

  const createdConversations = [];

  for (let i = 0; i < Math.min(conversationTemplates.length, users.length); i++) {
    const template = conversationTemplates[i];
    const user = users[i];

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        userId: user.id,
        title: template.title,
        summary: `Discussion about ${template.title.toLowerCase()}`,
        metadata: {
          tags: faker.helpers.arrayElements(['analysis', 'dashboard', 'data', 'reporting', 'automation'], 2),
          priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
          category: faker.helpers.arrayElement(['business', 'technical', 'strategic'])
        },
        isArchived: false,
        isPinned: faker.datatype.boolean({ probability: 0.2 }),
        createdAt: faker.date.recent({ days: 30 }),
        lastMessageAt: faker.date.recent({ days: 3 })
      }
    });

    // Create messages for this conversation
    let messageOrder = 0;
    for (const messageTemplate of template.messages) {
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          userId: messageTemplate.role === 'user' ? user.id : null,
          role: messageTemplate.role,
          content: messageTemplate.content,
          contentType: 'text',
          metadata: {
            messageOrder: messageOrder++,
            timestamp: new Date().toISOString()
          },
          toolCalls: messageTemplate.toolCalls || null,
          tokenCount: Math.floor(messageTemplate.content.length / 4), // Rough estimate
          model: messageTemplate.role === 'assistant' ? 'gpt-4' : null,
          provider: messageTemplate.role === 'assistant' ? 'openai' : null,
          createdAt: faker.date.recent({ days: 7 })
        }
      });

      // Add some reactions to messages occasionally
      if (faker.datatype.boolean({ probability: 0.3 })) {
        await prisma.messageReaction.create({
          data: {
            messageId: message.id,
            userId: user.id,
            emoji: faker.helpers.arrayElement(['👍', '❤️', '🎯', '💡', '🚀'])
          }
        });
      }
    }

    createdConversations.push(conversation);
  }

  // Create some additional random conversations for other users
  const remainingUsers = users.slice(conversationTemplates.length);
  
  for (const user of remainingUsers) {
    const numConversations = faker.number.int({ min: 1, max: 3 });
    
    for (let i = 0; i < numConversations; i++) {
      const topics = [
        'Data Analysis Request',
        'Tool Configuration Help',
        'Report Generation',
        'API Integration Question', 
        'Workflow Automation',
        'Performance Optimization',
        'User Management Query',
        'Billing Question',
        'Feature Request Discussion'
      ];

      const conversation = await prisma.conversation.create({
        data: {
          tenantId: tenant.id,
          workspaceId: workspace.id,
          userId: user.id,
          title: faker.helpers.arrayElement(topics),
          summary: faker.lorem.sentence(),
          metadata: {
            tags: faker.helpers.arrayElements(['help', 'question', 'support', 'feature', 'bug'], 2),
            priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
            status: faker.helpers.arrayElement(['active', 'resolved', 'pending'])
          },
          isArchived: faker.datatype.boolean({ probability: 0.1 }),
          isPinned: faker.datatype.boolean({ probability: 0.05 }),
          createdAt: faker.date.recent({ days: 60 }),
          lastMessageAt: faker.date.recent({ days: 10 })
        }
      });

      // Create a simple conversation with 2-4 messages
      const messageCount = faker.number.int({ min: 2, max: 4 });
      
      for (let msgIndex = 0; msgIndex < messageCount; msgIndex++) {
        const isUserMessage = msgIndex % 2 === 0;
        
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            userId: isUserMessage ? user.id : null,
            role: isUserMessage ? 'user' : 'assistant',
            content: isUserMessage 
              ? faker.lorem.sentences(faker.number.int({ min: 1, max: 3 }))
              : faker.lorem.sentences(faker.number.int({ min: 2, max: 5 })),
            contentType: 'text',
            metadata: {
              messageOrder: msgIndex
            },
            tokenCount: faker.number.int({ min: 50, max: 500 }),
            model: isUserMessage ? null : faker.helpers.arrayElement(['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet']),
            provider: isUserMessage ? null : faker.helpers.arrayElement(['openai', 'anthropic']),
            createdAt: faker.date.recent({ days: 30 })
          }
        });
      }

      createdConversations.push(conversation);
    }
  }

  // Create some conversation memory entries for context
  const sampleConversations = createdConversations.slice(0, 5);
  
  for (const conversation of sampleConversations) {
    const memoryEntries = [
      {
        key: 'user_preferences',
        value: JSON.stringify({
          preferredChartType: 'bar',
          dataFormat: 'json',
          timezone: 'UTC'
        })
      },
      {
        key: 'project_context',
        value: `Working on ${conversation.title} - Key focus areas: data analysis, reporting, automation`
      },
      {
        key: 'last_action',
        value: 'Generated dashboard with sales metrics'
      }
    ];

    for (const entry of memoryEntries) {
      await prisma.conversationMemory.create({
        data: {
          conversationId: conversation.id,
          key: entry.key,
          value: entry.value,
          metadata: {
            type: 'user_preference',
            confidence: 0.8,
            source: 'conversation'
          },
          importanceScore: faker.number.float({ min: 0.1, max: 1.0, precision: 0.1 })
        }
      });
    }
  }

  console.log(`✅ Created ${createdConversations.length} sample conversations`);
  console.log(`💬 Created detailed conversations with tools: ${conversationTemplates.length}`);
  console.log(`🎲 Created random conversations: ${createdConversations.length - conversationTemplates.length}`);
  console.log(`🧠 Added memory entries for ${sampleConversations.length} conversations`);

  return createdConversations;
}

if (require.main === module) {
  seedSampleConversations()
    .then(() => {
      console.log('Sample conversations seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding sample conversations:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}