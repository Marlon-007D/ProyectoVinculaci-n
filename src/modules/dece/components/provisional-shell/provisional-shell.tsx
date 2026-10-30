import type { ReactNode } from 'react'

/** Page frame for DECE: content only. The shared private sidebar owns navigation and the menu button. */
export default function ProvisionalShell({ children }: { children: ReactNode }) {
  return <main className="main-area">{children}</main>
}
