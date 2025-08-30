import React from 'react';\nimport { Card } from '../ui/card';

interface UsageAnalyticsProps {
  tenantId?: string;
}

export const UsageAnalytics: React.FC<UsageAnalyticsProps> = ({ tenantId }) => {
  return (
    <div className="space-y-6">\n      <Card className="p-6">\n        <h3 className="text-lg font-semibold mb-4">API Usage Analytics</h3>\n        <p className="text-gray-600">Usage analytics implementation would go here...</p>
      </Card>
    </div>
  );
};