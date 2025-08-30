// Authentication components and hooks
export { AuthProvider, useAuthContext, type AuthContextType } from './AuthProvider';\nexport { ProtectedRoute, GuestOnlyRoute, withAuth, type ProtectedRouteProps } from './ProtectedRoute';\nexport { SessionManager, type SessionManagerProps } from './SessionManager';

// Re-export hooks for convenience\nexport { useAuth, useRequireAuth, useSession } from '../../hooks/useAuth';\nexport type { User, Tenant, AuthState, LoginData, RegisterData, AuthResponse } from '../../hooks/useAuth';

// Re-export auth pages\nexport { LoginPage } from '../../pages/auth/LoginPage';\nexport { RegisterPage } from '../../pages/auth/RegisterPage';\nexport { ForgotPasswordPage } from '../../pages/auth/ForgotPasswordPage';\nexport { ResetPasswordPage } from '../../pages/auth/ResetPasswordPage';"