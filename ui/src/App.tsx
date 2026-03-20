import { Routes, Route, Navigate } from "react-router-dom";
import { Onboarding } from "./pages/Onboarding";
import { Chat } from "./pages/Chat";
import { Settings } from "./pages/Settings";
import { ToastContainer } from "./components/Toast";
import { GatewayProvider } from "./hooks/GatewayContext";
import { useConfig } from "./hooks/useConfig";

function RequireConfig({ children }: { children: React.ReactNode }) {
  const { loading, isConfigured } = useConfig();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }
  if (!isConfigured) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <GatewayProvider>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/settings" element={<Settings />} />
        <Route
          path="/*"
          element={
            <RequireConfig>
              <Chat />
            </RequireConfig>
          }
        />
      </Routes>
      <ToastContainer />
    </GatewayProvider>
  );
}
