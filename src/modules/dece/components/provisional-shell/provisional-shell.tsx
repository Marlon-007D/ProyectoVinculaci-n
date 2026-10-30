import type { ReactNode } from 'react'

/** Page frame for DECE. Navigation lives in the shared private sidebar (PrivateWorkspace). */
export default function ProvisionalShell({ children }: { children: ReactNode }) {
  return (
    <main className="main-area">
      <header className="topbar">
        <div className="crumb">
          Unidad Educativa <span>/</span> <b>DECE</b>
        </div>
      </header>
      {children}
    </main>
  )
}
