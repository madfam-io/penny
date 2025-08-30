import type { Metadata } from 'next';
import { Inter } from 'next/font/google';\nimport { Providers } from '@/components/providers';\nimport { Toaster } from '@penny/ui';\nimport './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PENNY Admin - Enterprise AI Workbench Management',
  description: 'Manage your PENNY platform, users, and resources',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
