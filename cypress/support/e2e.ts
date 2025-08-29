// Cypress E2E support file

import '@cypress/code-coverage/support';
import 'cypress-terminal-report/src/installLogsCollector';

// Custom command declarations
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      loginAsUser(email: string): Chainable<void>;
      startNewConversation(): Chainable<void>;
      createConversationWithArtifacts(): Chainable<void>;
    }
  }
}

// Custom commands
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/auth/login');
  cy.get('[data-testid="email-input"]').type(email);
  cy.get('[data-testid="password-input"]').type(password);
  cy.get('[data-testid="login-button"]').click();
  cy.url().should('include', '/dashboard');
});

Cypress.Commands.add('loginAsUser', (email: string) => {
  cy.task('auth:createSession', { email }).then((token) => {
    // Set auth token for the session
    cy.window().then((win) => {
      win.localStorage.setItem('auth-token', token as string);
    });
    cy.visit('/dashboard');
  });
});

Cypress.Commands.add('startNewConversation', () => {
  cy.get('[data-testid="new-conversation-button"]').click();
  cy.get('[data-testid="message-input"]').should('be.visible');
});

Cypress.Commands.add('createConversationWithArtifacts', () => {
  cy.task('db:createConversation', {
    userId: 'test@example.com',
    title: 'Conversation with Artifacts',
    messages: [
      { role: 'user', content: 'Show me company KPIs' },
      { role: 'assistant', content: 'Here are the company KPIs...' },
    ],
  }).then((conversation) => {
    // Create artifacts for the conversation
    cy.request({
      method: 'POST',
      url: '/api/v1/artifacts',
      headers: {
        Authorization: `Bearer ${Cypress.env('authToken')}`,
      },
      body: {
        type: 'chart',
        title: 'Company KPIs Chart',
        data: {
          type: 'bar',
          labels: ['Revenue', 'Users', 'Growth'],
          values: [120000, 2500, 15],
        },
        conversationId: conversation.id,
      },
    });
  });
});

// Global configuration
beforeEach(() => {
  // Reset coverage data for each test
  if (Cypress.env('coverage')) {
    cy.task('log', 'Resetting coverage data');
    cy.window().then((win) => {
      (win as any).__coverage__ = {};
    });
  }

  // Set up request/response interceptors for API testing
  cy.intercept('POST', '/api/v1/chat/*/messages', { fixture: 'chat-response.json' }).as('sendMessage');
  cy.intercept('GET', '/api/v1/conversations', { fixture: 'conversations.json' }).as('getConversations');
  cy.intercept('POST', '/api/v1/tools/*/execute', { fixture: 'tool-execution.json' }).as('executeTool');
});

afterEach(() => {
  // Collect coverage data after each test
  if (Cypress.env('coverage')) {
    cy.window().then((win) => {
      const coverage = (win as any).__coverage__;
      if (coverage) {
        cy.task('log', `Coverage collected for test: ${Cypress.currentTest.title}`);
      }
    });
  }
});

// Global error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Don't fail tests on uncaught exceptions from the application
  // This is useful for testing error scenarios
  if (err.message.includes('Network Error') || err.message.includes('ChunkLoadError')) {
    return false;
  }
  
  // Let other exceptions fail the test
  return true;
});

// Custom assertions
chai.use(function (chai, utils) {
  chai.Assertion.addMethod('haveCorrectDataTestId', function (expected: string) {
    const obj = this._obj;
    const actual = obj.attr('data-testid');
    
    this.assert(
      actual === expected,
      `expected element to have data-testid '${expected}' but got '${actual}'`,
      `expected element not to have data-testid '${expected}'`,
      expected,
      actual
    );
  });
});

// Performance monitoring
Cypress.Commands.add('measurePerformance', (name: string) => {
  cy.window().then((win) => {
    win.performance.mark(`${name}-start`);
  });
});

Cypress.Commands.add('endPerformanceMeasure', (name: string, maxDuration: number = 1000) => {
  cy.window().then((win) => {
    win.performance.mark(`${name}-end`);
    win.performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = win.performance.getEntriesByName(name)[0] as PerformanceMeasure;
    expect(measure.duration).to.be.lessThan(maxDuration, 
      `Performance measure '${name}' took ${measure.duration}ms, which exceeds the limit of ${maxDuration}ms`
    );
  });
});

// Extend Cypress namespace for new commands
declare global {
  namespace Cypress {
    interface Chainable {
      measurePerformance(name: string): Chainable<void>;
      endPerformanceMeasure(name: string, maxDuration?: number): Chainable<void>;
    }
  }
}