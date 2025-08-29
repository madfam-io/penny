// Built-in tool implementations
export { getCompanyKpisTool } from './get_company_kpis.js';
export { loadDashboardTool } from './load_dashboard.js';
export { pythonCodeTool } from './python_code.js';
export { searchDocumentsTool } from './search_documents.js';
export { sendEmailTool } from './send_email.js';
export { createChartTool } from './create_chart.js';
export { exportDataTool } from './export_data.js';
export { jiraIntegrationTool } from './jira_integration.js';
export { slackIntegrationTool } from './slack_integration.js';

// Tool registration helper
import type { ToolDefinition } from '../types.js';
import { getCompanyKpisTool } from './get_company_kpis.js';
import { loadDashboardTool } from './load_dashboard.js';
import { pythonCodeTool } from './python_code.js';
import { searchDocumentsTool } from './search_documents.js';
import { sendEmailTool } from './send_email.js';
import { createChartTool } from './create_chart.js';
import { exportDataTool } from './export_data.js';
import { jiraIntegrationTool } from './jira_integration.js';
import { slackIntegrationTool } from './slack_integration.js';

/**
 * All built-in tools
 */
export const BUILTIN_TOOLS: ToolDefinition[] = [
  getCompanyKpisTool,
  loadDashboardTool,
  pythonCodeTool,
  searchDocumentsTool,
  sendEmailTool,
  createChartTool,
  exportDataTool,
  jiraIntegrationTool,
  slackIntegrationTool,
];

/**
 * Get all built-in tools by category
 */
export function getToolsByCategory(): Record<string, ToolDefinition[]> {
  const toolsByCategory: Record<string, ToolDefinition[]> = {};
  
  BUILTIN_TOOLS.forEach(tool => {
    if (!toolsByCategory[tool.category]) {
      toolsByCategory[tool.category] = [];
    }
    toolsByCategory[tool.category].push(tool);
  });
  
  return toolsByCategory;
}

/**
 * Get a built-in tool by name
 */
export function getBuiltinTool(name: string): ToolDefinition | undefined {
  return BUILTIN_TOOLS.find(tool => tool.name === name);
}

/**
 * Check if a tool name is a built-in tool
 */
export function isBuiltinTool(name: string): boolean {
  return BUILTIN_TOOLS.some(tool => tool.name === name);
}