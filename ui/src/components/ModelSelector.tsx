import {
  BUILTIN_MODEL_PROVIDERS,
  CUSTOM_MODEL_PROVIDER,
  type CustomApiMode,
} from "../utils/config";

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  customBaseUrl: string;
  customModelName: string;
  customApi: CustomApiMode;
  onCustomBaseUrlChange: (v: string) => void;
  onCustomModelNameChange: (v: string) => void;
  onCustomApiChange: (v: CustomApiMode) => void;
}

export function ModelSelector({
  value,
  onChange,
  customBaseUrl,
  customModelName,
  customApi,
  onCustomBaseUrlChange,
  onCustomModelNameChange,
  onCustomApiChange,
}: ModelSelectorProps) {
  const isCustom = value.startsWith("custom/");

  const selectBuiltin = (firstModel: string) => {
    onChange(firstModel);
  };

  const selectCustom = () => {
    const id = customModelName.trim() || "model";
    onChange(`custom/${id}`);
  };

  const tileClass = (active: boolean) =>
    `flex min-h-[128px] w-[min(17.5rem,calc(100vw-3.25rem))] max-w-[300px] shrink-0 cursor-pointer snap-start flex-col rounded-xl border-2 p-4 text-left transition-all sm:min-h-[136px] ${
      active
        ? "border-indigo-500 bg-indigo-50 shadow-sm"
        : "border-gray-200 bg-white hover:border-gray-300"
    }`;

  return (
    <div className="space-y-5">
      <div className="relative">
        <p className="mb-3 text-center text-xs text-gray-400 sm:mb-4 sm:text-left">
          左右滑动查看更多提供商
        </p>
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent dark:from-gray-900"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent dark:from-gray-900"
          aria-hidden
        />
        <div
          className="snap-x snap-mandatory overflow-x-auto overflow-y-visible scroll-smooth scroll-pl-3 scroll-pr-3 pb-3 pl-2 pr-2 pt-1 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch] overscroll-x-contain"
          aria-label="模型提供商，可横向滑动"
        >
          <div className="flex w-max gap-4 pr-3">
            <label className={tileClass(isCustom)}>
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="model"
                  checked={isCustom}
                  onChange={() => selectCustom()}
                  className="mt-1 shrink-0 accent-indigo-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">{CUSTOM_MODEL_PROVIDER.name}</div>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                    {CUSTOM_MODEL_PROVIDER.description}
                  </p>
                </div>
              </div>
            </label>

            {BUILTIN_MODEL_PROVIDERS.map((provider) => {
              const active = !isCustom && provider.models.includes(value);
              return (
                <label key={provider.id} className={tileClass(active)}>
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="model"
                      checked={active}
                      onChange={() => selectBuiltin(provider.models[0] ?? "")}
                      className="mt-1 shrink-0 accent-indigo-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-medium text-gray-900">{provider.name}</span>
                        {provider.recommended && (
                          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">
                            推荐
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{provider.description}</p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {isCustom && (
        <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
          <p className="text-sm font-medium text-indigo-900">自定义接口</p>
          <div>
            <label className="mb-1 block text-xs text-gray-600">API 根地址</label>
            <input
              type="url"
              placeholder="例如 https://api.openai.com/v1 或含 /v1 的网关根路径"
              value={customBaseUrl}
              onChange={(e) => onCustomBaseUrlChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">模型 ID（与服务商文档一致）</label>
            <input
              type="text"
              placeholder="例如 gpt-4o-mini、deepseek-chat"
              value={customModelName}
              onChange={(e) => {
                const v = e.target.value;
                onCustomModelNameChange(v);
                const id = v.trim() || "model";
                onChange(`custom/${id}`);
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">接口类型</label>
            <select
              value={customApi}
              onChange={(e) => onCustomApiChange(e.target.value as CustomApiMode)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            >
              <option value="openai-completions">OpenAI 兼容（/v1/chat/completions）</option>
              <option value="anthropic-messages">Anthropic 兼容（/v1/messages）</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
