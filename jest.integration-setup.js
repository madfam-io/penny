// Integration test setup - for tests that need real database connections
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Test database setup
let testDatabase = null;

beforeAll(async () => {
  // Create test database if it doesn't exist
  try {
    await execAsync('createdb penny_test', { env: { ...process.env, PGPASSWORD: 'test' } });
  } catch (error) {
    // Database might already exist
    console.log('Test database already exists or failed to create:', error.message);
  }

  // Run migrations on test database
  try {
    await execAsync('npm run db:migrate', {
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://test:test@localhost:5432/penny_test',
      },
    });
  } catch (error) {
    console.warn('Failed to run migrations on test database:', error.message);
  }
});

beforeEach(async () => {
  // Clean test database before each test
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://test:test@localhost:5432/penny_test',
      },
    },
  });

  try {
    // Clean all tables in reverse order to handle foreign key constraints
    await prisma.auditLog.deleteMany({});
    await prisma.usage.deleteMany({});
    await prisma.usageMetric.deleteMany({});
    await prisma.webhook.deleteMany({});
    await prisma.apiKey.deleteMany({});
    await prisma.toolExecution.deleteMany({});
    await prisma.artifact.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.userRole.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.workspace.deleteMany({});
    await prisma.tenant.deleteMany({});
    await prisma.role.deleteMany({});

    // Insert basic test data
    await prisma.role.createMany({
      data: [
        { name: 'admin', description: 'Administrator', permissions: ['*'], isSystem: true },
        { name: 'user', description: 'Regular user', permissions: ['conversations:*'], isSystem: true },
      ],
    });

    await prisma.tenant.create({
      data: {
        id: 'test-tenant-id',
        name: 'Test Tenant',
        slug: 'test-tenant',
        settings: {},
        features: {},
        limits: {},
      },
    });

    await prisma.user.create({
      data: {
        id: 'test-user-id',
        tenantId: 'test-tenant-id',
        email: 'test@example.com',
        name: 'Test User',
        preferences: {},
      },
    });
  } catch (error) {
    console.warn('Failed to clean test database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
});

afterAll(async () => {
  // Clean up test database connection
  if (testDatabase) {
    await testDatabase.$disconnect();
  }
});

// Helper function to get test database client
global.getTestDatabase = () => {
  const { PrismaClient } = require('@prisma/client');
  if (!testDatabase) {
    testDatabase = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://test:test@localhost:5432/penny_test',
        },
      },
    });
  }
  return testDatabase;
};

// Test data helpers
global.testData = {
  tenant: {
    id: 'test-tenant-id',
    name: 'Test Tenant',
    slug: 'test-tenant',
  },
  user: {
    id: 'test-user-id',
    tenantId: 'test-tenant-id',
    email: 'test@example.com',
    name: 'Test User',
  },
  adminUser: {
    id: 'test-admin-id',
    tenantId: 'test-tenant-id',
    email: 'admin@example.com',
    name: 'Test Admin',
  },
};