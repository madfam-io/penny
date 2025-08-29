describe('User Journey E2E Tests', () => {
  beforeEach(() => {
    // Reset database and seed test data
    cy.task('db:seed');
    
    // Visit the application
    cy.visit('/');
  });

  describe('Authentication Flow', () => {
    it('should allow user to register and login', () => {
      // Navigate to registration
      cy.contains('Sign Up').click();
      
      // Fill registration form
      cy.get('[data-testid="email-input"]').type('newuser@example.com');
      cy.get('[data-testid="password-input"]').type('StrongP@ss123');
      cy.get('[data-testid="name-input"]').type('Test User');
      cy.get('[data-testid="register-button"]').click();
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
      cy.contains('Welcome, Test User').should('be.visible');
      
      // Logout
      cy.get('[data-testid="user-menu"]').click();
      cy.contains('Logout').click();
      
      // Login with created account
      cy.get('[data-testid="email-input"]').type('newuser@example.com');
      cy.get('[data-testid="password-input"]').type('StrongP@ss123');
      cy.get('[data-testid="login-button"]').click();
      
      // Should be logged in
      cy.url().should('include', '/dashboard');
      cy.contains('Test User').should('be.visible');
    });

    it('should handle OAuth login', () => {
      // Click Google login
      cy.contains('Continue with Google').click();
      
      // Mock OAuth flow
      cy.origin('https://accounts.google.com', () => {
        cy.get('#identifierId').type('test@gmail.com');
        cy.get('#identifierNext').click();
        cy.get('[name="password"]').type('password');
        cy.get('#passwordNext').click();
      });
      
      // Should redirect back to app
      cy.url().should('include', '/dashboard');
      cy.contains('test@gmail.com').should('be.visible');
    });
  });

  describe('Conversation Flow', () => {
    beforeEach(() => {
      cy.login('test@example.com', 'password123');
    });

    it('should create and interact with conversation', () => {
      // Create new conversation
      cy.get('[data-testid="new-conversation"]').click();
      
      // Send a message
      cy.get('[data-testid="message-input"]').type('Show me company KPIs');
      cy.get('[data-testid="send-button"]').click();
      
      // Wait for response
      cy.get('[data-testid="assistant-message"]', { timeout: 10000 })
        .should('be.visible')
        .and('contain', 'KPIs');
      
      // Check if artifact is displayed
      cy.get('[data-testid="artifact-viewer"]').should('be.visible');
      cy.get('[data-testid="dashboard-viewer"]').should('exist');
      
      // Send follow-up message
      cy.get('[data-testid="message-input"]').type('Can you show me Q3 data?');
      cy.get('[data-testid="send-button"]').click();
      
      // Wait for tool execution
      cy.get('[data-testid="tool-indicator"]').should('be.visible');
      cy.get('[data-testid="assistant-message"]').should('contain', 'Q3');
    });

    it('should handle conversation branching', () => {
      // Navigate to existing conversation
      cy.get('[data-testid="conversation-list"]')
        .find('[data-testid="conversation-item"]')
        .first()
        .click();
      
      // Find a message to branch from
      cy.get('[data-testid="message"]').eq(2).trigger('hover');
      cy.get('[data-testid="branch-button"]').click();
      
      // Send alternative message
      cy.get('[data-testid="message-input"]').type('What about sales data instead?');
      cy.get('[data-testid="send-button"]').click();
      
      // Should show branch indicator
      cy.get('[data-testid="branch-indicator"]').should('be.visible');
      
      // Switch between branches
      cy.get('[data-testid="branch-selector"]').click();
      cy.contains('Original').click();
      
      // Original message should be visible
      cy.get('[data-testid="message"]').should('contain', 'KPIs');
    });
  });

  describe('Tool Execution', () => {
    beforeEach(() => {
      cy.login('test@example.com', 'password123');
    });

    it('should execute dashboard tool', () => {
      cy.get('[data-testid="new-conversation"]').click();
      
      // Request dashboard
      cy.get('[data-testid="message-input"]').type('Load the company health dashboard');
      cy.get('[data-testid="send-button"]').click();
      
      // Wait for tool execution
      cy.get('[data-testid="tool-execution"]').should('be.visible');
      cy.contains('load_dashboard').should('be.visible');
      
      // Dashboard should load
      cy.get('[data-testid="dashboard-viewer"]', { timeout: 10000 }).should('be.visible');
      
      // Interact with dashboard
      cy.get('[data-testid="widget-revenue"]').should('contain', '$');
      cy.get('[data-testid="date-filter"]').select('Last 30 days');
      
      // Data should update
      cy.get('[data-testid="widget-revenue"]').should('be.visible');
    });

    it('should execute Python code', () => {
      cy.get('[data-testid="new-conversation"]').click();
      
      // Request Python execution
      cy.get('[data-testid="message-input"]').type('Run Python: print("Hello, World!")');
      cy.get('[data-testid="send-button"]').click();
      
      // Should show code execution
      cy.get('[data-testid="code-block"]').should('contain', 'print("Hello, World!")');
      cy.get('[data-testid="code-output"]').should('contain', 'Hello, World!');
    });

    it('should handle tool errors gracefully', () => {
      cy.get('[data-testid="new-conversation"]').click();
      
      // Request with invalid parameters
      cy.get('[data-testid="message-input"]').type('Get KPIs for invalid period');
      cy.get('[data-testid="send-button"]').click();
      
      // Should show error message
      cy.get('[data-testid="error-message"]').should('be.visible');
      cy.contains('I encountered an error').should('be.visible');
      
      // Should offer retry
      cy.contains('Try again').should('be.visible');
    });
  });

  describe('Artifact Management', () => {
    beforeEach(() => {
      cy.login('test@example.com', 'password123');
      cy.createConversationWithArtifacts();
    });

    it('should view and interact with artifacts', () => {
      // Navigate to conversation with artifacts
      cy.get('[data-testid="conversation-with-artifacts"]').click();
      
      // Artifact viewer should be visible
      cy.get('[data-testid="artifact-viewer"]').should('be.visible');
      
      // Switch between artifacts
      cy.get('[data-testid="artifact-tab-2"]').click();
      cy.get('[data-testid="chart-viewer"]').should('be.visible');
      
      // Download artifact
      cy.get('[data-testid="download-artifact"]').click();
      cy.readFile('cypress/downloads/artifact.json').should('exist');
      
      // Fullscreen view
      cy.get('[data-testid="fullscreen-artifact"]').click();
      cy.get('[data-testid="artifact-viewer"]').should('have.class', 'fullscreen');
      
      // Exit fullscreen
      cy.get('[data-testid="exit-fullscreen"]').click();
      cy.get('[data-testid="artifact-viewer"]').should('not.have.class', 'fullscreen');
    });

    it('should share artifacts', () => {
      cy.get('[data-testid="conversation-with-artifacts"]').click();
      
      // Click share on artifact
      cy.get('[data-testid="share-artifact"]').click();
      
      // Share dialog should open
      cy.get('[data-testid="share-dialog"]').should('be.visible');
      
      // Copy link
      cy.get('[data-testid="copy-link"]').click();
      cy.get('[data-testid="copied-indicator"]').should('be.visible');
      
      // Test public access
      cy.get('[data-testid="make-public"]').click();
      cy.get('[data-testid="public-url"]').then(($el) => {
        const url = $el.text();
        
        // Visit in incognito
        cy.clearCookies();
        cy.visit(url);
        
        // Artifact should be visible without login
        cy.get('[data-testid="public-artifact"]').should('be.visible');
      });
    });
  });

  describe('Real-time Features', () => {
    beforeEach(() => {
      cy.login('test@example.com', 'password123');
    });

    it('should show typing indicators', () => {
      cy.get('[data-testid="new-conversation"]').click();
      
      // Start typing
      cy.get('[data-testid="message-input"]').type('Testing typing indicator');
      
      // Open second tab (simulated)
      cy.window().then((win) => {
        const newWindow = win.open('/');
        cy.wrap(newWindow).its('document').should('exist');
      });
      
      // Typing indicator should be visible in second tab
      cy.get('[data-testid="typing-indicator"]').should('be.visible');
      
      // Send message
      cy.get('[data-testid="send-button"]').click();
      
      // Typing indicator should disappear
      cy.get('[data-testid="typing-indicator"]').should('not.exist');
    });

    it('should stream responses token by token', () => {
      cy.get('[data-testid="new-conversation"]').click();
      
      // Send message
      cy.get('[data-testid="message-input"]').type('Tell me a story');
      cy.get('[data-testid="send-button"]').click();
      
      // Should see streaming indicator
      cy.get('[data-testid="streaming-indicator"]').should('be.visible');
      
      // Message should appear token by token
      cy.get('[data-testid="assistant-message"]').should(($el) => {
        const text = $el.text();
        expect(text.length).to.be.greaterThan(0);
      });
      
      // Wait for streaming to complete
      cy.get('[data-testid="streaming-indicator"]', { timeout: 10000 }).should('not.exist');
      
      // Full message should be visible
      cy.get('[data-testid="assistant-message"]').should('contain', 'Once upon a time');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', () => {
      cy.login('test@example.com', 'password123');
      
      // Simulate network error
      cy.intercept('POST', '/api/v1/chat/*/messages', { forceNetworkError: true });
      
      cy.get('[data-testid="new-conversation"]').click();
      cy.get('[data-testid="message-input"]').type('Test message');
      cy.get('[data-testid="send-button"]').click();
      
      // Error message should appear
      cy.get('[data-testid="error-toast"]').should('be.visible');
      cy.contains('Network error').should('be.visible');
      
      // Retry button should be available
      cy.get('[data-testid="retry-button"]').should('be.visible');
    });

    it('should handle rate limiting', () => {
      cy.login('test@example.com', 'password123');
      
      // Send many messages quickly
      cy.get('[data-testid="new-conversation"]').click();
      
      for (let i = 0; i < 10; i++) {
        cy.get('[data-testid="message-input"]').type(`Message ${i}`);
        cy.get('[data-testid="send-button"]').click();
      }
      
      // Rate limit message should appear
      cy.get('[data-testid="rate-limit-warning"]').should('be.visible');
      cy.contains('Please slow down').should('be.visible');
    });

    it('should handle session expiration', () => {
      cy.login('test@example.com', 'password123');
      
      // Simulate session expiration
      cy.window().then((win) => {
        win.localStorage.removeItem('token');
      });
      
      // Try to send message
      cy.get('[data-testid="new-conversation"]').click();
      cy.get('[data-testid="message-input"]').type('Test message');
      cy.get('[data-testid="send-button"]').click();
      
      // Should redirect to login
      cy.url().should('include', '/login');
      cy.contains('Session expired').should('be.visible');
    });
  });

  describe('Performance', () => {
    it('should load conversations quickly', () => {
      cy.login('test@example.com', 'password123');
      
      // Measure load time
      cy.window().then((win) => {
        win.performance.mark('conversations-start');
      });
      
      cy.get('[data-testid="conversation-list"]').should('be.visible');
      
      cy.window().then((win) => {
        win.performance.mark('conversations-end');
        win.performance.measure('conversations-load', 'conversations-start', 'conversations-end');
        
        const measure = win.performance.getEntriesByName('conversations-load')[0];
        expect(measure.duration).to.be.lessThan(1000); // Less than 1 second
      });
    });

    it('should handle large conversations efficiently', () => {
      cy.login('test@example.com', 'password123');
      
      // Navigate to large conversation
      cy.get('[data-testid="large-conversation"]').click();
      
      // Should use virtualization
      cy.get('[data-testid="virtual-scroller"]').should('exist');
      
      // Only visible messages should be rendered
      cy.get('[data-testid="message"]').should('have.length.lessThan', 50);
      
      // Scroll to bottom
      cy.get('[data-testid="conversation-container"]').scrollTo('bottom');
      
      // Latest messages should be visible
      cy.get('[data-testid="message"]').last().should('be.visible');
    });
  });
});

// Custom commands
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login');
  cy.get('[data-testid="email-input"]').type(email);
  cy.get('[data-testid="password-input"]').type(password);
  cy.get('[data-testid="login-button"]').click();
  cy.url().should('include', '/dashboard');
});

Cypress.Commands.add('createConversationWithArtifacts', () => {
  cy.request('POST', '/api/v1/test/seed-artifacts');
});

// TypeScript support for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      createConversationWithArtifacts(): Chainable<void>;
    }
  }
}