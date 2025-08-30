'use client';

import { useState } from 'react';\nimport { Sidebar } from './Sidebar';\nimport { Header } from './Header';\nimport { cn } from '@/utils/cn';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCollapse={setSidebarCollapsed}
        onMobileToggle={setMobileSidebarOpen}
      />
      
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div \n          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      
      {/* Main Content */}\n      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          onMobileMenuClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
        />
        
        <main className={cn(
          'flex-1 overflow-x-hidden overflow-y-auto bg-background',
          'transition-all duration-200'
        )}>\n          <div className="container mx-auto px-6 py-8 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}