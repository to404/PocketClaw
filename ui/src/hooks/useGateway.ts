import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage } from "../types";
import { GatewayWebSocket, type WebSocketMessage } from "../utils/websocket";

interface UseGatewayReturn {
  connected: boolean;
  connectionError: string;
  messages: ChatMessage[];
  sendMessage: (content: string) => void;
  regenerate: () => void;
  clearMessages: () => void;
  pending: boolean;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function uuid(): string {
  return crypto.randomUUID();
}

export function useGateway(): UseGatewayReturn {
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const wsRef = useRef<GatewayWebSocket | null>(null);
  const pendingIdRef = useRef<string | null>(null);

  useEffect(() => {
    const ws = new GatewayWebSocket();
    wsRef.current = ws;

    const unsubStatus = ws.onStatus((isConnected, error) => {
      setConnected(isConnected);
      if (isConnected) {
        setConnectionError("");
      } else if (error) {
        setConnectionError(error);
      }
    });

    const unsubMessage = ws.onMessage((data: WebSocketMessage) => {
      // Handle OpenClaw chat events (agent responses)
      // Fields (state, message, runId) are TOP-LEVEL, not inside payload
      // (verified from OpenClaw source: src/gateway/server-chat.ts)
      if (data.type === "event" && data.event === "chat") {
        const d = data as Record<string, unknown>;
        const state = d.state as string | undefined;
        const msg = d.message as Record<string, unknown> | undefined;

        // Handle error state (has errorMessage, no message field)
        if ((state === "error" || state === "aborted") && pendingIdRef.current) {
          const errorText = (d.errorMessage as string) ?? "请求失败";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingIdRef.current
                ? { ...m, content: errorText, pending: false, role: "system" }
                : m,
            ),
          );
          pendingIdRef.current = null;
          setPending(false);
          return;
        }

        // Handle delta: extract text and update message content
        if (msg && pendingIdRef.current) {
          const contentArr = msg.content as Array<Record<string, unknown>> | undefined;
          let text = "";
          if (Array.isArray(contentArr)) {
            text = contentArr
              .filter((c) => c.type === "text")
              .map((c) => (c.text as string) ?? "")
              .join("");
          } else if (typeof msg.content === "string") {
            text = msg.content;
          }

          if (text) {
            setMessages((prev) =>
              prev.map((m) => (m.id === pendingIdRef.current ? { ...m, content: text } : m)),
            );
          }
        }

        // Handle final: mark message as done
        if (state === "final" && pendingIdRef.current) {
          setMessages((prev) =>
            prev.map((m) => (m.id === pendingIdRef.current ? { ...m, pending: false } : m)),
          );
          pendingIdRef.current = null;
          setPending(false);
        }
        return;
      }

      // Handle RPC error responses
      if (data.type === "res" && !(data as Record<string, unknown>).ok) {
        if (pendingIdRef.current) {
          const payload = data.payload as Record<string, unknown> | undefined;
          const errMsg = (payload?.message as string) ?? "请求失败";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingIdRef.current
                ? { ...m, content: errMsg, pending: false, role: "system" }
                : m,
            ),
          );
          pendingIdRef.current = null;
          setPending(false);
        }
      }
    });

    ws.connect();

    return () => {
      unsubStatus();
      unsubMessage();
      ws.disconnect();
    };
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!content.trim() || !wsRef.current) return;

    const userMsg: ChatMessage = {
      id: makeId(),
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };

    const assistantId = makeId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      pending: true,
    };

    pendingIdRef.current = assistantId;
    setPending(true);
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    // Send via OpenClaw chat.send RPC (verified from DevTools)
    wsRef.current.sendRpc("chat.send", {
      sessionKey: "agent:main:main",
      message: content.trim(),
      deliver: false,
      idempotencyKey: uuid(),
    });
  }, []);

  const regenerate = useCallback(() => {
    if (pending || !wsRef.current) return;
    // Find the last user message to resend
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Remove the last assistant message
    setMessages((prev) => {
      let lastIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i]?.role === "assistant") {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx >= 0) {
        return prev.filter((_, i) => i !== lastIdx);
      }
      return prev;
    });

    // Resend the last user message
    const assistantId = makeId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      pending: true,
    };

    pendingIdRef.current = assistantId;
    setPending(true);
    setMessages((prev) => [...prev, assistantMsg]);

    wsRef.current.sendRpc("chat.send", {
      sessionKey: "agent:main:main",
      message: lastUserMsg.content,
      deliver: false,
      idempotencyKey: uuid(),
    });
  }, [messages, pending]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPending(false);
    pendingIdRef.current = null;
  }, []);

  return { connected, connectionError, messages, sendMessage, regenerate, clearMessages, pending };
}
