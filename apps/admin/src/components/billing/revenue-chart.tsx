'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

const data = [
  { month: 'Jan', mrr: 98000, newMrr: 8000, churnedMrr: 2000 },
  { month: 'Feb', mrr: 102000, newMrr: 9000, churnedMrr: 5000 },
  { month: 'Mar', mrr: 108000, newMrr: 12000, churnedMrr: 6000 },
  { month: 'Apr', mrr: 115000, newMrr: 15000, churnedMrr: 8000 },
  { month: 'May', mrr: 118000, newMrr: 10000, churnedMrr: 7000 },
  { month: 'Jun', mrr: 124550, newMrr: 14000, churnedMrr: 7450 },
];

export function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
        <Legend />
        <Bar dataKey="mrr" name="Total MRR" fill="#8884d8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="newMrr" name="New MRR" fill="#82ca9d" radius={[4, 4, 0, 0]} />
        <Bar dataKey="churnedMrr" name="Churned MRR" fill="#ff7c7c" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
