import React from 'react';
import { Card } from '../ui/card';
import { Brain, TrendingUp, AlertTriangle } from 'lucide-react';

interface AIInsightsProps {
  tenantId?: string;
}

export const AIInsights: React.FC<AIInsightsProps> = ({ tenantId }) => {
  const insights = [
    {
      title: 'User Engagement Trend',
      description: 'User engagement has increased by 23% over the last 30 days',
      impact: 'high',
      confidence: 0.89,
      type: 'positive'
    },
    {
      title: 'Feature Adoption Opportunity',
      description: 'Code sandbox feature has low adoption rate among new users',
      impact: 'medium',
      confidence: 0.76,
      type: 'opportunity'
    },
    {
      title: 'Potential Churn Risk',
      description: 'Users with low API usage in first week have 67% churn probability',
      impact: 'high',
      confidence: 0.82,
      type: 'warning'
    }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'positive': return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'opportunity': return <Brain className="w-5 h-5 text-blue-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      default: return <Brain className="w-5 h-5 text-gray-600" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'positive': return 'border-l-green-500';
      case 'opportunity': return 'border-l-blue-500';
      case 'warning': return 'border-l-orange-500';
      default: return 'border-l-gray-500';
    }
  };

  return (\n    <div className="space-y-6">
      <div className="flex items-center justify-between">\n        <h3 className="text-lg font-semibold">AI-Powered Insights</h3>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Generate New Insights
        </button>
      </div>
\n      <div className="space-y-4">
        {insights.map((insight, index) => (
          <Card key={index} className={`p-6 border-l-4 ${getBorderColor(insight.type)}`}>
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                {getIcon(insight.type)}
              </div>\n              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">\n                  <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                  <div className="flex items-center space-x-2">\n                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                      insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {insight.impact.toUpperCase()} IMPACT
                    </span>\n                    <span className="text-xs text-gray-500">
                      {(insight.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>\n                <p className="text-gray-700">{insight.description}</p>
                <div className="mt-3 flex space-x-2">\n                  <button className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded">
                    View Details
                  </button>\n                  <button className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded">
                    Take Action
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};