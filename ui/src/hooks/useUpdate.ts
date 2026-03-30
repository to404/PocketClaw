import { useState, useCallback } from "react";
import type { VersionInfo } from "../types";
import { getVersion } from "../utils/config";

interface UseVersionInfoReturn {
  versionInfo: VersionInfo | null;
  loading: boolean;
  error: string | null;
  refreshVersionInfo: () => Promise<void>;
}

/** Loads portable + OpenClaw kernel versions from local `/api/*` only (no GitHub / release compare). */
export function useUpdate(): UseVersionInfoReturn {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshVersionInfo = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { version: current } = await getVersion();

      let openclawVersion: string | undefined;
      try {
        const ocRes = await fetch("/api/openclaw-version");
        if (ocRes.ok) {
          const ocData = (await ocRes.json()) as { version: string };
          openclawVersion = ocData.version;
        }
      } catch {
        // OpenClaw version not available
      }

      setVersionInfo({ current, openclawVersion });
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法读取版本信息");
    } finally {
      setLoading(false);
    }
  }, []);

  return { versionInfo, loading, error, refreshVersionInfo };
}
