import { ReactNode } from 'react';\nimport Sidebar from './Sidebar';\nimport Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}\n      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page content */}\n        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-white dark:bg-gray-800">
          {children}
        </main>
      </div>
    </div>
  );
}
