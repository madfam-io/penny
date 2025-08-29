import { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import ChatView from './pages/ChatView';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Layout>
          <ChatView />
        </Layout>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
