import { defineConfig } from 'cypress';
import codeCoverageTask from '@cypress/code-coverage/task';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // Code coverage setup
      codeCoverageTask(on, config);
      
      // Terminal output for better debugging
      require('cypress-terminal-report/src/installLogsPrinter')(on);

      // Custom tasks for test utilities
      on('task', {
        // Database utilities
        'db:reset': async () => {
          const { PrismaClient } = require('@prisma/client');
          const prisma = new PrismaClient({
            datasources: {
              db: { url: process.env.DATABASE_URL_TEST },
            },
          });

          // Clean database
          await prisma.$transaction([
            prisma.execution.deleteMany(),
            prisma.artifact.deleteMany(),
            prisma.message.deleteMany(),
            prisma.conversation.deleteMany(),
            prisma.auditLog.deleteMany(),
            prisma.session.deleteMany(),
            prisma.user.deleteMany(),
            prisma.tenant.deleteMany(),
          ]);

          await prisma.$disconnect();
          return null;
        },

        'db:seed': async () => {
          const { PrismaClient } = require('@prisma/client');
          const bcrypt = require('bcrypt');
          const prisma = new PrismaClient({
            datasources: {
              db: { url: process.env.DATABASE_URL_TEST },
            },
          });

          // Create test tenant
          const tenant = await prisma.tenant.create({
            data: {
              id: 'test-tenant',
              name: 'Test Company',
              slug: 'test-company',
              settings: {
                features: {
                  pythonSandbox: true,
                  jiraIntegration: true,
                },
                limits: {
                  maxUsers: 100,
                  maxConversations: 1000,
                },
              },
            },
          });

          // Create test users
          const passwordHash = await bcrypt.hash('password123', 12);
          await prisma.user.createMany({
            data: [
              {
                id: 'test-user',
                tenantId: tenant.id,
                email: 'test@example.com',
                name: 'Test User',
                passwordHash,
                role: 'CREATOR',
                isActive: true,
              },
              {
                id: 'admin-user',
                tenantId: tenant.id,
                email: 'admin@example.com',
                name: 'Admin User',
                passwordHash,
                role: 'ADMIN',
                isActive: true,
              },
            ],
          });

          await prisma.$disconnect();
          return null;
        },

        'db:createUser': async ({ email, password, name, role = 'CREATOR' }: any) => {
          const { PrismaClient } = require('@prisma/client');
          const bcrypt = require('bcrypt');
          const prisma = new PrismaClient({
            datasources: {
              db: { url: process.env.DATABASE_URL_TEST },
            },
          });

          const tenant = await prisma.tenant.findFirst();
          const passwordHash = await bcrypt.hash(password, 12);

          const user = await prisma.user.create({
            data: {
              tenantId: tenant.id,
              email,
              name,
              passwordHash,
              role,
              isActive: true,
            },
          });

          await prisma.$disconnect();
          return user;
        },

        'db:createConversation': async ({ userId, title, messages = [] }: any) => {
          const { PrismaClient } = require('@prisma/client');
          const prisma = new PrismaClient({
            datasources: {
              db: { url: process.env.DATABASE_URL_TEST },
            },
          });

          const user = await prisma.user.findFirst({
            where: { email: userId },
          });

          const conversation = await prisma.conversation.create({
            data: {
              tenantId: user.tenantId,
              userId: user.id,
              title,
            },
          });

          // Create messages if provided
          if (messages.length > 0) {
            await prisma.message.createMany({
              data: messages.map((msg: any, index: number) => ({
                conversationId: conversation.id,
                userId: msg.role === 'user' ? user.id : null,
                role: msg.role,
                content: msg.content,
                createdAt: new Date(Date.now() + index * 1000),
              })),
            });
          }

          await prisma.$disconnect();
          return conversation;
        },

        'db:createLargeConversation': async ({ userId, messageCount }: any) => {
          const { PrismaClient } = require('@prisma/client');
          const prisma = new PrismaClient({
            datasources: {
              db: { url: process.env.DATABASE_URL_TEST },
            },
          });

          const user = await prisma.user.findFirst({
            where: { email: userId },
          });

          const conversation = await prisma.conversation.create({
            data: {
              tenantId: user.tenantId,
              userId: user.id,
              title: 'Large Conversation',
            },
          });

          // Create messages in batches
          const batchSize = 100;
          for (let i = 0; i < messageCount; i += batchSize) {
            const batch = [];
            const remaining = Math.min(batchSize, messageCount - i);
            
            for (let j = 0; j < remaining; j++) {
              const messageIndex = i + j;
              batch.push({
                conversationId: conversation.id,
                userId: messageIndex % 2 === 0 ? user.id : null,
                role: messageIndex % 2 === 0 ? 'user' : 'assistant',
                content: `Message ${messageIndex + 1} - Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
                createdAt: new Date(Date.now() + messageIndex * 1000),
              });
            }

            await prisma.message.createMany({ data: batch });
          }

          await prisma.$disconnect();
          return conversation;
        },

        'db:createTenant': async ({ name, users = [] }: any) => {
          const { PrismaClient } = require('@prisma/client');
          const bcrypt = require('bcrypt');
          const prisma = new PrismaClient({
            datasources: {
              db: { url: process.env.DATABASE_URL_TEST },
            },
          });

          const tenant = await prisma.tenant.create({
            data: {
              name,
              slug: name.toLowerCase().replace(/\s+/g, '-'),
              settings: {
                features: { pythonSandbox: true },
                limits: { maxUsers: 50 },
              },
            },
          });

          // Create users for tenant
          for (const userData of users) {
            const passwordHash = await bcrypt.hash('password123', 12);
            await prisma.user.create({
              data: {
                tenantId: tenant.id,
                email: userData.email,
                name: userData.name,
                role: userData.role || 'CREATOR',
                passwordHash,
                isActive: true,
              },
            });
          }

          await prisma.$disconnect();
          return tenant;
        },

        'db:createAdmin': async ({ email, name }: any) => {
          const { PrismaClient } = require('@prisma/client');
          const bcrypt = require('bcrypt');
          const prisma = new PrismaClient({
            datasources: {
              db: { url: process.env.DATABASE_URL_TEST },
            },
          });

          const tenant = await prisma.tenant.findFirst();
          const passwordHash = await bcrypt.hash('admin123', 12);

          const admin = await prisma.user.create({
            data: {
              tenantId: tenant.id,
              email,
              name,
              role: 'ADMIN',
              passwordHash,
              isActive: true,
            },
          });

          await prisma.$disconnect();
          return admin;
        },

        // Auth utilities
        'auth:createSession': async ({ email }: any) => {
          // Mock session creation for testing
          const jwt = require('jsonwebtoken');
          const token = jwt.sign(
            { email, userId: 'test-user', tenantId: 'test-tenant' },
            'test-jwt-secret',
            { expiresIn: '1h' }
          );
          
          // Set token in test environment
          global.testAuthToken = token;
          return token;
        },

        'auth:expireToken': async () => {
          global.testAuthToken = null;
          return null;
        },

        // WebSocket simulation
        'websocket:simulateUserJoin': async ({ userId, conversationId }: any) => {
          // Simulate WebSocket events for testing
          return { event: 'user_joined', userId, conversationId };
        },

        'websocket:simulateTyping': async ({ userId, conversationId }: any) => {
          return { event: 'typing_start', userId, conversationId };
        },

        // Utility tasks
        'log': (message) => {
          console.log(message);
          return null;
        },

        'wait': async (ms) => {
          await new Promise(resolve => setTimeout(resolve, ms));
          return null;
        },
      });

      // Environment configuration
      config.env = {
        ...config.env,
        coverage: true,
        codeCoverage: {
          url: 'http://localhost:3000/__coverage__',
        },
      };

      return config;
    },

    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    chromeWebSecurity: false,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    
    // Test files
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    
    // Experimental features
    experimentalStudio: true,
    experimentalMemoryManagement: true,
  },

  component: {
    setupNodeEvents(on, config) {
      codeCoverageTask(on, config);
      return config;
    },
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: 'apps/web/src/**/*.cy.{js,jsx,ts,tsx}',
  },

  // Global configuration
  retries: {
    runMode: 2,
    openMode: 0,
  },
  
  env: {
    coverage: true,
  },
});