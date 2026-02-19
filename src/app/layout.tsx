'use client';

import './globals.css';
import { Sidebar } from '@/components/ui/sidebar';
import { Header } from '@/components/ui/header';
import { usePathname } from 'next/navigation';

// Routes that should NOT show the bank sidebar
const USER_ROUTES = ['/login', '/register', '/user'];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();

  // Check if current route is a user route (no sidebar)
  const isUserRoute = USER_ROUTES.some(route => pathname?.startsWith(route));

  // If it's a user route, render without sidebar
  if (isUserRoute) {
    return (
      <html lang="en" className="dark" suppressHydrationWarning>
        <body className="bg-slate-950 text-slate-100 selection:bg-cyan-500/30">
          {children}
        </body>
      </html>
    );
  }

  // Bank portal with sidebar
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-slate-950 text-slate-100 selection:bg-cyan-500/30">
        <div className="flex h-screen overflow-hidden">
          <div className="hidden md:block">
            <Sidebar />
          </div>
          <div className="flex-1 flex flex-col md:ml-64 overflow-hidden relative z-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 -z-10 pointer-events-none" />
            <Header />
            <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
