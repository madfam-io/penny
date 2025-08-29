import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { DataTable } from '../common/DataTable';
import { 
  DollarSign,
  CreditCard,
  AlertTriangle,
  Users,
  Calendar,
  TrendingUp,
  Search,
  Filter
} from 'lucide-react';

interface CustomerBillingData {
  id: string;
  tenant_name: string;
  email: string;
  total_spent: number;
  current_plan: string;
  subscription_status: string;
  last_payment: string;
  next_billing: string;
  payment_method: string;
  failed_payments: number;
  created_at: string;
}

export const CustomerBilling: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerBillingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  useEffect(() => {
    fetchCustomerBillingData();
  }, [planFilter]);

  const fetchCustomerBillingData = async () => {
    try {
      setLoading(true);
      
      // Mock data for now
      const mockData: CustomerBillingData[] = [
        {
          id: '1',
          tenant_name: 'Acme Corp',
          email: 'admin@acme.com',
          total_spent: 2850,
          current_plan: 'Enterprise',
          subscription_status: 'active',
          last_payment: '2024-01-15',
          next_billing: '2024-02-15',
          payment_method: 'Visa ****4242',
          failed_payments: 0,
          created_at: '2023-06-15'
        },
        {
          id: '2',
          tenant_name: 'TechStart Inc',
          email: 'billing@techstart.io',
          total_spent: 1450,
          current_plan: 'Pro',
          subscription_status: 'active',
          last_payment: '2024-01-12',
          next_billing: '2024-02-12',
          payment_method: 'MasterCard ****1234',
          failed_payments: 0,
          created_at: '2023-08-22'
        },
        {
          id: '3',
          tenant_name: 'DataFlow LLC',
          email: 'ops@dataflow.com',
          total_spent: 890,
          current_plan: 'Pro',
          subscription_status: 'past_due',
          last_payment: '2023-12-10',
          next_billing: '2024-01-10',
          payment_method: 'Visa ****5678',
          failed_payments: 2,
          created_at: '2023-09-05'
        }
      ];
      
      setCustomers(mockData);
    } catch (err) {
      console.error('Customer billing data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trialing': return 'bg-blue-100 text-blue-800';
      case 'past_due': return 'bg-yellow-100 text-yellow-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const columns = [
    {
      header: 'Customer',
      accessorKey: 'tenant_name',
      cell: ({ row }: any) => (
        <div>
          <div className="font-medium text-gray-900">{row.original.tenant_name}</div>
          <div className="text-sm text-gray-600">{row.original.email}</div>
        </div>
      ),
    },
    {
      header: 'Plan',
      accessorKey: 'current_plan',
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.original.current_plan}</Badge>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'subscription_status',
      cell: ({ row }: any) => (
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(row.original.subscription_status)}>
            {row.original.subscription_status}
          </Badge>
          {row.original.failed_payments > 0 && (
            <AlertTriangle className="h-4 w-4 text-red-500" title={`${row.original.failed_payments} failed payments`} />
          )}
        </div>
      ),
    },
    {
      header: 'Total Spent',
      accessorKey: 'total_spent',
      cell: ({ row }: any) => (
        <div className="font-medium">{formatCurrency(row.original.total_spent)}</div>
      ),
    },
    {
      header: 'Payment Method',
      accessorKey: 'payment_method',
      cell: ({ row }: any) => (
        <div className="text-sm">{row.original.payment_method}</div>
      ),
    },
    {
      header: 'Next Billing',
      accessorKey: 'next_billing',
      cell: ({ row }: any) => (
        <div className="text-sm">{formatDate(row.original.next_billing)}</div>
      ),
    },
  ];

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = planFilter === 'all' || customer.current_plan.toLowerCase() === planFilter;
    return matchesSearch && matchesPlan;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(customers.reduce((sum, c) => sum + c.total_spent, 0))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {customers.filter(c => c.failed_payments > 0).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Spend</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(customers.reduce((sum, c) => sum + c.total_spent, 0) / customers.length)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Customer Billing</CardTitle>
              <CardDescription>
                Manage customer billing information and payment history
              </CardDescription>
            </div>
            
            <div className="flex space-x-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Plans</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={filteredCustomers}
            searchPlaceholder="Search customers..."
          />
        </CardContent>
      </Card>
    </div>
  );
};