/** User-defined OpenAI/Anthropic-compatible endpoint (synced to OpenClaw as provider `custom`). */
export interface CustomProviderConfig {
  baseUrl?: string;
  /** Shown name in internal config; defaults to model id. */
  displayName?: string;
  /** OpenClaw API driver. */
  api?: "openai-completions" | "anthropic-messages";
  /** Redundant copy of the segment after custom/; kept for sync if needed. */
  modelName?: string;
  apiKey?: string;
}

export interface OpenClawConfig {
  agent?: {
    model?: string;
  };
  custom?: CustomProviderConfig;
  gateway?: {
    port?: number;
    host?: string;
  };
  webchat?: {
    enabled?: boolean;
  };
  log?: {
    level?: string;
  };
  [key: string]: unknown;
}

export interface ModelProvider {
  id: string;
  name: string;
  description: string;
  models: string[];
  recommended?: boolean;
  apiKeyUrl?: string;
  /** Built-in list only; custom tile uses free-form URL + model id. */
  custom?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  pending?: boolean;
}

export interface GatewayStatus {
  connected: boolean;
  gatewayReachable: boolean;
  error?: string;
}

/** Local version display only (no online “update available” check). */
export interface VersionInfo {
  current: string;
  openclawVersion?: string;
}

export interface HealthResponse {
  ui: string;
  gateway: string;
  gatewayResponse?: string;
}
