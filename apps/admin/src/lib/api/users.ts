'use client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'creator' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  tenantId: string;
  tenantName: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  emailVerified: boolean;
  mfaEnabled: boolean;
  avatar?: string;
  metadata?: {
    department?: string;
    jobTitle?: string;
    location?: string;
    phoneNumber?: string;
  };
}

export interface CreateUserRequest {
  name: string;
  email: string;
  role: User['role'];
  tenantId: string;
  metadata?: User['metadata'];
}

export interface UpdateUserRequest {
  name?: string;
  role?: User['role'];
  status?: User['status'];
  metadata?: User['metadata'];
}

export interface UsersListResponse {
  users: User[];
  totalCount: number;
  pageCount: number;
}

export interface UsersFilters {
  search?: string;
  role?: User['role'];
  status?: User['status'];
  tenantId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface UsersPagination {
  page: number;
  limit: number;
  sortBy?: 'name' | 'email' | 'createdAt' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
}

class UsersApiClient {
  private baseUrl = '/api/admin/users';

  async getUsers(
    pagination: UsersPagination,
    filters?: UsersFilters
  ): Promise<UsersListResponse> {
    const params = new URLSearchParams();
    
    // Pagination
    params.set('page', pagination.page.toString());
    params.set('limit', pagination.limit.toString());
    if (pagination.sortBy) params.set('sortBy', pagination.sortBy);
    if (pagination.sortOrder) params.set('sortOrder', pagination.sortOrder);
    
    // Filters
    if (filters?.search) params.set('search', filters.search);
    if (filters?.role) params.set('role', filters.role);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.tenantId) params.set('tenantId', filters.tenantId);
    if (filters?.createdAfter) params.set('createdAfter', filters.createdAfter.toISOString());
    if (filters?.createdBefore) params.set('createdBefore', filters.createdBefore.toISOString());
    
    const response = await fetch(`${this.baseUrl}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      ...data,
      users: data.users.map((user: any) => ({
        ...user,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined
      }))
    };
  }

  async getUser(id: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found');
      }
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    
    const user = await response.json();
    
    return {
      ...user,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined
    };
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to create user');
    }
    
    const user = await response.json();
    
    return {
      ...user,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined
    };
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to update user');
    }
    
    const user = await response.json();
    
    return {
      ...user,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined
    };
  }

  async deleteUser(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to delete user');
    }
  }

  async bulkAction(action: string, userIds: string[], data?: any): Promise<void> {
    const response = await fetch(`${this.baseUrl}/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        userIds,
        data
      }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `Failed to perform bulk ${action}`);
    }
  }

  async resetPassword(id: string): Promise<{ temporaryPassword: string }> {
    const response = await fetch(`${this.baseUrl}/${id}/reset-password`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to reset password');
    }
    
    return response.json();
  }

  async sendEmail(id: string, subject: string, message: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subject, message }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to send email');
    }
  }

  async getUserActivity(
    id: string,
    options?: { 
      type?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<any[]> {
    const params = new URLSearchParams();
    
    if (options?.type) params.set('type', options.type);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());
    if (options?.startDate) params.set('startDate', options.startDate.toISOString());
    if (options?.endDate) params.set('endDate', options.endDate.toISOString());
   
   const response = await fetch(`${this.baseUrl}/${id}/activity?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user activity: ${response.statusText}`);
    }
    
    return response.json();
  }

  async exportUsers(filters?: UsersFilters, format: 'csv' | 'json' = 'csv'): Promise<Blob> {
    const params = new URLSearchParams();
    params.set('format', format);
    
    if (filters?.search) params.set('search', filters.search);
    if (filters?.role) params.set('role', filters.role);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.tenantId) params.set('tenantId', filters.tenantId);
   
   const response = await fetch(`${this.baseUrl}/export?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to export users: ${response.statusText}`);
    }
    
    return response.blob();
  }
}

export const usersApi = new UsersApiClient();