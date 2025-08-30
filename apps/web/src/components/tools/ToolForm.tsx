import React from 'react';

export const ToolForm = ({ tool, onSubmit }: any) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="p-4 border rounded">
        <h3 className="font-semibold mb-2">{tool?.name || 'Tool Form'}</h3>
        <p className="text-sm text-gray-600">Configure tool parameters</p>
      </div>
      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Execute
      </button>
    </form>
  );
};

export default ToolForm;