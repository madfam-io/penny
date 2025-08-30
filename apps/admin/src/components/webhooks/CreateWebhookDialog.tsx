'use client';

import { useState } from 'react';
import { Button } from '@penny/ui';
import { Input } from '@penny/ui';
import { Label } from '@penny/ui';
import { Textarea } from '@penny/ui';
import { Badge } from '@penny/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@penny/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@penny/ui';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@penny/ui';
import {
  Plus,
  Webhook,
  Globe,
  Key,
  Shield,
  TestTube,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';

interface CreateWebhookForm {
  name: string;
  url: string;
  description: string;
  events: string[];
  secret: string;
  timeout: number;
  retryAttempts: number;
  isActive: boolean;
  headers: Array<{ key: string; value: string }>;
}

const availableEvents = [
  { id: 'user.created', label: 'User Created', description: 'When a new user registers' },
  { id: 'user.updated', label: 'User Updated', description: 'When user profile is modified' },
  { id: 'user.deleted', label: 'User Deleted', description: 'When a user account is deleted' },
  { id: 'payment.succeeded', label: 'Payment Succeeded', description: 'When payment is successful' },
  { id: 'payment.failed', label: 'Payment Failed', description: 'When payment fails' },
  { id: 'subscription.created', label: 'Subscription Created', description: 'New subscription started' },
  { id: 'subscription.updated', label: 'Subscription Updated', description: 'Subscription modified' },
  { id: 'subscription.cancelled', label: 'Subscription Cancelled', description: 'Subscription ended' },
  { id: 'audit.log.created', label: 'Audit Log Created', description: 'New audit log entry' },
  { id: 'system.alert', label: 'System Alert', description: 'System-level alerts' },
  { id: 'user.login.failed', label: 'Login Failed', description: 'Failed authentication attempts' },
];

export function CreateWebhookDialog() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [form, setForm] = useState<CreateWebhookForm>({
    name: '',
    url: '',
    description: '',
    events: [],
    secret: '',
    timeout: 30,
    retryAttempts: 3,
    isActive: true,
    headers: [{ key: '', value: '' }],
  });

  const updateForm = (field: keyof CreateWebhookForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleEvent = (eventId: string) => {
    const newEvents = form.events.includes(eventId)
      ? form.events.filter(e => e !== eventId)
      : [...form.events, eventId];
    updateForm('events', newEvents);
  };

  const addHeader = () => {
    updateForm('headers', [...form.headers, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    updateForm('headers', form.headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...form.headers];
    newHeaders[index][field] = value;
    updateForm('headers', newHeaders);
  };

  const generateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    updateForm('secret', secret);
  };

  const testWebhook = async () => {
    if (!form.url) {
      setTestResult({ success: false, message: 'URL is required for testing' });
      return;
    }

    setTestResult(null);
    // Simulate test request
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock response
    const success = Math.random() > 0.3; // 70% success rate for demo
    setTestResult({
      success,
      message: success 
        ? 'Webhook endpoint responded successfully (200 OK)'
        : 'Connection failed: Timeout after 5 seconds'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate form
      if (!form.name || !form.url || form.events.length === 0) {
        alert('Please fill in all required fields');
        return;
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Creating webhook:', form);
      
      // Reset form and close dialog
      setForm({
        name: '',
        url: '',
        description: '',
        events: [],
        secret: '',
        timeout: 30,
        retryAttempts: 3,
        isActive: true,
        headers: [{ key: '', value: '' }],
      });
      setCurrentStep('basic');
      setTestResult(null);
      setOpen(false);
      
      // Show success message (you might want to use a toast here)
      alert('Webhook created successfully!');
    } catch (error) {
      console.error('Failed to create webhook:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = form.name && form.url && form.events.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Create New Webhook
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={currentStep} onValueChange={setCurrentStep}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="test">Test & Create</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Webhook Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., User Registration Handler"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">Endpoint URL *</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://api.example.com/webhook"
                      className="pl-10"
                      value={form.url}
                      onChange={(e) => updateForm('url', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of what this webhook does..."
                  rows={3}
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              <div className="space-y-2">
                <Label>Select Events to Subscribe *</Label>
                <p className="text-sm text-muted-foreground">
                  Choose which events will trigger this webhook
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
                {availableEvents.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-3 rounded-lg border"
                  >
                    <input
                      type="checkbox"
                      checked={form.events.includes(event.id)}
                      onChange={() => toggleEvent(event.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{event.label}</span>
                        <Badge variant="outline" className="text-xs font-mono">
                          {event.id}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              {form.events.length > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Selected Events ({form.events.length})
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.events.map(eventId => (
                      <Badge key={eventId} variant="secondary" className="text-xs">
                        {eventId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="1"
                    max="300"
                    value={form.timeout}
                    onChange={(e) => updateForm('timeout', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retryAttempts">Retry Attempts</Label>
                  <Input
                    id="retryAttempts"
                    type="number"
                    min="0"
                    max="10"
                    value={form.retryAttempts}
                    onChange={(e) => updateForm('retryAttempts', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret">Webhook Secret</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="secret"
                      placeholder="Optional signing secret"
                      className="pl-10 font-mono"
                      value={form.secret}
                      onChange={(e) => updateForm('secret', e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={generateSecret}>
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used to verify webhook authenticity via HMAC-SHA256 signature
                </p>
              </div>

              <div className="space-y-3">
                <Label>Custom Headers</Label>
                {form.headers.map((header, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Header name"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    />
                    <Input
                      placeholder="Header value"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                    />
                    {form.headers.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeHeader(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addHeader}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Header
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="test" className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium flex items-center gap-2 mb-3">
                    <TestTube className="h-4 w-4" />
                    Test Webhook Endpoint
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Send a test request to verify your endpoint is working correctly.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={testWebhook}>
                      Send Test Request
                    </Button>
                    {testResult && (
                      <div className={`flex items-center gap-2 text-sm ${
                        testResult.success ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {testResult.success ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        {testResult.message}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-3">Webhook Summary</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Name:</dt>
                      <dd>{form.name || 'Not set'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">URL:</dt>
                      <dd className="font-mono truncate max-w-xs">{form.url || 'Not set'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Events:</dt>
                      <dd>{form.events.length} selected</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Timeout:</dt>
                      <dd>{form.timeout}s</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Secret:</dt>
                      <dd>{form.secret ? 'Configured' : 'None'}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-900" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Create Webhook
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {currentStep !== 'test' && (
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const steps = ['basic', 'events', 'config', 'test'];
                  const currentIndex = steps.indexOf(currentStep);
                  if (currentIndex < steps.length - 1) {
                    setCurrentStep(steps[currentIndex + 1]);
                  }
                }}
                disabled={
                  (currentStep === 'basic' && (!form.name || !form.url)) ||
                  (currentStep === 'events' && form.events.length === 0)
                }
              >
                Next Step
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}