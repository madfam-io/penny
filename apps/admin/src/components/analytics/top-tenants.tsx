'use client';

import { Progress } from '@penny/ui';

const tenants = [
  { name: 'Acme Corp', usage: 245000, percentage: 34 },
  { name: 'TechStart Inc', usage: 178000, percentage: 25 },
  { name: 'Digital Agency', usage: 123000, percentage: 17 },
  { name: 'CloudFirst', usage: 89000, percentage: 12 },
  { name: 'DataCo', usage: 67000, percentage: 9 },
  { name: 'Others', usage: 21000, percentage: 3 },
];

export function TopTenants() {
  return (
    <div className="space-y-4">
      {tenants.map((tenant) => (
        <div key={tenant.name} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{tenant.name}</span>
            <span className="text-sm text-muted-foreground">
              {(tenant.usage / 1000).toFixed(0)}k requests
            </span>
          </div>
          <Progress value={tenant.percentage} className="h-2" />
        </div>
      ))}
    </div>
  );
}