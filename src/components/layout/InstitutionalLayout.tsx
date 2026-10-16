import { Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { InstitutionalHeader } from './InstitutionalHeader';
import { InstitutionalFooter } from './InstitutionalFooter';

export function InstitutionalLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-sky-200 selection:text-sky-950">
      <InstitutionalHeader />
      <main className="flex-1 w-full pb-12 sm:pb-16">
        {children ?? <Outlet />}
      </main>
      <InstitutionalFooter />
    </div>
  );
}
