import { ToolRegistry } from '../registry.js';
import { getCompanyKPIsTool } from './kpis.js';
import { loadDashboardTool } from './dashboard.js';
import { createJiraTicketTool } from './jira.js';
import { runPythonJobTool } from './python.js';
import { sendSlackMessage, getSlackChannels, getSlackUsers } from './slack.js';

export function registerBuiltinTools(registry: ToolRegistry): void {
  // Analytics tools
  registry.register(getCompanyKPIsTool);

  // Visualization tools
  registry.register(loadDashboardTool);

  // Productivity tools
  registry.register(createJiraTicketTool);

  // Communication tools
  registry.register(sendSlackMessage);
  registry.register(getSlackChannels);
  registry.register(getSlackUsers);

  // Development tools
  registry.register(runPythonJobTool);

  // Add more built-in tools here as needed
}

export const builtinTools = [
  getCompanyKPIsTool,
  loadDashboardTool,
  createJiraTicketTool,
  sendSlackMessage,
  getSlackChannels,
  getSlackUsers,
  runPythonJobTool,
];
