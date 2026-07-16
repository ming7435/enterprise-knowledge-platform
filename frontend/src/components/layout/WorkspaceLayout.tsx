import type { ReactNode } from 'react';

export interface WorkspaceLayoutProps {
  header: ReactNode;
  sidebar?: ReactNode;
  sidebarOpen?: boolean;
  children: ReactNode;
}

export function WorkspaceLayout({
  header,
  sidebar,
  sidebarOpen = true,
  children,
}: WorkspaceLayoutProps) {
  return (
    <main className={`workspace-layout ${sidebar ? 'has-context-sidebar' : ''} ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {header}
      <div className="workspace-layout-body">
        {sidebar ? <aside className="workspace-layout-sidebar">{sidebar}</aside> : null}
        <section className="workspace-layout-content">{children}</section>
      </div>
    </main>
  );
}
