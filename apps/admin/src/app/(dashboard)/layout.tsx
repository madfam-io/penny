import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';\nimport { Sidebar } from '@/components/sidebar';\nimport { Header } from '@/components/header';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session) {\n    redirect('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />\n      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />\n        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">\n          <div className="container mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
