import { MODEL_PROVIDERS } from "../utils/config";

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <div className="space-y-2">
      {MODEL_PROVIDERS.map((provider) => (
        <label
          key={provider.id}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all ${
            provider.models.includes(value)
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <input
            type="radio"
            name="model"
            checked={provider.models.includes(value)}
            onChange={() => onChange(provider.models[0] ?? "")}
            className="mt-1 accent-indigo-600"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{provider.name}</span>
              {provider.recommended && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                  推荐
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-500">{provider.description}</p>
          </div>
        </label>
      ))}
    </div>
  );
}
