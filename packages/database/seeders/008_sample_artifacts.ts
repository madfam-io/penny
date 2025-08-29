import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

export async function seedSampleArtifacts() {
  console.log('🎨 Seeding sample artifacts...');

  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'penny' }
  });

  if (!tenant) {
    throw new Error('Default tenant not found');
  }

  // Get sample users and conversations
  const users = await prisma.user.findMany({
    where: {
      tenantId: tenant.id,
      status: 'active'
    },
    take: 10
  });

  const conversations = await prisma.conversation.findMany({
    where: {
      tenantId: tenant.id
    },
    include: {
      messages: true
    },
    take: 15
  });

  if (users.length === 0) {
    console.log('No users found, skipping artifact seeding');
    return [];
  }

  // Sample artifact templates
  const artifactTemplates = [
    {
      type: 'chart',
      name: 'Q3 Revenue Analysis',
      description: 'Interactive chart showing quarterly revenue breakdown by department',
      mimeType: 'application/json',
      content: {
        type: 'bar',
        data: {
          labels: ['Sales', 'Marketing', 'Product', 'Support'],
          datasets: [{
            label: 'Q3 Revenue',
            data: [125000, 85000, 145000, 65000],
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Q3 2024 Revenue by Department'
            }
          }
        }
      },
      tags: ['revenue', 'quarterly', 'departments', 'analysis']
    },
    {
      type: 'dashboard',
      name: 'Customer Analytics Dashboard', 
      description: 'Comprehensive dashboard showing customer metrics and KPIs',
      mimeType: 'text/html',
      contentText: `
        <div class="dashboard">
          <h1>Customer Analytics Dashboard</h1>
          <div class="metrics-grid">
            <div class="metric-card">
              <h3>Total Customers</h3>
              <div class="metric-value">2,847</div>
              <div class="metric-change">+12.5%</div>
            </div>
            <div class="metric-card">
              <h3>Active Users</h3>
              <div class="metric-value">1,923</div>
              <div class="metric-change">+8.3%</div>
            </div>
            <div class="metric-card">
              <h3>Avg. Session</h3>
              <div class="metric-value">4m 32s</div>
              <div class="metric-change">-2.1%</div>
            </div>
          </div>
        </div>
      `,
      tags: ['dashboard', 'customers', 'analytics', 'kpis']
    },
    {
      type: 'code',
      name: 'Data Processing Script',
      description: 'Python script for processing customer data and generating reports',
      mimeType: 'text/x-python',
      contentText: `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def process_customer_data(filepath):
    """
    Process customer data and generate insights
    """
    # Load data
    df = pd.read_csv(filepath)
    
    # Clean data
    df = df.dropna()
    df['date'] = pd.to_datetime(df['date'])
    
    # Calculate metrics
    monthly_revenue = df.groupby(df['date'].dt.to_period('M'))['revenue'].sum()
    customer_segments = df.groupby('segment')['customer_id'].nunique()
    
    # Generate visualizations
    plt.figure(figsize=(12, 6))
    
    plt.subplot(1, 2, 1)
    monthly_revenue.plot(kind='line')
    plt.title('Monthly Revenue Trend')
    plt.ylabel('Revenue ($)')
    
    plt.subplot(1, 2, 2)
    customer_segments.plot(kind='bar')
    plt.title('Customers by Segment')
    plt.ylabel('Number of Customers')
    
    plt.tight_layout()
    plt.show()
    
    return {
        'total_revenue': df['revenue'].sum(),
        'total_customers': df['customer_id'].nunique(),
        'avg_order_value': df['revenue'].mean()
    }

# Example usage
if __name__ == "__main__":
    results = process_customer_data('customer_data.csv')
    print("Analysis Results:", results)
`,
      tags: ['python', 'data-processing', 'analytics', 'script']
    },
    {
      type: 'document',
      name: 'Product Requirements Document',
      description: 'Detailed requirements for the new AI chat feature',
      mimeType: 'text/markdown',
      contentText: `# AI Chat Feature - Product Requirements Document

## Overview
This document outlines the requirements for implementing an AI-powered chat feature in our platform.

## Objectives
- Provide intelligent conversational interface
- Support multiple AI models
- Enable tool integration
- Ensure scalability and security

## User Stories

### As a user, I want to:
1. Start a conversation with an AI assistant
2. Switch between different AI models
3. Use tools within conversations
4. Save and share conversations
5. Access conversation history

## Technical Requirements

### Functional Requirements
- Real-time message streaming
- Tool execution capabilities
- Multi-model support (GPT-4, Claude, etc.)
- Conversation persistence
- User authentication and authorization

### Non-Functional Requirements
- Response time < 2 seconds (p95)
- 99.9% uptime
- Support for 1000+ concurrent users
- GDPR compliance
- SOC 2 Type II compliance

## Implementation Plan

### Phase 1: Core Chat (4 weeks)
- [ ] Basic chat interface
- [ ] Message persistence
- [ ] Single model integration

### Phase 2: Advanced Features (6 weeks)
- [ ] Multi-model support
- [ ] Tool integration
- [ ] Real-time streaming

### Phase 3: Scale & Polish (4 weeks)
- [ ] Performance optimization
- [ ] Advanced UI features
- [ ] Analytics integration

## Success Metrics
- User engagement: 80% weekly active users
- Response quality: 4.5+ star rating
- Performance: <2s response time
- Adoption: 60% feature usage within 30 days

## Risks & Mitigation
1. **API Rate Limits**: Implement intelligent rate limiting and fallback models
2. **Model Costs**: Monitor usage and implement cost controls
3. **Security**: End-to-end encryption and audit logging
`,
      tags: ['requirements', 'product', 'ai-chat', 'documentation']
    },
    {
      type: 'data',
      name: 'Sales Performance Dataset',
      description: 'Monthly sales data with performance metrics and trends',
      mimeType: 'application/json',
      content: {
        metadata: {
          title: 'Sales Performance Q3 2024',
          source: 'CRM System',
          generated: '2024-10-01',
          records: 150
        },
        summary: {
          totalRevenue: 3250000,
          totalOrders: 1284,
          avgOrderValue: 2531.09,
          topRegion: 'North America',
          growthRate: 18.5
        },
        data: Array.from({ length: 12 }, (_, i) => ({
          month: new Date(2024, i, 1).toISOString().slice(0, 7),
          revenue: faker.number.int({ min: 200000, max: 350000 }),
          orders: faker.number.int({ min: 80, max: 150 }),
          newCustomers: faker.number.int({ min: 25, max: 60 }),
          regions: {
            'North America': faker.number.int({ min: 100000, max: 180000 }),
            'Europe': faker.number.int({ min: 60000, max: 120000 }),
            'Asia Pacific': faker.number.int({ min: 40000, max: 80000 })
          }
        }))
      },
      tags: ['sales', 'performance', 'data', 'quarterly']
    },
    {
      type: 'image',
      name: 'Architecture Diagram',
      description: 'System architecture overview showing microservices and data flow',
      mimeType: 'image/svg+xml',
      contentText: `
        <svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
          <rect x="50" y="50" width="150" height="80" fill="#3b82f6" rx="10"/>
          <text x="125" y="95" text-anchor="middle" fill="white" font-family="Arial" font-size="14">Web Client</text>
          
          <rect x="300" y="50" width="150" height="80" fill="#10b981" rx="10"/>
          <text x="375" y="95" text-anchor="middle" fill="white" font-family="Arial" font-size="14">API Gateway</text>
          
          <rect x="550" y="50" width="150" height="80" fill="#f59e0b" rx="10"/>
          <text x="625" y="95" text-anchor="middle" fill="white" font-family="Arial" font-size="14">Load Balancer</text>
          
          <!-- Arrows -->
          <line x1="200" y1="90" x2="300" y2="90" stroke="#666" stroke-width="2"/>
          <line x1="450" y1="90" x2="550" y2="90" stroke="#666" stroke-width="2"/>
          
          <!-- Services Layer -->
          <rect x="150" y="200" width="120" height="60" fill="#8b5cf6" rx="8"/>
          <text x="210" y="235" text-anchor="middle" fill="white" font-family="Arial" font-size="12">Chat Service</text>
          
          <rect x="300" y="200" width="120" height="60" fill="#8b5cf6" rx="8"/>
          <text x="360" y="235" text-anchor="middle" fill="white" font-family="Arial" font-size="12">Tool Service</text>
          
          <rect x="450" y="200" width="120" height="60" fill="#8b5cf6" rx="8"/>
          <text x="510" y="235" text-anchor="middle" fill="white" font-family="Arial" font-size="12">Auth Service</text>
          
          <!-- Database -->
          <rect x="300" y="350" width="150" height="80" fill="#ef4444" rx="10"/>
          <text x="375" y="395" text-anchor="middle" fill="white" font-family="Arial" font-size="14">PostgreSQL</text>
          
          <!-- Connections -->
          <line x1="375" y1="130" x2="210" y2="200" stroke="#666" stroke-width="1"/>
          <line x1="375" y1="130" x2="360" y2="200" stroke="#666" stroke-width="1"/>
          <line x1="375" y1="130" x2="510" y2="200" stroke="#666" stroke-width="1"/>
          
          <line x1="210" y1="260" x2="350" y2="350" stroke="#666" stroke-width="1"/>
          <line x1="360" y1="260" x2="375" y2="350" stroke="#666" stroke-width="1"/>
          <line x1="510" y1="260" x2="400" y2="350" stroke="#666" stroke-width="1"/>
        </svg>
      `,
      tags: ['architecture', 'diagram', 'system-design', 'microservices']
    }
  ];

  const createdArtifacts = [];

  // Create artifacts based on templates
  for (const template of artifactTemplates) {
    const user = faker.helpers.arrayElement(users);
    const conversation = faker.helpers.arrayElement(conversations);
    const message = conversation.messages.length > 0 
      ? faker.helpers.arrayElement(conversation.messages)
      : null;

    const artifact = await prisma.artifact.create({
      data: {
        tenantId: tenant.id,
        conversationId: conversation.id,
        messageId: message?.id,
        userId: user.id,
        type: template.type as any,
        mimeType: template.mimeType,
        name: template.name,
        description: template.description,
        content: template.content || null,
        contentText: template.contentText || null,
        sizeBytes: template.contentText 
          ? Buffer.byteLength(template.contentText, 'utf8')
          : template.content 
            ? Buffer.byteLength(JSON.stringify(template.content), 'utf8')
            : 0,
        tags: template.tags,
        isPublic: faker.datatype.boolean({ probability: 0.3 }),
        isFeatured: faker.datatype.boolean({ probability: 0.1 }),
        viewCount: faker.number.int({ min: 0, max: 150 }),
        downloadCount: faker.number.int({ min: 0, max: 50 }),
        processingStatus: 'completed',
        metadata: {
          created_by: user.name,
          conversation_title: conversation.title,
          category: template.type,
          complexity: faker.helpers.arrayElement(['simple', 'medium', 'complex']),
          version: '1.0.0'
        },
        renderConfig: {
          theme: faker.helpers.arrayElement(['light', 'dark', 'auto']),
          showLineNumbers: template.type === 'code',
          enableInteraction: template.type === 'chart'
        },
        exportFormats: getExportFormats(template.type),
        createdAt: faker.date.recent({ days: 45 }),
        processedAt: faker.date.recent({ days: 40 })
      }
    });

    createdArtifacts.push(artifact);
  }

  // Create additional random artifacts
  const additionalArtifactCount = 25;
  
  for (let i = 0; i < additionalArtifactCount; i++) {
    const user = faker.helpers.arrayElement(users);
    const conversation = faker.datatype.boolean({ probability: 0.8 }) 
      ? faker.helpers.arrayElement(conversations)
      : null;
    
    const artifactType = faker.helpers.arrayElement(['text', 'markdown', 'chart', 'image', 'document', 'code', 'data']);
    const name = generateArtifactName(artifactType);
    
    const artifact = await prisma.artifact.create({
      data: {
        tenantId: tenant.id,
        conversationId: conversation?.id,
        userId: user.id,
        type: artifactType as any,
        mimeType: getMimeType(artifactType),
        name: name,
        description: faker.lorem.sentence(),
        contentText: generateSampleContent(artifactType),
        sizeBytes: faker.number.int({ min: 1024, max: 1024 * 1024 }), // 1KB - 1MB
        tags: generateTags(artifactType),
        isPublic: faker.datatype.boolean({ probability: 0.2 }),
        isFeatured: faker.datatype.boolean({ probability: 0.05 }),
        viewCount: faker.number.int({ min: 0, max: 100 }),
        downloadCount: faker.number.int({ min: 0, max: 25 }),
        processingStatus: faker.helpers.weightedArrayElement([
          { weight: 0.9, value: 'completed' },
          { weight: 0.08, value: 'processing' },
          { weight: 0.02, value: 'failed' }
        ]),
        metadata: {
          created_by: user.name,
          category: artifactType,
          auto_generated: true,
          quality_score: faker.number.float({ min: 0.1, max: 1.0, precision: 0.1 })
        },
        renderConfig: {
          theme: faker.helpers.arrayElement(['light', 'dark', 'auto'])
        },
        exportFormats: getExportFormats(artifactType),
        createdAt: faker.date.recent({ days: 90 }),
        processedAt: faker.date.recent({ days: 85 })
      }
    });

    createdArtifacts.push(artifact);
  }

  // Create artifact collections
  const collections = [
    {
      name: 'Q3 2024 Reports',
      description: 'Collection of all Q3 quarterly reports and analyses',
      slug: 'q3-2024-reports'
    },
    {
      name: 'Code Templates',
      description: 'Reusable code templates and snippets',
      slug: 'code-templates'
    },
    {
      name: 'Dashboard Gallery',
      description: 'Showcase of interactive dashboards and visualizations',
      slug: 'dashboard-gallery'
    }
  ];

  const createdCollections = [];

  for (const collectionData of collections) {
    const user = faker.helpers.arrayElement(users);
    
    const collection = await prisma.artifactCollection.create({
      data: {
        tenantId: tenant.id,
        name: collectionData.name,
        description: collectionData.description,
        slug: collectionData.slug,
        isPublic: faker.datatype.boolean({ probability: 0.6 }),
        settings: {
          allowContributions: faker.datatype.boolean(),
          moderateSubmissions: true,
          featuredOrder: 'recent'
        },
        createdBy: user.id
      }
    });

    // Add 3-8 artifacts to each collection
    const collectionArtifacts = faker.helpers.arrayElements(
      createdArtifacts, 
      faker.number.int({ min: 3, max: 8 })
    );

    for (let i = 0; i < collectionArtifacts.length; i++) {
      await prisma.artifactCollectionItem.create({
        data: {
          collectionId: collection.id,
          artifactId: collectionArtifacts[i].id,
          position: i,
          addedBy: user.id
        }
      });
    }

    createdCollections.push(collection);
  }

  // Create some artifact comments
  const featuredArtifacts = createdArtifacts.slice(0, 10);
  
  for (const artifact of featuredArtifacts) {
    const commentCount = faker.number.int({ min: 0, max: 5 });
    
    for (let i = 0; i < commentCount; i++) {
      const commenter = faker.helpers.arrayElement(users);
      
      await prisma.artifactComment.create({
        data: {
          artifactId: artifact.id,
          userId: commenter.id,
          content: faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
          metadata: {
            sentiment: faker.helpers.arrayElement(['positive', 'neutral', 'negative']),
            helpful: faker.datatype.boolean({ probability: 0.7 })
          },
          isResolved: faker.datatype.boolean({ probability: 0.3 }),
          createdAt: faker.date.recent({ days: 20 })
        }
      });
    }
  }

  // Create artifact relationships
  const relationshipTypes = ['references', 'depends_on', 'derived_from', 'similar_to'];
  
  for (let i = 0; i < 15; i++) {
    const sourceArtifact = faker.helpers.arrayElement(createdArtifacts);
    const targetArtifact = faker.helpers.arrayElement(
      createdArtifacts.filter(a => a.id !== sourceArtifact.id)
    );
    
    try {
      await prisma.artifactRelationship.create({
        data: {
          sourceArtifactId: sourceArtifact.id,
          targetArtifactId: targetArtifact.id,
          relationshipType: faker.helpers.arrayElement(relationshipTypes),
          metadata: {
            confidence: faker.number.float({ min: 0.5, max: 1.0, precision: 0.1 }),
            auto_detected: faker.datatype.boolean({ probability: 0.4 })
          },
          createdBy: faker.helpers.arrayElement(users).id
        }
      });
    } catch (error) {
      // Skip if relationship already exists
    }
  }

  console.log(`✅ Created ${createdArtifacts.length} sample artifacts`);
  console.log(`📚 Created ${createdCollections.length} artifact collections`);
  console.log('🎨 Artifacts by type:');

  const typeStats = await prisma.artifact.groupBy({
    by: ['type'],
    _count: {
      id: true
    },
    where: {
      tenantId: tenant.id
    }
  });

  for (const stat of typeStats) {
    console.log(`   ${stat.type}: ${stat._count.id} artifacts`);
  }

  return createdArtifacts;
}

