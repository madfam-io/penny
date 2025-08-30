'use client';

import { useState } from 'react';
import { Button } from '@penny/ui';
import { Input } from '@penny/ui';
import { Label } from '@penny/ui';
import { Textarea } from '@penny/ui';
import { Badge } from '@penny/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@penny/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@penny/ui';
import {
  TestTube,
  Play,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Globe,
  Code,
  FileText,
} from 'lucide-react';

interface TestRequest {
  webhook: string;
  event: string;
  payload: string;
  headers: Record<string, string>;
}

interface TestResult {
  success: boolean;
  status: number;
  statusText: string;
  responseTime: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  timestamp: Date;
  error?: string;
}

const samplePayloads = {
  'user.created': JSON.stringify({
    event: 'user.created',
    timestamp: '2024-08-30T14:30:00Z',
    data: {
      user: {
        id: 'usr_123456',
        email: 'john.doe@example.com',
        name: 'John Doe',
        created_at: '2024-08-30T14:30:00Z',
        tenant_id: 'tenant_001'
      }
    }
  }, null, 2),
  'payment.succeeded': JSON.stringify({
    event: 'payment.succeeded',
    timestamp: '2024-08-30T14:30:00Z',
    data: {
      payment: {
        id: 'pay_123456',
        amount: 2999,
        currency: 'USD',
        status: 'succeeded',
        customer_id: 'cust_123456',
        created_at: '2024-08-30T14:30:00Z'
      }
    }
  }, null, 2),
  'subscription.cancelled': JSON.stringify({
    event: 'subscription.cancelled',
    timestamp: '2024-08-30T14:30:00Z',
    data: {
      subscription: {
        id: 'sub_123456',
        customer_id: 'cust_123456',
        status: 'cancelled',
        cancelled_at: '2024-08-30T14:30:00Z',
        plan_id: 'plan_premium'
      }
    }
  }, null, 2),
};

