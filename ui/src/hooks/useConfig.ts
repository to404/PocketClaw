import { useState, useEffect, useCallback } from "react";
import type { OpenClawConfig } from "../types";
import { loadConfig, saveConfig } from "../utils/config";

interface UseConfigReturn {
  config: OpenClawConfig | null;
  loading: boolean;
  error: string | null;
  updateConfig: (updates: Partial<OpenClawConfig>) => Promise<void>;
  setModel: (model: string) => Promise<void>;
  reload: () => Promise<void>;
  isConfigured: boolean;
}

export function useConfig(): UseConfigReturn {
  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadConfig();
      setConfig(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateConfig = useCallback(
    async (updates: Partial<OpenClawConfig>) => {
      const merged = { ...config, ...updates };
      await saveConfig(merged as OpenClawConfig);
      setConfig(merged as OpenClawConfig);
    },
    [config],
  );

  const setModel = useCallback(
    async (model: string) => {
      await updateConfig({
        agent: { ...config?.agent, model },
      });
    },
    [config, updateConfig],
  );

  const isConfigured = Boolean(config?.agent?.model);

  return { config, loading, error, updateConfig, setModel, reload, isConfigured };
}
