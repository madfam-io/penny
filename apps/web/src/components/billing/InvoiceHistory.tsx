import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Download, 
  Eye, 
  Calendar, 
  DollarSign,
  FileText,
  ExternalLink,
  Filter,
  Search
} from 'lucide-react';

interface Invoice {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  period_start: string;
  period_end: string;
  due_date: string;
  paid_at?: string;
  pdf_url?: string;
  hosted_url?: string;
  created_at: string;
}

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_amount: number;
  amount: number;
  usage_type?: string;
  period_start?: string;
  period_end?: string;
}

export const InvoiceHistory: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/billing/invoices?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch invoices');

      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (err) {
      setError('Failed to load invoices');
      console.error('Invoice fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceDetails = async (invoiceId: string) => {
    try {
      setLoadingDetails(true);
      const response = await fetch(`/api/billing/invoices/${invoiceId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      if (!response.ok) throw new Error('Failed to fetch invoice details');

      const data = await response.json();
      setSelectedInvoice(data.invoice);
      setLineItems(data.line_items || []);
    } catch (err) {
      setError('Failed to load invoice details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const downloadInvoicePDF = async (invoice: Invoice) => {
    if (invoice.pdf_url) {
      window.open(invoice.pdf_url, '_blank');
    } else {
      // Generate PDF if not available
      try {
        const response = await fetch(`/api/billing/invoices/${invoice.id}/pdf`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `invoice-${invoice.number}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }
      } catch (err) {
        console.error('PDF download error:', err);
      }
    }
  };

  const viewInvoiceDetails = (invoice: Invoice) => {
    fetchInvoiceDetails(invoice.id);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
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
      case 'paid': return 'bg-green-100 text-green-800';
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'void': return 'bg-red-100 text-red-800';
      case 'uncollectible': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    if (searchTerm) {
      return invoice.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
             invoice.status.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
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
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoice History</h2>
          <p className="text-gray-600">View and manage your billing invoices</p>
        </div>
        
        <div className="flex space-x-3">
          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="open">Open</option>
            <option value="draft">Draft</option>
            <option value="void">Void</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-red-800">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Invoices ({filteredInvoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No invoices found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold">{invoice.number}</h3>
                              <Badge className={getStatusColor(invoice.status)}>
                                {invoice.status}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                              <span className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {formatDate(invoice.created_at)}
                              </span>
                              <span className="flex items-center">
                                <DollarSign className="h-4 w-4 mr-1" />
                                {formatCurrency(invoice.total, invoice.currency)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewInvoiceDetails(invoice)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {invoice.pdf_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadInvoicePDF(invoice)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {invoice.hosted_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(invoice.hosted_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Invoice period and amounts */}
                      <div className="mt-3 pt-3 border-t text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">
                            Period: {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                          </span>
                          {invoice.amount_due > 0 && (
                            <span className="text-red-600 font-medium">
                              Due: {formatCurrency(invoice.amount_due, invoice.currency)}
                            </span>
                          )}
                        </div>
                        
                        {invoice.paid_at && (
                          <div className="text-green-600 text-xs mt-1">
                            Paid on {formatDate(invoice.paid_at)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Invoice Details */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>
                {selectedInvoice ? `Invoice ${selectedInvoice.number}` : 'Select an invoice to view details'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDetails ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : selectedInvoice ? (
                <div className="space-y-4">
                  {/* Invoice Summary */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status</span>
                      <Badge className={getStatusColor(selectedInvoice.status)}>
                        {selectedInvoice.status}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created</span>
                      <span>{formatDate(selectedInvoice.created_at)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Due Date</span>
                      <span>{formatDate(selectedInvoice.due_date)}</span>
                    </div>
                    
                    {selectedInvoice.paid_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Paid Date</span>
                        <span className="text-green-600">{formatDate(selectedInvoice.paid_at)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Amount Breakdown</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span>{formatCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
                      </div>
                      
                      {selectedInvoice.tax > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax</span>
                          <span>{formatCurrency(selectedInvoice.tax, selectedInvoice.currency)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Total</span>
                        <span>{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</span>
                      </div>
                      
                      {selectedInvoice.amount_due > 0 && (
                        <div className="flex justify-between text-red-600 font-semibold">
                          <span>Amount Due</span>
                          <span>{formatCurrency(selectedInvoice.amount_due, selectedInvoice.currency)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Line Items */}
                  {lineItems.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">Line Items</h4>
                      <div className="space-y-3">
                        {lineItems.map((item) => (
                          <div key={item.id} className="border rounded p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{item.description}</div>
                                {item.usage_type && (
                                  <div className="text-xs text-gray-600 capitalize">
                                    {item.usage_type.replace('_', ' ')} usage
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">
                                  {formatCurrency(item.amount, selectedInvoice.currency)}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {item.quantity} × {formatCurrency(item.unit_amount, selectedInvoice.currency)}
                                </div>
                              </div>
                            </div>
                            
                            {item.period_start && item.period_end && (
                              <div className="text-xs text-gray-600 border-t pt-2">
                                Period: {formatDate(item.period_start)} - {formatDate(item.period_end)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="border-t pt-4 space-y-2">
                    {selectedInvoice.pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadInvoicePDF(selectedInvoice)}
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                    )}
                    
                    {selectedInvoice.hosted_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(selectedInvoice.hosted_url, '_blank')}
                        className="w-full"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View in Stripe
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Select an invoice to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};