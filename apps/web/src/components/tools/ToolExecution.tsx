import React, { useState } from 'react';
import { Play, Square, AlertCircle } from 'lucide-react';\nimport { ToolForm } from './ToolForm';\nimport { LoadingSpinner } from '../ui/LoadingSpinner';

interface ToolExecutionProps {
  tool: any;
  onComplete: (result: any) => void;
  onCancel: () => void;
}

export const ToolExecution: React.FC<ToolExecutionProps> = ({
  tool,
  onComplete,
  onCancel
}) => {
  const [executing, setExecuting] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const handleExecute = async (params: any) => {
    try {
      setExecuting(true);
      setError(null);
      setLogs(['Starting tool execution...']);

      const response = await fetch(`/api/tools/${tool.name}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',\n          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ params })
      });

      const result = await response.json();

      if (result.success) {
        setLogs(prev => [...prev, 'Execution completed successfully']);
        onComplete(result);
      } else {
        setError(result.error?.message || 'Execution failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  const handleCancel = async () => {
    if (executionId && executing) {
      try {\n        await fetch(`/api/tools/executions/${executionId}/cancel`, {
          method: 'POST',\n          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
      } catch (err) {
        console.error('Failed to cancel execution:', err);
      }
    }
    onCancel();
  };

  return (
    <div className="space-y-6">\n      <div className="border-b border-gray-200 pb-4">\n        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Execute {tool.displayName}
        </h3>
        {tool.config?.cost && (\n          <p className="text-sm text-orange-600">
            Cost: {tool.config.cost} credits
          </p>
        )}
      </div>

      {!executing ? (
        <ToolForm tool={tool} onSubmit={handleExecute} />
      ) : (\n        <div className="space-y-4">\n          <div className="flex items-center space-x-3">
            <LoadingSpinner />
            <span>Executing tool...</span>
          </div>
          \n          <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
            {logs.map((log, index) => (\n              <div key={index} className="text-sm text-gray-700">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (\n        <div className="bg-red-50 border border-red-200 rounded-lg p-4">\n          <div className="flex items-center space-x-2">\n            <AlertCircle className="text-red-500" size={20} />\n            <span className="text-red-800 font-medium">Execution Error</span>
          </div>\n          <p className="text-red-700 mt-2">{error}</p>
        </div>
      )}
\n      <div className="flex justify-end space-x-3">
        <button
          onClick={handleCancel}\n          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        {executing && executionId && (
          <button
            onClick={handleCancel}\n            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
          >
            <Square size={16} />
            <span>Stop Execution</span>
          </button>
        )}
      </div>
    </div>
  );
};