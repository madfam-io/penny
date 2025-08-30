'use client';
\nimport { Progress } from '@penny/ui';

const metrics = [
  { name: 'CPU Usage', value: 72, unit: '%', status: 'warning' },
  { name: 'Memory Usage', value: 58, unit: '%', status: 'good' },
  { name: 'Disk Usage', value: 45, unit: '%', status: 'good' },
  { name: 'API Latency', value: 124, unit: 'ms', status: 'good' },
  { name: 'Error Rate', value: 0.3, unit: '%', status: 'good' },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'good':
      return 'text-green-600';
    case 'warning':
      return 'text-yellow-600';
    case 'critical':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

export function SystemHealth() {
  return (
    <div className="space-y-4">
      {metrics.map((metric) => (\n        <div key={metric.name} className="space-y-2">\n          <div className="flex items-center justify-between">\n            <span className="text-sm font-medium">{metric.name}</span>
            <span className={`text-sm ${getStatusColor(metric.status)}`}>
              {metric.value}
              {metric.unit}
            </span>
          </div>
          <Progress\n            value={metric.unit === '%' ? metric.value : (metric.value / 200) * 100}\n            className="h-2"
          />
        </div>
      ))}
    </div>
  );
}
