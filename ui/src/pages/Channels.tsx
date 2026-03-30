import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGatewayConnection } from "../hooks/GatewayContext";
import type { WebSocketMessage } from "../utils/websocket";

interface ChannelAccount {
  accountId: string;
  name?: string;
  enabled?: boolean;
  connected?: boolean;
  running?: boolean;
  lastError?: string;
}

interface ChannelInfo {
  id: string;
  label: string;
  accounts: ChannelAccount[];
}

export function Channels() {
  const { connected, sendRpc, onMessage } = useGatewayConnection();
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connected) return;
    const unsub = onMessage((data: WebSocketMessage) => {
      if (data.type === "res" && (data as Record<string, unknown>).ok) {
        const p = data.payload as Record<string, unknown> | undefined;
        if (p?.channelOrder && p?.channels) {
          const order = p.channelOrder as string[];
          const labels = (p.channelLabels ?? {}) as Record<string, string>;
          const accts = (p.channelAccounts ?? {}) as Record<string, ChannelAccount[]>;
          setChannels(
            order.map((id) => ({
              id,
              label: labels[id] ?? id,
              accounts: accts[id] ?? [],
            })),
          );
          setLoading(false);
        }
      }
    });
    sendRpc("channels.status", {});
    return unsub;
  }, [connected, sendRpc, onMessage]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">聊天平台</h2>
          <Link
            to="/settings"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            配置频道
          </Link>
        </div>

        {loading && <p className="text-sm text-gray-500">加载中...</p>}

        {!loading && channels.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">暂无已连接的聊天平台</p>
              <p className="mt-2 text-xs text-gray-400">
                在{" "}
                <Link to="/settings" className="text-indigo-600 hover:underline dark:text-indigo-400">
                  设置 → 频道接入
                </Link>{" "}
                中配置后，连接状态会显示在这里。
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                各平台如何接入
              </h3>
              <ul className="space-y-4 text-xs text-gray-600 dark:text-gray-400">
                <li>
                  <span className="font-medium text-gray-800 dark:text-gray-200">飞书 / QQ</span>
                  ：在设置「频道接入」中展开对应卡片，填写开放平台上的 App ID 与 Secret，保存即可（详见项目内{" "}
                  <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">docs/channels.md</code>
                  ）。
                </li>
                <li>
                  <span className="font-medium text-gray-800 dark:text-gray-200">微信（ClawBot）</span>
                  ：需已安装 <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">@tencent-weixin/openclaw-weixin</code>（完整 setup 或发行包已包含）。随后在「频道接入」里找到「微信」卡片，点击「启用」保存；然后打开{" "}
                  <a
                    href="http://localhost:18789"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    OpenClaw 控制台
                  </a>{" "}
                  （默认端口 18789），在频道管理中选择微信 ClawBot，用微信扫码完成配对。无需公网 IP，也无需像飞书那样填网页凭证。
                </li>
              </ul>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">{ch.label}</h3>
                <span className="text-xs text-gray-400">{ch.id}</span>
              </div>
              {ch.accounts.length === 0 && <p className="mt-2 text-xs text-gray-400">未配置账号</p>}
              {ch.accounts.map((a) => (
                <div key={a.accountId} className="mt-2 flex items-center gap-2 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${a.connected ? "bg-emerald-500" : a.running ? "bg-amber-500" : "bg-gray-300"}`}
                  />
                  <span className="text-gray-700 dark:text-gray-300">{a.name ?? a.accountId}</span>
                  <span className="text-xs text-gray-400">
                    {a.connected ? "已连接" : a.running ? "运行中" : "未连接"}
                  </span>
                  {a.lastError && (
                    <span className="text-xs text-red-500" title={a.lastError}>
                      错误
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