// Helper functions
function getExportFormats(type: string): string[] {
  switch (type) {
    case 'chart':
      return ['png', 'svg', 'pdf', 'json'];
    case 'code':
      return ['txt', 'zip'];
    case 'data':
      return ['json', 'csv', 'xlsx'];
    case 'document':
      return ['pdf', 'docx', 'html'];
    default:
      return ['json', 'txt'];
  }
}

function getMimeType(type: string): string {
  switch (type) {
    case 'chart':
      return 'application/json';
    case 'code':
      return 'text/plain';
    case 'data':
      return 'application/json';
    case 'document':
      return 'text/markdown';
    case 'image':
      return 'image/png';
    default:
      return 'text/plain';
  }
}

function generateArtifactName(type: string): string {
  const prefixes = {
    chart: ['Sales Chart', 'Performance Graph', 'Analytics Dashboard', 'Trend Analysis'],
    code: ['Data Processor', 'API Client', 'Automation Script', 'Helper Functions'],
    document: ['Project Plan', 'Requirements Doc', 'User Guide', 'Technical Spec'],
    data: ['Customer Data', 'Sales Report', 'Analytics Dataset', 'Performance Metrics'],
    image: ['System Diagram', 'Workflow Chart', 'Architecture Overview', 'Process Flow']
  };

  const typePrefix = prefixes[type as keyof typeof prefixes] || ['Generated Content'];
  return faker.helpers.arrayElement(typePrefix) + ' ' + faker.string.alphanumeric(4);
}

