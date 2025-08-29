import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/auth/AuthProvider';
import { SessionManager } from './components/auth/SessionManager';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthRoutes } from './routes/AuthRoutes';
import Layout from './components/Layout';
import ChatView from './pages/ChatView';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          {/* Session management for authenticated users */}\n          <SessionManager />\n          \n          <Routes>\n            {/* Authentication routes */}\n            <Route path=\"/auth/*\" element={<AuthRoutes />} />\n            \n            {/* Protected application routes */}\n            <Route \n              path=\"/dashboard\" \n              element={\n                <ProtectedRoute>\n                  <Layout>\n                    <ChatView />\n                  </Layout>\n                </ProtectedRoute>\n              } \n            />\n            \n            <Route \n              path=\"/chat\" \n              element={\n                <ProtectedRoute>\n                  <Layout>\n                    <ChatView />\n                  </Layout>\n                </ProtectedRoute>\n              } \n            />\n            \n            {/* Root redirect */}\n            <Route \n              path=\"/\" \n              element={<Navigate to=\"/dashboard\" replace />} \n            />\n            \n            {/* Catch all - redirect to dashboard */}\n            <Route \n              path=\"/*\" \n              element={<Navigate to=\"/dashboard\" replace />} \n            />\n          </Routes>\n        </AuthProvider>\n      </ThemeProvider>\n    </BrowserRouter>\n  );\n}\n\nexport default App;
