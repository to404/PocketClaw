import { useState } from "react";
import { Sidebar, type SessionRow } from "../components/Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
  currentSessionKey: string;
  onSessionChange: (key: string) => void;
  onNewChat: () => void;
  sessions?: SessionRow[];
}

export function MainLayout({
  children,
  currentSessionKey,
  onSessionChange,
  onNewChat,
  sessions,
}: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentSessionKey={currentSessionKey}
        onSessionChange={onSessionChange}
        onNewChat={onNewChat}
        sessions={sessions}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
