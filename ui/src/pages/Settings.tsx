import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ModelSelector } from "../components/ModelSelector";
import { ApiKeyInput } from "../components/ApiKeyInput";
import { UpdateChecker } from "../components/UpdateChecker";
import { useConfig } from "../hooks/useConfig";

export function Settings() {
  const { config, updateConfig, loading } = useConfig();
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setModel(config.agent?.model ?? "");
      const provider = config.agent?.model?.split("/")[0] ?? "";
      const providerConfig = config[provider];
      if (providerConfig && typeof providerConfig === "object" && "apiKey" in providerConfig) {
        setApiKey(String(providerConfig.apiKey));
      }
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const provider = model.split("/")[0] ?? "";
      await updateConfig({
        agent: { ...config?.agent, model },
        [provider]: { apiKey },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error handled by useConfig
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 font-semibold text-gray-900">AI 模型</h3>
            <ModelSelector value={model} onChange={setModel} />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 font-semibold text-gray-900">API Key</h3>
            <ApiKeyInput value={apiKey} onChange={setApiKey} />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 font-semibold text-gray-900">聊天平台</h3>
            <p className="text-sm text-gray-500">
              连接 QQ、飞书、微信等聊天平台，请使用
              <a
                href="http://localhost:18789"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-indigo-600 hover:underline"
              >
                高级模式
              </a>
              进行配置
            </p>
          </div>

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : saved ? "已保存" : "保存设置"}
          </button>

          <UpdateChecker />

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 font-semibold text-gray-900">关于</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p>PocketClaw — 便携 AI 助手</p>
              <p>基于 OpenClaw (MIT) 构建</p>
              <div className="flex gap-3 pt-2">
                <a
                  href="https://github.com/Austin5925/PocketClaw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  GitHub
                </a>
                <a
                  href="https://github.com/Austin5925/PocketClaw/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  反馈
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
