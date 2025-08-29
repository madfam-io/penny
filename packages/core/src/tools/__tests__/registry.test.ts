import { ToolRegistry } from '../registry';
import { ToolDefinition } from '../types';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  const mockTool: ToolDefinition = {
    name: 'test_tool',
    displayName: 'Test Tool',
    description: 'A test tool',
    category: 'test',
    schema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
    },
    handler: jest.fn(),
    config: {
      requiresAuth: true,
    },
  };

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      registry.register(mockTool);
      
      expect(registry.get('test_tool')).toEqual(mockTool);
    });

    it('should throw error when registering duplicate tool', () => {
      registry.register(mockTool);
      
      expect(() => registry.register(mockTool)).toThrow(
        'Tool test_tool is already registered'
      );
    });

    it('should validate tool definition', () => {
      const invalidTool = {
        name: '', // Invalid: empty name
        handler: jest.fn(),
      } as any;

      expect(() => registry.register(invalidTool)).toThrow();
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      registry.register(mockTool);
      registry.unregister('test_tool');
      
      expect(registry.get('test_tool')).toBeUndefined();
    });

    it('should handle unregistering non-existent tool', () => {
      expect(() => registry.unregister('non_existent')).not.toThrow();
    });
  });

  describe('get', () => {
    it('should get a registered tool', () => {
      registry.register(mockTool);
      
      const tool = registry.get('test_tool');
      
      expect(tool).toEqual(mockTool);
    });

    it('should return undefined for non-existent tool', () => {
      const tool = registry.get('non_existent');
      
      expect(tool).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all registered tools', () => {
      const tool1 = { ...mockTool, name: 'tool1' };
      const tool2 = { ...mockTool, name: 'tool2' };
      
      registry.register(tool1);
      registry.register(tool2);
      
      const tools = registry.list();
      
      expect(tools).toHaveLength(2);
      expect(tools).toContainEqual(tool1);
      expect(tools).toContainEqual(tool2);
    });

    it('should return empty array when no tools registered', () => {
      const tools = registry.list();
      
      expect(tools).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registry.register({
        ...mockTool,
        name: 'analytics_tool',
        displayName: 'Analytics Tool',
        category: 'analytics',
        description: 'Tool for data analysis',
      });
      
      registry.register({
        ...mockTool,
        name: 'communication_tool',
        displayName: 'Communication Tool',
        category: 'communication',
        description: 'Tool for sending messages',
      });
      
      registry.register({
        ...mockTool,
        name: 'data_tool',
        displayName: 'Data Tool',
        category: 'analytics',
        description: 'Tool for data processing',
      });
    });

    it('should search tools by query', () => {
      const results = registry.search({ query: 'data' });
      
      expect(results).toHaveLength(2);
      expect(results.map(t => t.name)).toContain('analytics_tool');
      expect(results.map(t => t.name)).toContain('data_tool');
    });

    it('should search tools by category', () => {
      const results = registry.search({ category: 'analytics' });
      
      expect(results).toHaveLength(2);
      expect(results.map(t => t.name)).toContain('analytics_tool');
      expect(results.map(t => t.name)).toContain('data_tool');
    });

    it('should search tools by multiple criteria', () => {
      const results = registry.search({
        query: 'data',
        category: 'analytics',
      });
      
      expect(results).toHaveLength(2);
    });

    it('should return all tools when no criteria provided', () => {
      const results = registry.search({});
      
      expect(results).toHaveLength(3);
    });
  });

  describe('getCategories', () => {
    it('should get all unique categories', () => {
      registry.register({
        ...mockTool,
        name: 'tool1',
        category: 'analytics',
      });
      
      registry.register({
        ...mockTool,
        name: 'tool2',
        category: 'communication',
      });
      
      registry.register({
        ...mockTool,
        name: 'tool3',
        category: 'analytics',
      });
      
      const categories = registry.getCategories();
      
      expect(categories).toEqual(['analytics', 'communication']);
    });

    it('should return empty array when no tools registered', () => {
      const categories = registry.getCategories();
      
      expect(categories).toEqual([]);
    });
  });

  describe('validate', () => {
    it('should validate tool parameters', () => {
      registry.register(mockTool);
      
      const isValid = registry.validate('test_tool', { input: 'test' });
      
      expect(isValid).toBe(true);
    });

    it('should return false for invalid parameters', () => {
      registry.register(mockTool);
      
      const isValid = registry.validate('test_tool', { invalid: 'param' });
      
      expect(isValid).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      const isValid = registry.validate('non_existent', {});
      
      expect(isValid).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all registered tools', () => {
      registry.register(mockTool);
      registry.register({ ...mockTool, name: 'tool2' });
      
      registry.clear();
      
      expect(registry.list()).toEqual([]);
    });
  });
});