function generateSampleContent(type: string): string {
  switch (type) {
    case 'code':
      return `# ${faker.lorem.sentence()}
def process_data(input_data):
    """${faker.lorem.sentence()}"""
    result = []
    for item in input_data:
        processed = item * 2 + 1
        result.append(processed)
    return result`;
    
    case 'document':
      return `# ${faker.lorem.words(3)}

${faker.lorem.paragraphs(3, '\n\n')}

## Key Points
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}`;
    
    case 'data':
      return JSON.stringify({
        summary: faker.lorem.sentence(),
        data: Array.from({ length: 5 }, () => ({
          id: faker.string.uuid(),
          value: faker.number.int({ min: 1, max: 100 }),
          label: faker.lorem.word()
        }))
      });
    
    default:
      return faker.lorem.paragraphs(2);
  }
}

function generateTags(type: string): string[] {
  const baseTags = ['sample', 'generated'];
  const typeTags = {
    chart: ['visualization', 'analytics', 'data'],
    code: ['script', 'automation', 'development'],
    document: ['documentation', 'reference', 'guide'],
    data: ['dataset', 'analysis', 'metrics'],
    image: ['diagram', 'visual', 'design']
  };

  return [...baseTags, ...(typeTags[type as keyof typeof typeTags] || [])];
}

if (require.main === module) {
  seedSampleArtifacts()
    .then(() => {
      console.log('Sample artifacts seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding sample artifacts:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}