// Authentication components and hooks
export { AuthProvider, useAuthContext, type AuthContextType } from './AuthProvider';
export { ProtectedRoute, GuestOnlyRoute, withAuth, type ProtectedRouteProps } from './ProtectedRoute';
export { SessionManager, type SessionManagerProps } from './SessionManager';

// Re-export hooks for convenience
export { useAuth, useRequireAuth, useSession } from '../../hooks/useAuth';
export type { User, Tenant, AuthState, LoginData, RegisterData, AuthResponse } from '../../hooks/useAuth';

// Re-export auth pages
export { LoginPage } from '../../pages/auth/LoginPage';
export { RegisterPage } from '../../pages/auth/RegisterPage';
export { ForgotPasswordPage } from '../../pages/auth/ForgotPasswordPage';
export { ResetPasswordPage } from '../../pages/auth/ResetPasswordPage';