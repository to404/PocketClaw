export function Channels() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Channels 配置</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          请使用{" "}
          <a
            href="http://localhost:18789"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            OpenClaw 高级模式
          </a>{" "}
          配置聊天平台（QQ、飞书、微信等）
        </p>
      </div>
    </div>
  );
}
