type MessageHandler = (data: WebSocketMessage) => void;
type StatusHandler = (connected: boolean, error?: string) => void;

export interface WebSocketMessage {
  type: string;
  content?: string;
  session?: string;
  [key: string]: unknown;
}

export class GatewayWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private intentionallyClosed = false;
  private consecutiveFailures = 0;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.intentionallyClosed = false;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.consecutiveFailures = 0;
        this.notifyStatus(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as WebSocketMessage;
          this.messageHandlers.forEach((handler) => handler(data));
        } catch {
          // ignore non-JSON messages
        }
      };

      this.ws.onclose = (event) => {
        this.consecutiveFailures++;
        const isAuthError = event.code === 1008 || event.code === 4401;

        if (isAuthError || this.consecutiveFailures >= 3) {
          this.notifyStatus(false, "连接被拒绝，请检查 Gateway 配置");
        } else {
          this.notifyStatus(false);
        }

        if (!this.intentionallyClosed && !isAuthError) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onclose will fire after this, so don't notify here
      };
    } catch {
      this.notifyStatus(false);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private notifyStatus(connected: boolean, error?: string): void {
    this.statusHandlers.forEach((handler) => handler(connected, error));
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.notifyStatus(false, "无法连接到 AI 引擎，请重新启动");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
