import React from 'react';
import { Card } from '../ui/card';
import { FileText, Download, Calendar, Filter } from 'lucide-react';

interface CustomReportsProps {
  tenantId?: string;
}

export const CustomReports: React.FC<CustomReportsProps> = ({ tenantId }) => {
  const reports = [
    {
      id: 'user-engagement',
      name: 'User Engagement Report',
      description: 'Detailed analysis of user behavior and engagement patterns',
      lastGenerated: '2024-01-15',
      status: 'ready'
    },
    {
      id: 'revenue-breakdown',
      name: 'Revenue Breakdown',
      description: 'Monthly revenue analysis by tenant and feature usage',
      lastGenerated: '2024-01-14',
      status: 'ready'
    },
    {
      id: 'api-usage',
      name: 'API Usage Report',
      description: 'Comprehensive API usage statistics and trends',
      lastGenerated: '2024-01-13',
      status: 'generating'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Custom Reports</h3>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
          <FileText className="w-4 h-4" />
          <span>Create Report</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <Card key={report.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <FileText className="w-8 h-8 text-blue-600" />
              <span className={`text-xs px-2 py-1 rounded font-medium ${
                report.status === 'ready' ? 'bg-green-100 text-green-800' :
                report.status === 'generating' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {report.status.toUpperCase()}
              </span>
            </div>
            <h4 className="font-semibold mb-2">{report.name}</h4>
            <p className="text-sm text-gray-600 mb-4">{report.description}</p>
            <p className="text-xs text-gray-500 mb-4">
              Last generated: {report.lastGenerated}
            </p>
            <div className="flex space-x-2">
              <button className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded flex items-center justify-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>Schedule</span>
              </button>
              <button className="flex-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded flex items-center justify-center space-x-1">
                <Download className="w-3 h-3" />
                <span>Download</span>
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};