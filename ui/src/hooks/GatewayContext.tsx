import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { GatewayWebSocket, type WebSocketMessage } from "../utils/websocket";

// Fallback session key — overridden by mainSessionKey from hello-ok snapshot
const DEFAULT_SESSION = "agent:main:main";

interface GatewayContextValue {
  connected: boolean;
  connectionError: string;
  mainSessionKey: string;
  sendRpc: (method: string, params: Record<string, unknown>) => void;
  onMessage: (handler: (data: WebSocketMessage) => void) => () => void;
}

const GatewayCtx = createContext<GatewayContextValue>({
  connected: false,
  connectionError: "",
  mainSessionKey: DEFAULT_SESSION,
  sendRpc: () => {},
  onMessage: () => () => {},
});

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [mainSessionKey, setMainSessionKey] = useState(DEFAULT_SESSION);

  // Create the WS instance synchronously during render so that child effects
  // (e.g. useGateway's onMessage registration) can safely access wsRef.current
  // even when the component tree has children-before-parents effect ordering.
  const wsRef = useRef<GatewayWebSocket | null>(null);
  if (wsRef.current === null) {
    wsRef.current = new GatewayWebSocket();
  }

  useEffect(() => {
    const ws = wsRef.current!;

    ws.onStatus((isConnected, error, msk) => {
      setConnected(isConnected);
      if (isConnected) {
        setConnectionError("");
        if (msk) setMainSessionKey(msk);
        // Force gateway to reload auth store on every connection.
        // auth-profiles.json is cached in memory at gateway startup
        // (runtimeAuthStoreSnapshots). secrets.reload forces a fresh read.
        ws.sendRpc("secrets.reload", {});
      } else if (error) {
        setConnectionError(error);
      }
    });

    ws.connect();

    return () => {
      ws.disconnect();
      // Reset ref so the next mount creates a fresh instance
      wsRef.current = null;
    };
  }, []);

  const sendRpc = useCallback((method: string, params: Record<string, unknown>) => {
    wsRef.current?.sendRpc(method, params);
  }, []);

  const onMessage = useCallback((handler: (data: WebSocketMessage) => void) => {
    if (!wsRef.current) return () => {};
    return wsRef.current.onMessage(handler);
  }, []);

  return (
    <GatewayCtx.Provider value={{ connected, connectionError, mainSessionKey, sendRpc, onMessage }}>
      {children}
    </GatewayCtx.Provider>
  );
}

export function useGatewayConnection() {
  return useContext(GatewayCtx);
}
