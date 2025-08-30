'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const data = [
  { name: 'Jan 1', total: 1200 },
  { name: 'Jan 5', total: 2100 },
  { name: 'Jan 10', total: 1800 },
  { name: 'Jan 15', total: 3200 },
  { name: 'Jan 20', total: 2800 },
  { name: 'Jan 25', total: 3500 },
  { name: 'Jan 30', total: 4200 },
];

export function Overview() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>\n        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis\n          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip />\n        <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