// Mock webhooks data
const mockWebhooks = [
  { id: 'wh_001', name: 'User Registration Notifications', url: 'https://api.acme.com/webhooks/user-events' },
  { id: 'wh_002', name: 'Payment Processing', url: 'https://billing.acme.com/webhook-handler' },
  { id: 'wh_003', name: 'Audit Log Sync', url: 'https://logs.security.acme.com/ingest' },
  { id: 'wh_004', name: 'Slack Notifications', url: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX' },
];

export function WebhookTester() {
  const [testRequest, setTestRequest] = useState<TestRequest>({
    webhook: '',
    event: 'user.created',
    payload: samplePayloads['user.created'],
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Penny-Webhook/1.0',
    },
  });

  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const updateRequest = (field: keyof TestRequest, value: any) => {
    setTestRequest(prev => ({ ...prev, [field]: value }));
  };

  const handleEventChange = (event: string) => {
    updateRequest('event', event);
    if (samplePayloads[event as keyof typeof samplePayloads]) {
      updateRequest('payload', samplePayloads[event as keyof typeof samplePayloads]);
    }
  };

  const handleWebhookChange = (webhookId: string) => {
    const webhook = mockWebhooks.find(w => w.id === webhookId);
    updateRequest('webhook', webhookId);
  };

  const addHeader = () => {
    const key = prompt('Header name:');
    const value = prompt('Header value:');
    if (key && value) {
      updateRequest('headers', {
        ...testRequest.headers,
        [key]: value,
      });
    }
  };

  const removeHeader = (key: string) => {
    const { [key]: removed, ...rest } = testRequest.headers;
    updateRequest('headers', rest);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const sendTestRequest = async () => {
    if (!testRequest.webhook) {
      alert('Please select a webhook to test');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Mock response - randomly succeed or fail for demo
      const success = Math.random() > 0.2; // 80% success rate
      const responseTime = Math.floor(200 + Math.random() * 800);

      if (success) {
        setTestResult({
          success: true,
          status: 200,
          statusText: 'OK',
          responseTime,
          responseHeaders: {
            'Content-Type': 'application/json',
            'Server': 'nginx/1.18.0',
            'Date': new Date().toUTCString(),
          },
          responseBody: JSON.stringify({ received: true, processed: true }, null, 2),
          timestamp: new Date(),
        });
      } else {
        // Random error scenarios
        const errors = [
          { status: 404, statusText: 'Not Found', error: 'Webhook endpoint not found' },
          { status: 500, statusText: 'Internal Server Error', error: 'Server encountered an error' },
          { status: 408, statusText: 'Request Timeout', error: 'Request timed out after 30 seconds' },
          { status: 401, statusText: 'Unauthorized', error: 'Invalid or missing authentication' },
        ];
        const error = errors[Math.floor(Math.random() * errors.length)];

        setTestResult({
          success: false,
          status: error.status,
          statusText: error.statusText,
          responseTime,
          responseHeaders: {
            'Content-Type': 'application/json',
            'Server': 'nginx/1.18.0',
            'Date': new Date().toUTCString(),
          },
          responseBody: JSON.stringify({ error: error.error }, null, 2),
          timestamp: new Date(),
          error: error.error,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        status: 0,
        statusText: 'Network Error',
        responseTime: 0,
        responseHeaders: {},
        responseBody: '',
        timestamp: new Date(),
        error: 'Failed to connect to webhook endpoint',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const formatPayload = () => {
    try {
      const parsed = JSON.parse(testRequest.payload);
      updateRequest('payload', JSON.stringify(parsed, null, 2));
    } catch (error) {
      alert('Invalid JSON payload');
    }
  };

  const selectedWebhook = mockWebhooks.find(w => w.id === testRequest.webhook);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Test Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-select">Webhook</Label>
              <Select value={testRequest.webhook} onValueChange={handleWebhookChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a webhook to test" />
                </SelectTrigger>
                <SelectContent>
                  {mockWebhooks.map((webhook) => (
                    <SelectItem key={webhook.id} value={webhook.id}>
                      {webhook.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedWebhook && (
                <div className="text-xs text-muted-foreground font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded">
                  {selectedWebhook.url}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-select">Event Type</Label>
              <Select value={testRequest.event} onValueChange={handleEventChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user.created">user.created</SelectItem>
                  <SelectItem value="user.updated">user.updated</SelectItem>
                  <SelectItem value="payment.succeeded">payment.succeeded</SelectItem>
                  <SelectItem value="payment.failed">payment.failed</SelectItem>
                  <SelectItem value="subscription.cancelled">subscription.cancelled</SelectItem>
                  <SelectItem value="audit.log.created">audit.log.created</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="payload">Payload</Label>
                <Button type="button" variant="outline" size="sm" onClick={formatPayload}>
                  <Code className="h-3 w-3 mr-1" />
                  Format JSON
                </Button>
              </div>
              <Textarea
                id="payload"
                rows={12}
                className="font-mono text-xs"
                value={testRequest.payload}
                onChange={(e) => updateRequest('payload', e.target.value)}
                placeholder="Enter JSON payload..."
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Headers</Label>
                <Button type="button" variant="outline" size="sm" onClick={addHeader}>
                  Add Header
                </Button>
              </div>
              <div className="space-y-2">
                {Object.entries(testRequest.headers).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Input
                      value={key}
                      onChange={(e) => {
                        const { [key]: oldValue, ...rest } = testRequest.headers;
                        updateRequest('headers', { ...rest, [e.target.value]: value });
                      }}
                      placeholder="Header name"
                      className="font-mono text-xs"
                    />
                    <Input
                      value={value}
                      onChange={(e) => {
                        updateRequest('headers', { ...testRequest.headers, [key]: e.target.value });
                      }}
                      placeholder="Header value"
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeHeader(key)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={sendTestRequest}
              disabled={!testRequest.webhook || isTesting}
              className="w-full"
            >
              {isTesting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-900 mr-2" />
                  Sending Request...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Send Test Request
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Response Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!testResult && !isTesting && (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Send a test request to see the response</p>
              </div>
            )}

            {isTesting && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto mb-4" />
                <p className="text-muted-foreground">Sending request...</p>
              </div>
            )}

            {testResult && (
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`font-medium ${
                      testResult.success ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {testResult.status} {testResult.statusText}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {testResult.responseTime}ms
                  </div>
                </div>

                {/* Response Headers */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Response Headers</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(
                        Object.entries(testResult.responseHeaders)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join('\n'),
                        'headers'
                      )}
                    >
                      {copiedField === 'headers' ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-xs font-mono">
                    {Object.entries(testResult.responseHeaders).map(([key, value]) => (
                      <div key={key}>{key}: {value}</div>
                    ))}
                  </div>
                </div>

                {/* Response Body */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">Response Body</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(testResult.responseBody, 'body')}
                    >
                      {copiedField === 'body' ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-xs font-mono max-h-64 overflow-y-auto">
                    <pre>{testResult.responseBody || '(empty)'}</pre>
                  </div>
                </div>

                {/* Error Details */}
                {testResult.error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                    <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">Error Details</span>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {testResult.error}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}