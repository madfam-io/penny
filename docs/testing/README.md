# PENNY Platform - Testing Documentation

This document provides comprehensive information about testing in the PENNY platform, including setup, execution, coverage reporting, and best practices.

## Overview

The PENNY platform uses a multi-layered testing strategy to ensure high quality, reliability, and security:

- **Unit Tests**: Individual component and function testing
- **Integration Tests**: API endpoints, database operations, and service interactions
- **End-to-End Tests**: Complete user workflows and system behavior
- **Security Tests**: Authentication, authorization, and sandbox isolation
- **Performance Tests**: Load testing and response time validation

## Test Architecture

### Test Categories

1. **Unit Tests** (`.test.ts` files)
   - Component logic testing
   - Utility function validation
   - Business rule verification
   - Isolated unit behavior

2. **Integration Tests** (`.integration.test.ts` files)
   - API endpoint testing with real database
   - Service-to-service communication
   - Tool execution and sandbox security
   - WebSocket functionality
   - Authentication flows

3. **E2E Tests** (`cypress/e2e/*.cy.ts` files)
   - Complete user journeys
   - Cross-browser compatibility
   - Real-world scenario validation
   - Performance monitoring

### Coverage Targets

| Component | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| **Global** | 80% | 85% | 75% | 80% |
| API Services | 85% | 90% | 80% | 85% |
| Security & Auth | 90% | 95% | 85% | 90% |
| Database Layer | 90% | 90% | 85% | 90% |
| Sandbox (Critical) | 95% | 95% | 90% | 95% |
| Frontend Components | 75% | 80% | 70% | 75% |

## Running Tests

### Quick Start

```bash
# Install dependencies
npm install

# Run all tests with coverage
npm run test:all

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only  
npm run test:e2e           # End-to-end tests only

# Watch mode for development
npm run test:watch
```

### Environment Setup

#### Unit & Integration Tests

```bash
# Copy environment template
cp .env.example .env.test

# Set test database URL
echo "DATABASE_URL=postgresql://postgres:password@localhost:5432/penny_test" >> .env.test
echo "REDIS_URL=redis://localhost:6379" >> .env.test

# Run database migrations
npm run db:migrate:test

# Seed test data
npm run db:seed:test
```

#### E2E Tests

```bash
# Start application in test mode
npm run start:test

# Run E2E tests (in separate terminal)
npm run test:e2e

# Open Cypress Test Runner
npm run test:e2e:open
```

### CI/CD Testing

The platform includes comprehensive CI/CD testing workflows:

```bash
# GitHub Actions workflows automatically run:
.github/workflows/test-coverage.yml    # Full test suite with coverage
.github/workflows/security-tests.yml   # Security and vulnerability tests
.github/workflows/performance.yml      # Performance and load tests
```

## Test Coverage

### Generating Coverage Reports

```bash
# Generate HTML coverage report
npm run test:coverage

# Generate and merge all coverage types
npm run coverage:report

# Check coverage thresholds
npm run coverage:check

# Generate coverage badge
npm run coverage:badge

# Clean coverage data
npm run coverage:clean
```

### Coverage Reports Location

- **HTML Report**: `coverage/html/index.html`
- **LCOV Report**: `coverage/lcov.info`
- **JSON Summary**: `coverage/coverage-summary.json`
- **Badge Info**: `coverage/badge.json`

### Coverage Integration

- **Codecov**: Automatic upload in CI/CD
- **PR Comments**: Coverage diff reports
- **Badge Generation**: README badge updates
- **Threshold Enforcement**: Build fails if coverage drops

## Test Files Overview

### Unit Tests

```
apps/api/src/__tests__/
├── auth.test.ts                 # Authentication utilities
├── tools.test.ts                # Tool registry and validation
├── utils.test.ts                # Helper functions
└── services/
    ├── conversation.test.ts     # Conversation service logic
    ├── artifact.test.ts         # Artifact management
    └── security.test.ts         # Security utilities

packages/*/src/__tests__/
├── database.test.ts             # Database operations
├── security.test.ts             # Security functions
└── utils.test.ts                # Shared utilities
```

### Integration Tests

```
apps/api/src/__tests__/
├── auth.integration.test.ts     # Authentication flows
├── conversations.integration.test.ts  # Conversation CRUD
├── tools.integration.test.ts    # Tool execution & sandbox
├── artifacts.integration.test.ts     # Artifact management
└── admin.integration.test.ts    # Admin dashboard

apps/ws/src/__tests__/
└── websocket.integration.test.ts     # Real-time features

packages/database/src/__tests__/
└── database.integration.test.ts      # Database integrity
```

### E2E Tests

