import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Users, UserCheck, UserX, TrendingUp } from 'lucide-react';
import { Card } from '../ui/card';

interface UserAnalyticsProps {
  tenantId?: string;
}

export const UserAnalytics: React.FC<UserAnalyticsProps> = ({ tenantId }) => {
  const [userMetrics, setUserMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user analytics data
    const fetchData = async () => {
      try {
        const params = tenantId ? `?tenantId=${tenantId}` : '';
        const response = await fetch(`/api/admin/analytics/users${params}`);
        if (response.ok) {
          const data = await response.json();
          setUserMetrics(data);
        }
      } catch (error) {
        console.error('Failed to fetch user analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tenantId]);

  if (loading) {
    return <div className="animate-pulse">Loading user analytics...</div>;
  }

  return (\n    <div className="space-y-6">
      {/* User Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">\n          <div className="flex items-center space-x-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>\n              <p className="text-2xl font-bold">12,345</p>
              <p className="text-sm text-gray-600">Total Users</p>
            </div>
          </div>
        </Card>\n        <Card className="p-4">
          <div className="flex items-center space-x-3">\n            <UserCheck className="w-8 h-8 text-green-600" />
            <div>\n              <p className="text-2xl font-bold">1,234</p>
              <p className="text-sm text-gray-600">Active Users</p>
            </div>
          </div>
        </Card>\n        <Card className="p-4">
          <div className="flex items-center space-x-3">\n            <UserX className="w-8 h-8 text-red-600" />
            <div>\n              <p className="text-2xl font-bold">23</p>
              <p className="text-sm text-gray-600">Churned Users</p>
            </div>
          </div>
        </Card>\n        <Card className="p-4">
          <div className="flex items-center space-x-3">\n            <TrendingUp className="w-8 h-8 text-purple-600" />
            <div>\n              <p className="text-2xl font-bold">15.2%</p>
              <p className="text-sm text-gray-600">Growth Rate</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">\n          <h3 className="text-lg font-semibold mb-4">User Growth Over Time</h3>
          <div className="h-64">\n            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[]}>\n                <CartesianGrid strokeDasharray="3 3" />\n                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />\n                <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
\n        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">User Retention</h3>\n          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[]}>\n                <CartesianGrid strokeDasharray="3 3" />\n                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />\n                <Bar dataKey="retention" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};