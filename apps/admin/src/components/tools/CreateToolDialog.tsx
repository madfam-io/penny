'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Separator,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@penny/ui';
import {
  Plus,
  Code,
  Settings,
  Shield,
  Info,
  FileText,
  Key,
  Globe,
  Zap,
  AlertTriangle,
  CheckCircle,
  X
} from 'lucide-react';

interface ToolConfig {
  name: string;
  version: string;
  description: string;
  category: string;
  provider: string;
  endpoint?: string;
  auth_type: string;
  requires_approval: boolean;
  is_public: boolean;
  schema: string;
  permissions: string[];
  rate_limit?: number;
  timeout?: number;
}

export function CreateToolDialog() {
  const [open, setOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState('basic');
  const [config, setConfig] = useState<ToolConfig>({
    name: '',
    version: '1.0.0',
    description: '',
    category: '',
    provider: 'Internal',
    auth_type: 'none',
    requires_approval: false,
    is_public: true,
    schema: '',
    permissions: [],
    rate_limit: 100,
    timeout: 30000
  });

  const [newPermission, setNewPermission] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = [
    'Analytics',
    'Visualization',
    'Communication',
    'Integration',
    'Code Execution',
    'Data Processing',
    'Security',
    'Monitoring',
    'Automation',
    'AI/ML'
  ];

  const providers = [
    'Internal',
    'OpenAI',
    'Anthropic',
    'SendGrid',
    'Atlassian',
    'Slack',
    'GitHub',
    'AWS',
    'Google',
    'Microsoft',
    'Custom'
  ];

  const authTypes = [
    { value: 'none', label: 'No Authentication' },
    { value: 'api_key', label: 'API Key' },
    { value: 'bearer_token', label: 'Bearer Token' },
    { value: 'oauth2', label: 'OAuth 2.0' },
    { value: 'basic', label: 'Basic Auth' },
    { value: 'custom', label: 'Custom Auth' }
  ];

  const exampleSchema = `{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The query parameter"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of results",
      "default": 10
    }
  },
  "required": ["query"]
}`;

  const handleConfigChange = (key: keyof ToolConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    // Clear error when user starts fixing it
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const addPermission = () => {
    if (newPermission.trim() && !config.permissions.includes(newPermission.trim())) {
      setConfig(prev => ({
        ...prev,
        permissions: [...prev.permissions, newPermission.trim()]
      }));
      setNewPermission('');
    }
  };

  const removePermission = (permission: string) => {
    setConfig(prev => ({
      ...prev,
      permissions: prev.permissions.filter(p => p !== permission)
    }));
  };

  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!config.name.trim()) {
      newErrors.name = 'Tool name is required';
    } else if (!/^[a-z][a-z0-9_]*$/.test(config.name)) {
      newErrors.name = 'Tool name must start with a letter and contain only lowercase letters, numbers, and underscores';
    }

    if (!config.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!config.category) {
      newErrors.category = 'Category is required';
    }

    if (config.provider === 'Custom' && !config.endpoint?.trim()) {
      newErrors.endpoint = 'Endpoint is required for custom providers';
    }

    if (!config.schema.trim()) {
      newErrors.schema = 'JSON schema is required';
    } else {
      try {
        JSON.parse(config.schema);
      } catch (e) {
        newErrors.schema = 'Invalid JSON schema';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateConfig()) {
      console.log('Creating tool:', config);
      // TODO: Implement actual API call
      setOpen(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setConfig({
      name: '',
      version: '1.0.0',
      description: '',
      category: '',
      provider: 'Internal',
      auth_type: 'none',
      requires_approval: false,
      is_public: true,
      schema: '',
      permissions: [],
      rate_limit: 100,
      timeout: 30000
    });
    setCurrentTab('basic');
    setErrors({});
    setNewPermission('');
  };

  const handleCancel = () => {
    setOpen(false);
    resetForm();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Tool
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Tool
            </DialogTitle>
            <DialogDescription>
              Register a new tool in the PENNY platform. Fill in the configuration details below.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic" className="flex items-center gap-1">
                <Info className="h-4 w-4" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                Config
              </TabsTrigger>
              <TabsTrigger value="schema" className="flex items-center gap-1">
                <Code className="h-4 w-4" />
                Schema
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tool Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., get_weather_data"
                    value={config.name}
                    onChange={(e) => handleConfigChange('name', e.target.value)}
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    placeholder="1.0.0"
                    value={config.version}
                    onChange={(e) => handleConfigChange('version', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this tool does and how it helps users..."
                  value={config.description}
                  onChange={(e) => handleConfigChange('description', e.target.value)}
                  className={errors.description ? 'border-red-500' : ''}
                  rows={3}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={config.category}
                    onValueChange={(value) => handleConfigChange('category', value)}
                  >
                    <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-sm text-red-500">{errors.category}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select
                    value={config.provider}
                    onValueChange={(value) => handleConfigChange('provider', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {config.provider === 'Custom' && (
                <div className="space-y-2">
                  <Label htmlFor="endpoint">Endpoint URL</Label>
                  <Input
                    id="endpoint"
                    placeholder="https://api.example.com/v1/tool"
                    value={config.endpoint || ''}
                    onChange={(e) => handleConfigChange('endpoint', e.target.value)}
                    className={errors.endpoint ? 'border-red-500' : ''}
                  />
                  {errors.endpoint && (
                    <p className="text-sm text-red-500">{errors.endpoint}</p>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="config" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rate_limit">Rate Limit (per minute)</Label>
                  <Input
                    id="rate_limit"
                    type="number"
                    placeholder="100"
                    value={config.rate_limit || ''}
                    onChange={(e) => handleConfigChange('rate_limit', parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    placeholder="30000"
                    value={config.timeout || ''}
                    onChange={(e) => handleConfigChange('timeout', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Public Tool</Label>
                    <p className="text-sm text-muted-foreground">
                      Make this tool available to all users
                    </p>
                  </div>
                  <Switch
                    checked={config.is_public}
                    onCheckedChange={(checked) => handleConfigChange('is_public', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Requires Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Admin approval needed before tool execution
                    </p>
                  </div>
                  <Switch
                    checked={config.requires_approval}
                    onCheckedChange={(checked) => handleConfigChange('requires_approval', checked)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="schema" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="schema">JSON Schema *</Label>
                <Textarea
                  id="schema"
                  placeholder="Enter the JSON schema for this tool's parameters..."
                  value={config.schema}
                  onChange={(e) => handleConfigChange('schema', e.target.value)}
                  className={`font-mono text-sm ${errors.schema ? 'border-red-500' : ''}`}
                  rows={12}
                />
                {errors.schema && (
                  <p className="text-sm text-red-500">{errors.schema}</p>
                )}
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">Example Schema</span>
                </div>
                <pre className="text-xs text-muted-foreground overflow-x-auto">
                  {exampleSchema}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="auth_type">Authentication Type</Label>
                <Select
                  value={config.auth_type}
                  onValueChange={(value) => handleConfigChange('auth_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {authTypes.map((auth) => (
                      <SelectItem key={auth.value} value={auth.value}>
                        {auth.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Required Permissions</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., analytics.read"
                    value={newPermission}
                    onChange={(e) => setNewPermission(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPermission()}
                  />
                  <Button type="button" variant="outline" onClick={addPermission}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {config.permissions.map((permission) => (
                    <Badge
                      key={permission}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <Key className="h-3 w-3" />
                      {permission}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePermission(permission)}
                        className="h-4 w-4 p-0 hover:bg-transparent"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>

              {config.auth_type !== 'none' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800 dark:text-yellow-300">
                        Authentication Configuration Required
                      </p>
                      <p className="text-yellow-700 dark:text-yellow-400 mt-1">
                        Additional authentication settings will be configured after tool creation.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Create Tool
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}