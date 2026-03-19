import { Routes, Route, Navigate } from "react-router-dom";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
import { Chat } from "./pages/Chat";
import { Channels } from "./pages/Channels";
import { Skills } from "./pages/Skills";
import { History } from "./pages/History";
import { Settings } from "./pages/Settings";
import { ToastContainer } from "./components/Toast";
import { GatewayProvider } from "./hooks/GatewayContext";

export function App() {
  return (
    <GatewayProvider>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<Chat />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </GatewayProvider>
  );
}
