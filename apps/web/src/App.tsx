import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';\nimport { AuthProvider } from './components/auth/AuthProvider';\nimport { SessionManager } from './components/auth/SessionManager';\nimport { ProtectedRoute } from './components/auth/ProtectedRoute';\nimport { ThemeProvider } from './contexts/ThemeContext';\nimport { AuthRoutes } from './routes/AuthRoutes';\nimport Layout from './components/Layout';\nimport ChatView from './pages/ChatView';

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
            <Route \n              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <ChatView />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            
            <Route \n              path="/chat" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <ChatView />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            
            {/* Root redirect */}
            <Route \n              path="/" \n              element={<Navigate to="/dashboard" replace />} 
            />
            
            {/* Catch all - redirect to dashboard */}
            <Route \n              path="/*" \n              element={<Navigate to="/dashboard" replace />} 
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
