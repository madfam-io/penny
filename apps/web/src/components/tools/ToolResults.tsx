import React from 'react';

export const ToolResults = ({ results }: any) => {
  return (
    <div className="p-4 border rounded">
      <h3 className="font-semibold mb-2">Results</h3>
      <pre className="text-sm bg-gray-50 p-2 rounded overflow-auto">
        {JSON.stringify(results, null, 2)}
      </pre>
    </div>
  );
};

export default ToolResults;