import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { GuestOnlyRoute } from '../components/auth/ProtectedRoute';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';

/**
 * Authentication routes - only accessible to unauthenticated users
 * Authenticated users will be redirected to dashboard
 */
export function AuthRoutes() {
  return (
    <GuestOnlyRoute redirectTo="/dashboard">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Redirect /auth to /auth/login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        {/* Catch all - redirect to login */}
        <Route path="/*" element={<Navigate to="/login" replace />} />
      </Routes>
    </GuestOnlyRoute>
  );
}"