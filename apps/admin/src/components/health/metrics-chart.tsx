'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const latencyData = [
  { time: '00:00', value: 45 },
  { time: '04:00', value: 52 },
  { time: '08:00', value: 78 },
  { time: '12:00', value: 124 },
  { time: '16:00', value: 89 },
  { time: '20:00', value: 67 },
  { time: '24:00', value: 45 },
];

const errorData = [
  { time: '00:00', value: 0.1 },
  { time: '04:00', value: 0.2 },
  { time: '08:00', value: 0.5 },
  { time: '12:00', value: 0.8 },
  { time: '16:00', value: 0.3 },
  { time: '20:00', value: 0.2 },
  { time: '24:00', value: 0.1 },
];

interface MetricsChartProps {
  metric: 'latency' | 'errors';
}

export function MetricsChart({ metric }: MetricsChartProps) {
  const data = metric === 'latency' ? latencyData : errorData;
  const color = metric === 'latency' ? '#8884d8' : '#ff7c7c';
  const formatter = metric === 'latency' 
    ? (value: number) => `${value}ms`
    : (value: number) => `${value}%`;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis
          dataKey="time"
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
          tickFormatter={formatter}
        />
        <Tooltip formatter={formatter} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}