```
cypress/e2e/
├── user-journey.cy.ts           # Complete user workflows
├── authentication.cy.ts         # Login/logout flows  
├── conversation-flows.cy.ts     # Chat and tool usage
├── artifact-management.cy.ts    # Artifact creation/editing
├── admin-features.cy.ts         # Admin dashboard
├── collaboration.cy.ts          # Multi-user features
├── performance.cy.ts            # Performance validation
└── error-handling.cy.ts         # Error scenarios
```

## Key Test Features

### Security Testing

- **Sandbox Isolation**: Python code execution security
- **Authentication**: JWT token validation and refresh
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: SQL injection and XSS prevention
- **Rate Limiting**: API throttling and abuse prevention
- **Tenant Isolation**: Multi-tenant data segregation

### Performance Testing

- **Response Times**: API endpoint performance validation
- **Database Queries**: Query optimization verification
- **Memory Usage**: Tool execution resource limits
- **Concurrent Users**: WebSocket connection scaling
- **File Uploads**: Large artifact handling

### Error Handling

- **Network Failures**: Graceful degradation testing
- **Database Errors**: Transaction rollback validation
- **Tool Failures**: Sandbox error containment
- **Session Timeout**: Token expiration handling
- **Rate Limiting**: Throttling response validation

## Testing Best Practices

### Test Structure

```typescript
describe('Feature Name', () => {
  beforeEach(async () => {
    // Setup test environment
    await setupTestData();
  });

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe('Happy Path', () => {
    it('should perform expected behavior', async () => {
      // Arrange
      const testData = createTestData();
      
      // Act
      const result = await performAction(testData);
      
      // Assert
      expect(result).toMatchExpectedOutcome();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid input gracefully', async () => {
      // Test error conditions
    });
  });

  describe('Edge Cases', () => {
    it('should handle boundary conditions', async () => {
      // Test limits and edge cases
    });
  });
});
```

### Mocking Strategy

```typescript
// Mock external services
jest.mock('../services/external-api', () => ({
  callExternalService: jest.fn(),
}));

// Mock database with realistic data
const mockPrisma = {
  user: {
    findUnique: jest.fn().mockResolvedValue(mockUser),
    create: jest.fn().mockResolvedValue(createdUser),
  },
};
```

### Test Data Management

```typescript
// Use factories for consistent test data
const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'CREATOR',
  ...overrides,
});

// Database seeding for integration tests
async function seedTestDatabase() {
  await prisma.tenant.create({ data: testTenant });
  await prisma.user.create({ data: testUser });
}
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Ensure PostgreSQL is running
   brew services start postgresql
   
   # Verify connection string
   psql $DATABASE_URL_TEST
   ```

2. **Redis Connection Issues**
   ```bash
   # Start Redis server
   redis-server
   
   # Test connection
   redis-cli ping
   ```

3. **Port Conflicts**
   ```bash
   # Find and kill processes on test ports
   lsof -ti:3000 | xargs kill -9
   lsof -ti:3001 | xargs kill -9
   ```

4. **Coverage Threshold Failures**
   ```bash
   # Generate detailed coverage report
   npm run test:coverage
   open coverage/html/index.html
   
   # Identify uncovered code
   npm run coverage:check
   ```

### Debug Mode

```bash
# Run tests with debug output
DEBUG=* npm run test

# Run specific test file with verbose output
npm test -- --verbose auth.test.ts

# Debug E2E tests
npm run test:e2e:open  # Opens Cypress Test Runner
```

### Test Environment Variables

```bash
# Enable test debugging
export DEBUG_TESTS=true
export LOG_LEVEL=debug

# Database configuration
export DATABASE_URL_TEST=postgresql://localhost:5432/penny_test
export REDIS_URL_TEST=redis://localhost:6379

# Feature flags for testing
export FEATURE_PYTHON_SANDBOX=true
export FEATURE_JIRA_INTEGRATION=false
```

## Continuous Integration

### GitHub Actions

The platform includes automated testing workflows:

- **Pull Request Tests**: Run on every PR
- **Main Branch Tests**: Full test suite on merge
- **Nightly Tests**: Extended test suite with performance
- **Security Tests**: Daily vulnerability scans

### Pre-commit Hooks

```bash
# Lint staged files
npm run lint:staged

# Run affected tests
npm run test:affected

# Type checking
npm run typecheck
```

## Contributing

### Adding New Tests

1. **Create test file** following naming conventions
2. **Write tests** using established patterns
3. **Update coverage** thresholds if needed
4. **Document** any special setup requirements
5. **Run full test suite** before committing

### Test Review Checklist

- [ ] Tests cover happy path and error cases
- [ ] Edge cases and boundary conditions tested
- [ ] Mocks are realistic and maintainable
- [ ] Test data is properly cleaned up
- [ ] Coverage thresholds are maintained
- [ ] Tests are readable and well-documented

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Cypress Documentation](https://docs.cypress.io/)
- [Testing Library](https://testing-library.com/docs/)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing)
- [Security Testing Guide](./security-testing.md)
- [Performance Testing Guide](./performance-testing.md)