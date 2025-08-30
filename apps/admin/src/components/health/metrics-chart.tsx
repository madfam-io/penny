'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const latencyData = [\n  { time: '00:00', value: 45 },\n  { time: '04:00', value: 52 },\n  { time: '08:00', value: 78 },\n  { time: '12:00', value: 124 },\n  { time: '16:00', value: 89 },\n  { time: '20:00', value: 67 },\n  { time: '24:00', value: 45 },
];

const errorData = [\n  { time: '00:00', value: 0.1 },\n  { time: '04:00', value: 0.2 },\n  { time: '08:00', value: 0.5 },\n  { time: '12:00', value: 0.8 },\n  { time: '16:00', value: 0.3 },\n  { time: '20:00', value: 0.2 },\n  { time: '24:00', value: 0.1 },
];

interface MetricsChartProps {
  metric: 'latency' | 'errors';
}

export function MetricsChart({ metric }: MetricsChartProps) {
  const data = metric === 'latency' ? latencyData : errorData;
  const color = metric === 'latency' ? '#8884d8' : '#ff7c7c';
  const formatter =
    metric === 'latency' ? (value: number) => `${value}ms` : (value: number) => `${value}%`;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>\n        <XAxis dataKey="time" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis\n          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatter}
        />
        <Tooltip formatter={formatter} />\n        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
