import { useState } from "react";

interface ApiKeyInputProps {
  value: string;
  onChange: (key: string) => void;
  placeholder?: string;
}

export function ApiKeyInput({ value, onChange, placeholder }: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "sk-xxxxxxxxxxxxxxxx"}
        className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 pr-20 font-mono text-sm transition-colors focus:border-indigo-500 focus:outline-none"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        {visible ? "隐藏" : "显示"}
      </button>
    </div>
  );
}
