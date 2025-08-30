import React, { createContext, useContext, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth, type User, type Tenant } from '../../hooks/useAuth';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors
        if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

export interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string, tenantName: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

function AuthContextProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  const contextValue: AuthContextType = {
    user: auth.user,
    tenant: auth.tenant,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    login: async (email: string, password: string, rememberMe = false) => {
      await auth.login({ email, password, rememberMe });
    },
    register: async (name: string, email: string, password: string, tenantName: string) => {
      await auth.register({ name, email, password, tenantName });
    },
    logout: auth.logout,
    changePassword: auth.changePassword,
    getAccessToken: auth.getAccessToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Root authentication provider that wraps the entire application
 * Provides both React Query client and authentication context
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContextProvider>{children}</AuthContextProvider>
    </QueryClientProvider>
  );
}