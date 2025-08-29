// This file is now deprecated in favor of the new auth system
// Keeping for backwards compatibility during migration
// TODO: Remove after migration to new auth system is complete

import { createContext, useContext, ReactNode } from 'react';
import { AuthProvider as NewAuthProvider, useAuthContext } from '../components/auth/AuthProvider';

/**
 * @deprecated Use the new AuthProvider from components/auth/AuthProvider instead
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  console.warn('AuthContext from contexts/AuthContext is deprecated. Use components/auth/AuthProvider instead.');
  return <NewAuthProvider>{children}</NewAuthProvider>;
}

/**
 * @deprecated Use useAuthContext from components/auth/AuthProvider instead
 */
export function useAuth() {
  console.warn('useAuth from contexts/AuthContext is deprecated. Use useAuthContext instead.');
  return useAuthContext();
}
