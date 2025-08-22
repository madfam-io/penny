import { ToolRegistry } from '../registry.js';
import { getCompanyKPIsTool } from './kpis.js';
import { createJiraTicketTool } from './jira.js';
import { runPythonJobTool } from './python.js';

export function registerBuiltinTools(registry: ToolRegistry): void {
  // Analytics tools
  registry.register(getCompanyKPIsTool);

  // Productivity tools
  registry.register(createJiraTicketTool);

  // Development tools
  registry.register(runPythonJobTool);

  // Add more built-in tools here as needed
}

export const builtinTools = [
  getCompanyKPIsTool,
  createJiraTicketTool,
  runPythonJobTool,
];