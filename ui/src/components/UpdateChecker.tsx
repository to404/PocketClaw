import { useEffect } from "react";
import { useUpdate } from "../hooks/useUpdate";

export function UpdateChecker() {
  const { versionInfo, loading, error, refreshVersionInfo } = useUpdate();

  useEffect(() => {
    void refreshVersionInfo();
  }, [refreshVersionInfo]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">版本信息</h3>

      {loading && <p className="text-sm text-gray-500">正在加载...</p>}
      {error && <p className="mb-2 text-sm text-amber-600">{error}</p>}

      {versionInfo && !loading && (
        <div className="space-y-3">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              OpenClawU盘便携版 v{versionInfo.current}
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              OpenClaw 内核 {versionInfo.openclawVersion ? `v${versionInfo.openclawVersion}` : ""}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              内核随本便携包发行。OpenClaw Control（localhost:18789）控制台中的 &quot;Update
              Now&quot; 按钮不可用。
            </p>
          </div>
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={() => {
            void refreshVersionInfo();
          }}
          disabled={loading}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          {loading ? "加载中..." : "刷新"}
        </button>
      </div>
    </div>
  );
}
