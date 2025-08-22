'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const data = [
  { model: 'GPT-4', usage: 45000, cost: 2250 },
  { model: 'GPT-3.5', usage: 128000, cost: 1280 },
  { model: 'Claude 3', usage: 67000, cost: 1675 },
  { model: 'Claude 2', usage: 34000, cost: 510 },
  { model: 'Gemini Pro', usage: 23000, cost: 345 },
];

export function ModelUsage() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis
          dataKey="model"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value / 1000}k`}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === 'usage') return [`${(value / 1000).toFixed(1)}k requests`, 'Usage'];
            return [`$${value}`, 'Cost'];
          }}
        />
        <Bar dataKey="usage" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}