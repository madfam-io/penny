import React, { useState } from 'react';
import { Play, Square, AlertCircle } from 'lucide-react';
import { ToolForm } from './ToolForm';
import { LoadingSpinner } from '../ui/LoadingSpinner';

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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
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
      try {
        await fetch(`/api/tools/executions/${executionId}/cancel`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
      } catch (err) {
        console.error('Failed to cancel execution:', err);
      }
    }
    onCancel();
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
<h3 className="text-lg font-semibold text-gray-900 mb-2">
          Execute {tool.displayName}
        </h3>
        {tool.config?.cost && (
<p className="text-sm text-orange-600">
            Cost: {tool.config.cost} credits
          </p>
        )}
      </div>

      {!executing ? (
        <ToolForm tool={tool} onSubmit={handleExecute} />
      ) : (
<div className="space-y-4">
          <div className="flex items-center space-x-3">
            <LoadingSpinner />
            <span>Executing tool...</span>
          </div>
         
         <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
            {logs.map((log, index) => (
<div key={index} className="text-sm text-gray-700">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
<AlertCircle className="text-red-500" size={20} />
            <span className="text-red-800 font-medium">Execution Error</span>
          </div>
<p className="text-red-700 mt-2">{error}</p>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          onClick={handleCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        {executing && executionId && (
          <button
            onClick={handleCancel}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
          >
            <Square size={16} />
            <span>Stop Execution</span>
          </button>
        )}
      </div>
    </div>
  );
};