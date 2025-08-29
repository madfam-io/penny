import Ajv, { type JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchema7 } from 'json-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import type { ToolDefinition, ToolValidationError } from './types.js';

export interface ValidatorConfig {
  strict?: boolean;
  removeAdditional?: boolean | 'all' | 'failing';
  useDefaults?: boolean;
  coerceTypes?: boolean | 'array';
  allowUnionTypes?: boolean;
  verbose?: boolean;
  
  // JSON Schema Draft version
  draft?: '2019-09' | '2020-12';
  
  // Custom formats
  customFormats?: Record<string, (data: string) => boolean>;
  
  // Custom keywords
  customKeywords?: Array<{
    keyword: string;
    type?: string | string[];
    schemaType?: string | string[];
    compile?: (schemaVal: any) => (data: any) => boolean;
    validate?: (schemaVal: any, data: any) => boolean;
  }>;
}

export class ToolValidator {
  private ajv: Ajv;
  private schemaCache: Map<string, JSONSchema7> = new Map();
  private validatorCache: Map<string, ReturnType<Ajv['compile']>> = new Map();

  constructor(config: ValidatorConfig = {}) {
    // Initialize AJV with JSON Schema Draft 2020-12 support
    this.ajv = new Ajv({
      strict: config.strict !== false,
      removeAdditional: config.removeAdditional || false,
      useDefaults: config.useDefaults !== false,
      coerceTypes: config.coerceTypes || false,
      verbose: config.verbose || false,
      allowUnionTypes: config.allowUnionTypes || false,
      
      // Use JSON Schema Draft 2020-12
      schemaId: config.draft === '2019-09' ? 'http://json-schema.org/draft-07/schema#' : 'https://json-schema.org/draft/2020-12/schema',
    });

    // Add standard formats (date, email, uri, etc.)
    addFormats(this.ajv);

    // Add custom formats
    if (config.customFormats) {
      Object.entries(config.customFormats).forEach(([name, validator]) => {
        this.ajv.addFormat(name, validator);
      });
    }

    // Add custom keywords
    if (config.customKeywords) {
      config.customKeywords.forEach(keyword => {
        this.ajv.addKeyword(keyword);
      });
    }

    // Add PENNY-specific formats
    this.addPennyFormats();
    
    // Add PENNY-specific keywords
    this.addPennyKeywords();
  }

