import React, { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRequireAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  requiredRoles?: string[];
  fallback?: ReactNode;
}

/**
 * Component that protects routes requiring authentication
 * Redirects unauthenticated users to login page
 * Optionally checks for required roles
 */
export function ProtectedRoute({ 
  children,
 redirectTo = '/auth/login',
  requiredRoles = [],
  fallback
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, requireAuth } = useRequireAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return fallback || <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (requireAuth) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Check role-based access if roles are specified
  if (isAuthenticated && requiredRoles.length > 0 && user) {
    const hasRequiredRole = requiredRoles.some(role => 
      user.roles.includes(role)
    );
    
    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h1>
            <p className="text-gray-600 mb-6">
              You don't have permission to access this page.
            </p>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

/**
 * HOC version of ProtectedRoute for wrapping components
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<ProtectedRouteProps, 'children'> = {}
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

/**
 * Component that only renders children if user is NOT authenticated
 * Useful for login/register pages
 */
export function GuestOnlyRoute({ 
  children,
 redirectTo = '/dashboard' 
}: { 
  children: ReactNode;
  redirectTo?: string;
}) {
  const { isAuthenticated, isLoading } = useRequireAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}