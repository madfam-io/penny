import React from 'react';

const ChartRenderer = ({ data }: any) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Chart</h3>
      <div className="border rounded p-4 bg-gray-50">
        <p>Chart visualization will be displayed here</p>
        <pre className="text-xs mt-2">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
};

export default ChartRenderer;