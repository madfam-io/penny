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
          {/* Session management for authenticated users */}
          <SessionManager />
          
          <Routes>
            {/* Authentication routes */}
            <Route path="/auth/*" element={<AuthRoutes />} />
            
            {/* Protected application routes */}
            <Route
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <ChatView />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            
            <Route
              path="/chat" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <ChatView />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            
            {/* Root redirect */}
            <Route
              path="/"
              element={<Navigate to="/dashboard" replace />} 
            />
            
            {/* Catch all - redirect to dashboard */}
            <Route
              path="/*"
              element={<Navigate to="/dashboard" replace />} 
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
