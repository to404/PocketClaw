import { useEffect } from "react";
import { useUpdate } from "../hooks/useUpdate";

export function UpdateChecker() {
  const { versionInfo, checking, error, checkForUpdates } = useUpdate();

  useEffect(() => {
    void checkForUpdates();
  }, [checkForUpdates]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 font-semibold text-gray-900">系统更新</h3>

      {checking && <p className="text-sm text-gray-500">正在检查更新...</p>}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {versionInfo && !checking && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">当前版本：v{versionInfo.current}</p>
          {versionInfo.latest && (
            <p className="text-sm text-gray-700">最新版本：v{versionInfo.latest}</p>
          )}
          {versionInfo.updateAvailable ? (
            <p className="text-sm font-medium text-indigo-600">有新版本可用，请通过菜单脚本更新</p>
          ) : (
            <p className="text-sm text-emerald-600">已是最新版本</p>
          )}
        </div>
      )}

      <button
        onClick={() => void checkForUpdates()}
        disabled={checking}
        className="mt-3 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
      >
        {checking ? "检查中..." : "检查更新"}
      </button>
    </div>
  );
}
