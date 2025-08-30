'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@penny/ui';

// Dynamically import recharts with no SSR
const ResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import('recharts').then((mod) => mod.Line),
  { ssr: false }
);
const XAxis = dynamic(
  () => import('recharts').then((mod) => mod.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import('recharts').then((mod) => mod.YAxis),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import('recharts').then((mod) => mod.Tooltip),
  { ssr: false }
);

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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-[350px]">
        <div className="flex flex-col items-center space-y-2">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">Loading chart...</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip />
        <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
