import { useState, useCallback } from "react";
import type { VersionInfo } from "../types";
import { getVersion } from "../utils/config";

const GITHUB_REPO = "Austin5925/PocketClaw";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** Returns >0 if a > b, <0 if a < b, 0 if equal. Handles "v" prefix. */
function compareSemver(a: string, b: string): number {
  const parse = (s: string) => s.replace(/^v/, "").split(".").map(Number);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

interface UseUpdateReturn {
  versionInfo: VersionInfo | null;
  checking: boolean;
  error: string | null;
  checkForUpdates: () => Promise<void>;
}

export function useUpdate(): UseUpdateReturn {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    setError(null);

    try {
      const { version: current } = await getVersion();

      let latest: string | undefined;
      try {
        const res = await fetch(GITHUB_API, {
          headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (res.ok) {
          const data = (await res.json()) as { tag_name: string };
          latest = data.tag_name.replace(/^v/, "");
        }
      } catch {
        // offline or rate-limited, just show current version
      }

      setVersionInfo({
        current,
        latest,
        updateAvailable: latest ? compareSemver(latest, current) > 0 : false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Version check failed");
    } finally {
      setChecking(false);
    }
  }, []);

  return { versionInfo, checking, error, checkForUpdates };
}
