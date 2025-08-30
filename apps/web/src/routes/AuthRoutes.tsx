import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';\nimport { GuestOnlyRoute } from '../components/auth/ProtectedRoute';\nimport { LoginPage } from '../pages/auth/LoginPage';\nimport { RegisterPage } from '../pages/auth/RegisterPage';\nimport { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';\nimport { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';

/**
 * Authentication routes - only accessible to unauthenticated users
 * Authenticated users will be redirected to dashboard
 */
export function AuthRoutes() {
  return (
    <GuestOnlyRoute redirectTo="/dashboard">
      <Routes>\n        <Route path="/login" element={<LoginPage />} />\n        <Route path="/register" element={<RegisterPage />} />\n        <Route path="/forgot-password" element={<ForgotPasswordPage />} />\n        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Redirect /auth to /auth/login */}\n        <Route path="/" element={<Navigate to="/login" replace />} />
        {/* Catch all - redirect to login */}\n        <Route path="/*" element={<Navigate to="/login" replace />} />
      </Routes>
    </GuestOnlyRoute>
  );\n}"