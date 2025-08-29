'use client';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: 'active' | 'inactive' | 'suspended' | 'trial';
  plan: 'starter' | 'professional' | 'enterprise' | 'trial';
  userCount: number;
  maxUsers: number;
  billingEmail?: string;
  adminEmail?: string;
  createdAt: Date;
  updatedAt: Date;
  trialEndsAt?: Date;
  settings: {
    allowSignups: boolean;
    requireEmailVerification: boolean;
    enableMFA: boolean;
    maxFileSize: number; // MB
    retentionDays: number;
    customBranding?: {
      logo?: string;
      primaryColor?: string;
      accentColor?: string;
    };
  };
  usage: {
    storageUsed: number; // GB
    storageLimit: number; // GB
    apiCalls: number;
    apiLimit: number;
    messagesThisMonth: number;
    messagesLimit?: number;
  };
  billing?: {
    subscriptionId?: string;
    nextBillingDate?: Date;
    amount?: number;
    currency?: string;
    paymentMethod?: string;
  };
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  domain?: string;
  plan: Tenant['plan'];
  adminEmail: string;
  billingEmail?: string;
  maxUsers?: number;
  settings?: Partial<Tenant['settings']>;
}

export interface UpdateTenantRequest {
  name?: string;
  domain?: string;
  status?: Tenant['status'];
  plan?: Tenant['plan'];
  billingEmail?: string;
  adminEmail?: string;
  maxUsers?: number;
  settings?: Partial<Tenant['settings']>;
}

export interface TenantsListResponse {
  tenants: Tenant[];
  totalCount: number;
  pageCount: number;
}

export interface TenantsFilters {
  search?: string;
  status?: Tenant['status'];
  plan?: Tenant['plan'];
  createdAfter?: Date;
  createdBefore?: Date;
  hasOverage?: boolean;
}

export interface TenantsPagination {
  page: number;
  limit: number;
  sortBy?: 'name' | 'userCount' | 'createdAt' | 'storageUsed';
  sortOrder?: 'asc' | 'desc';
}

class TenantsApiClient {
  private baseUrl = '/api/admin/tenants';

  async getTenants(
    pagination: TenantsPagination,
    filters?: TenantsFilters
  ): Promise<TenantsListResponse> {
    const params = new URLSearchParams();
    
    // Pagination
    params.set('page', pagination.page.toString());
    params.set('limit', pagination.limit.toString());
    if (pagination.sortBy) params.set('sortBy', pagination.sortBy);
    if (pagination.sortOrder) params.set('sortOrder', pagination.sortOrder);
    
    // Filters
    if (filters?.search) params.set('search', filters.search);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.plan) params.set('plan', filters.plan);
    if (filters?.createdAfter) params.set('createdAfter', filters.createdAfter.toISOString());
    if (filters?.createdBefore) params.set('createdBefore', filters.createdBefore.toISOString());
    if (filters?.hasOverage) params.set('hasOverage', filters.hasOverage.toString());
    
    const response = await fetch(`${this.baseUrl}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tenants: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      ...data,
      tenants: data.tenants.map((tenant: any) => ({
        ...tenant,
        createdAt: new Date(tenant.createdAt),
        updatedAt: new Date(tenant.updatedAt),
        trialEndsAt: tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : undefined,
        billing: tenant.billing ? {
          ...tenant.billing,
          nextBillingDate: tenant.billing.nextBillingDate 
            ? new Date(tenant.billing.nextBillingDate) 
            : undefined
        } : undefined
      }))
    };
  }

  async getTenant(id: string): Promise<Tenant> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Tenant not found');
      }
      throw new Error(`Failed to fetch tenant: ${response.statusText}`);
    }
    
    const tenant = await response.json();
    
    return {
      ...tenant,
      createdAt: new Date(tenant.createdAt),
      updatedAt: new Date(tenant.updatedAt),
      trialEndsAt: tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : undefined,
      billing: tenant.billing ? {
        ...tenant.billing,
        nextBillingDate: tenant.billing.nextBillingDate 
          ? new Date(tenant.billing.nextBillingDate) 
          : undefined
      } : undefined
    };
  }

  async createTenant(data: CreateTenantRequest): Promise<Tenant> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to create tenant');
    }
    
    const tenant = await response.json();
    
    return {
      ...tenant,
      createdAt: new Date(tenant.createdAt),
      updatedAt: new Date(tenant.updatedAt),
      trialEndsAt: tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : undefined
    };
  }

  async updateTenant(id: string, data: UpdateTenantRequest): Promise<Tenant> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to update tenant');
    }
    
    const tenant = await response.json();
    
    return {
      ...tenant,
      createdAt: new Date(tenant.createdAt),
      updatedAt: new Date(tenant.updatedAt),
      trialEndsAt: tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : undefined,
      billing: tenant.billing ? {
        ...tenant.billing,
        nextBillingDate: tenant.billing.nextBillingDate 
          ? new Date(tenant.billing.nextBillingDate) 
          : undefined
      } : undefined
    };
  }

  async deleteTenant(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to delete tenant');
    }
  }

  async getTenantUsers(
    id: string,
    pagination?: { page: number; limit: number }
  ): Promise<{ users: any[]; totalCount: number }> {
    const params = new URLSearchParams();
    if (pagination) {
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());
    }
    
    const response = await fetch(`${this.baseUrl}/${id}/users?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tenant users: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getTenantUsage(
    id: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      granularity?: 'day' | 'week' | 'month';
    }
  ): Promise<any> {
    const params = new URLSearchParams();
    
    if (options?.startDate) params.set('startDate', options.startDate.toISOString());
    if (options?.endDate) params.set('endDate', options.endDate.toISOString());
    if (options?.granularity) params.set('granularity', options.granularity);
    
    const response = await fetch(`${this.baseUrl}/${id}/usage?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tenant usage: ${response.statusText}`);
    }
    
    return response.json();
  }

  async getTenantBilling(id: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${id}/billing`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tenant billing: ${response.statusText}`);
    }
    
    return response.json();
  }

  async updateTenantBilling(
    id: string,
    data: {
      plan?: Tenant['plan'];
      maxUsers?: number;
      billingEmail?: string;
      paymentMethod?: string;
    }
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}/billing`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to update tenant billing');
    }
  }

  async suspendTenant(id: string, reason?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to suspend tenant');
    }
  }

  async reactivateTenant(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}/reactivate`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to reactivate tenant');
    }
  }

  async exportTenants(filters?: TenantsFilters, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const params = new URLSearchParams();
    params.set('format', format);
    
    if (filters?.search) params.set('search', filters.search);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.plan) params.set('plan', filters.plan);
    
    const response = await fetch(`${this.baseUrl}/export?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to export tenants: ${response.statusText}`);
    }
    
    return response.blob();
  }
}

export const tenantsApi = new TenantsApiClient();