  /**
   * Validate tool parameters against tool schema
   */
  async validateParameters(tool: ToolDefinition, params: any): Promise<{ valid: boolean; errors?: string[]; normalizedParams?: any }> {
    try {
      // First try Zod validation if available
      if (tool.schema) {
        try {
          const normalizedParams = tool.schema.parse(params);
          return { valid: true, normalizedParams };
        } catch (zodError: any) {
          return {
            valid: false,
            errors: zodError.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`) || [zodError.message]
          };
        }
      }

      // Fall back to JSON Schema validation
      if (tool.jsonSchema) {
        const validator = this.getValidator(tool.name, tool.jsonSchema);
        const valid = validator(params);
        
        if (valid) {
          return { valid: true, normalizedParams: params };
        } else {
          return {
            valid: false,
            errors: validator.errors?.map(err => 
              `${err.instancePath || 'root'}${err.instancePath ? '.' : ''}${err.keyword}: ${err.message}`
            ) || ['Validation failed']
          };
        }
      }

      // No schema available
      return { valid: true, normalizedParams: params };
    } catch (error: any) {
      return { valid: false, errors: [error.message] };
    }
  }

  /**
   * Validate tool definition structure
   */
  validateToolDefinition(tool: Partial<ToolDefinition>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!tool.name) errors.push('Tool name is required');
    if (!tool.displayName) errors.push('Tool display name is required');
    if (!tool.description) errors.push('Tool description is required');
    if (!tool.category) errors.push('Tool category is required');
    if (!tool.handler) errors.push('Tool handler function is required');

    // Name validation
    if (tool.name && !/^[a-z][a-z0-9_]*$/.test(tool.name)) {
      errors.push('Tool name must start with lowercase letter and contain only lowercase letters, numbers, and underscores');
    }

    // Version validation
    if (tool.version && !/^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/.test(tool.version)) {
      errors.push('Tool version must follow semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)');
    }

    // Category validation
    const validCategories = [
      'analytics', 'productivity', 'communication', 'development', 
      'data', 'utility', 'integration', 'visualization', 'automation', 'custom'
    ];
    if (tool.category && !validCategories.includes(tool.category)) {
      errors.push(`Tool category must be one of: ${validCategories.join(', ')}`);
    }

    // Schema validation
    if (tool.schema && tool.jsonSchema) {
      // Validate that Zod schema matches JSON schema
      try {
        const generatedJsonSchema = zodToJsonSchema(tool.schema, {
          name: `${tool.name}ParamsSchema`,
          target: 'jsonSchema2020-12'
        });
        
        // Basic comparison (could be more sophisticated)
        if (JSON.stringify(generatedJsonSchema) !== JSON.stringify(tool.jsonSchema)) {
          errors.push('Zod schema and JSON schema do not match');
        }
      } catch (error: any) {
        errors.push(`Invalid Zod schema: ${error.message}`);
      }
    }

    // Config validation
    if (tool.config) {
      if (tool.config.timeout && (tool.config.timeout < 1000 || tool.config.timeout > 300000)) {
        errors.push('Tool timeout must be between 1000ms (1s) and 300000ms (5m)');
      }

      if (tool.config.rateLimit) {
        const { requests, window } = tool.config.rateLimit;
        if (!requests || !window || requests < 1 || window < 1) {
          errors.push('Rate limit requires positive requests and window values');
        }
      }

      if (tool.config.maxRetries && (tool.config.maxRetries < 0 || tool.config.maxRetries > 10)) {
        errors.push('Max retries must be between 0 and 10');
      }
    }

    // Dependencies validation
    if (tool.dependencies) {
      for (const dep of tool.dependencies) {
        if (!dep.name) errors.push('Dependency name is required');
        if (dep.type && !['tool', 'service', 'library', 'model'].includes(dep.type)) {
          errors.push('Dependency type must be one of: tool, service, library, model');
        }
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * Generate JSON Schema from Zod schema
   */
  zodToJsonSchema(zodSchema: z.ZodSchema<any>, options: { name?: string; target?: 'jsonSchema7' | 'jsonSchema2020-12' } = {}): JSONSchema7 {
    return zodToJsonSchema(zodSchema, {
      name: options.name || 'ParametersSchema',
      target: options.target || 'jsonSchema2020-12',
      definitions: {},
      errorMessages: true,
      markdownDescription: true,
    }) as JSONSchema7;
  }

  /**
   * Validate JSON Schema itself
   */
  validateJsonSchema(schema: JSONSchema7): { valid: boolean; errors?: string[] } {
    try {
      // Use AJV to validate the schema structure
      this.ajv.validateSchema(schema);
      if (this.ajv.errors) {
        return {
          valid: false,
          errors: this.ajv.errors.map(err => `${err.instancePath}: ${err.message}`)
        };
      }
      return { valid: true };
    } catch (error: any) {
      return { valid: false, errors: [error.message] };
    }
  }

  /**
   * Get compiled validator for a schema (with caching)
   */
  private getValidator(toolName: string, schema: JSONSchema7): ReturnType<Ajv['compile']> {
    const cacheKey = `${toolName}:${JSON.stringify(schema)}`;
    
    if (this.validatorCache.has(cacheKey)) {
      return this.validatorCache.get(cacheKey)!;
    }

    const validator = this.ajv.compile(schema);
    this.validatorCache.set(cacheKey, validator);
    
    return validator;
  }

  /**
   * Clear validator cache
   */
  clearCache(): void {
    this.validatorCache.clear();
    this.schemaCache.clear();
  }

  /**
   * Add PENNY-specific formats
   */
  private addPennyFormats(): void {
    // Tenant ID format
    this.ajv.addFormat('tenantId', {
      type: 'string',
      validate: (data: string) => /^tenant_[a-zA-Z0-9]{16,}$/.test(data)
    });

    // User ID format
    this.ajv.addFormat('userId', {
      type: 'string',
      validate: (data: string) => /^user_[a-zA-Z0-9]{16,}$/.test(data)
    });

    // Conversation ID format
    this.ajv.addFormat('conversationId', {
      type: 'string',
      validate: (data: string) => /^conv_[a-zA-Z0-9]{16,}$/.test(data)
    });

    // Tool name format
    this.ajv.addFormat('toolName', {
      type: 'string',
      validate: (data: string) => /^[a-z][a-z0-9_]*$/.test(data)
    });

    // Semantic version format
    this.ajv.addFormat('semver', {
      type: 'string',
      validate: (data: string) => /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/.test(data)
    });

    // MIME type format
    this.ajv.addFormat('mimeType', {
      type: 'string',
      validate: (data: string) => /^[a-zA-Z][a-zA-Z0-9][a-zA-Z0-9!#$&\-\^]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^]*$/.test(data)
    });

    // Color hex format
    this.ajv.addFormat('colorHex', {
      type: 'string',
      validate: (data: string) => /^#[0-9A-Fa-f]{6}$/.test(data)
    });

    // Cron expression format
    this.ajv.addFormat('cron', {
      type: 'string',
      validate: (data: string) => {
        // Basic cron validation (simplified)
        const parts = data.split(' ');
        return parts.length >= 5 && parts.length <= 6;
      }
    });
  }

  /**
   * Add PENNY-specific keywords
   */
  private addPennyKeywords(): void {
    // Tool category keyword
    this.ajv.addKeyword({
      keyword: 'toolCategory',
      type: 'string',
      compile: () => {
        const validCategories = [
          'analytics', 'productivity', 'communication', 'development',
          'data', 'utility', 'integration', 'visualization', 'automation', 'custom'
        ];
        return (data: string) => validCategories.includes(data);
      }
    });

    // Permission level keyword
    this.ajv.addKeyword({
      keyword: 'permissionLevel',
      type: 'string',
      compile: () => {
        const validLevels = ['none', 'read', 'write', 'admin'];
        return (data: string) => validLevels.includes(data);
      }
    });

    // Sensitive data keyword (for validation warnings)
    this.ajv.addKeyword({
      keyword: 'sensitive',
      type: ['string', 'object'],
      compile: (schemaValue: boolean) => {
        return (data: any) => {
          if (schemaValue && typeof data === 'string') {
            // Check for potential sensitive patterns
            const sensitivePatterns = [
              /password/i,
              /secret/i,
              /token/i,
              /key/i,
              /api[_-]?key/i,
              /auth/i,
              /credential/i
            ];
            
            const hasSensitiveContent = sensitivePatterns.some(pattern => 
              pattern.test(data) || pattern.test(JSON.stringify(data))
            );
            
            if (hasSensitiveContent) {
              // This is a warning, not a hard validation error
              console.warn(`Potentially sensitive data detected in tool parameters`);
            }
          }
          return true; // Always pass validation, just log warning
        };
      }
    });

    // File size validation
    this.ajv.addKeyword({
      keyword: 'maxFileSize',
      type: 'object',
      compile: (maxSize: number) => {
        return (data: any) => {
          if (data && typeof data === 'object' && 'size' in data) {
            return data.size <= maxSize;
          }
          return true;
        };
      }
    });

    // Array length with custom error message
    this.ajv.addKeyword({
      keyword: 'arrayLengthRange',
      type: 'array',
      compile: (schemaValue: { min?: number; max?: number }) => {
        return (data: any[]) => {
          const len = data.length;
          if (schemaValue.min !== undefined && len < schemaValue.min) return false;
          if (schemaValue.max !== undefined && len > schemaValue.max) return false;
          return true;
        };
      }
    });
  }

  /**
   * Create validation error with detailed information
   */
  createValidationError(tool: string, errors: string[], field?: string): ToolValidationError {
    return new ToolValidationError(
      `Validation failed for tool ${tool}${field ? ` in field ${field}` : ''}`,
      tool,
      errors,
      field
    );
  }

  /**
   * Batch validate multiple parameters
   */
  async batchValidateParameters(
    validations: Array<{ tool: ToolDefinition; params: any; id?: string }>
  ): Promise<Array<{ id?: string; valid: boolean; errors?: string[]; normalizedParams?: any }>> {
    const results = await Promise.allSettled(
      validations.map(async ({ tool, params, id }) => {
        const result = await this.validateParameters(tool, params);
        return { id, ...result };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          id: validations[index].id,
          valid: false,
          errors: [result.reason.message]
        };
      }
    });
  }

  /**
   * Get validator statistics
   */
  getStats(): {
    cachedValidators: number;
    cachedSchemas: number;
    totalValidations: number;
  } {
    return {
      cachedValidators: this.validatorCache.size,
      cachedSchemas: this.schemaCache.size,
      totalValidations: 0 // Would need to track this in implementation
    };
  }
}