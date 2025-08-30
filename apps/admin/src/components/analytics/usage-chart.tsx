'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const data = [
  { date: 'Jan 1', requests: 45000 },
  { date: 'Jan 5', requests: 52000 },
  { date: 'Jan 10', requests: 48000 },
  { date: 'Jan 15', requests: 61000 },
  { date: 'Jan 20', requests: 55000 },
  { date: 'Jan 25', requests: 67000 },
  { date: 'Jan 30', requests: 72000 },
];

export function UsageChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>\n          <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">\n            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />\n            <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
          </linearGradient>
        </defs>\n        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis\n          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value / 1000}k`}
        />
        <Tooltip />
        <Area\n          type="monotone"\n          dataKey="requests"\n          stroke="#8884d8"
          fillOpacity={1}\n          fill="url(#colorRequests)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
