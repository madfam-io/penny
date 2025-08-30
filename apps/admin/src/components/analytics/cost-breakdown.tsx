'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const data = [
  { name: 'AI Models', value: 6060, color: '#0088FE' },
  { name: 'Infrastructure', value: 3200, color: '#00C49F' },
  { name: 'Storage', value: 1800, color: '#FFBB28' },
  { name: 'Bandwidth', value: 940, color: '#FF8042' },
  { name: 'Other', value: 500, color: '#8884D8' },
];

export function CostBreakdown() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}\n          cx="50%"\n          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}\n          fill="#8884d8"\n          dataKey="value"
        >
          {data.map((entry, index) => (\n            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>\n        <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
