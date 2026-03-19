export function Skills() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Skills 管理</p>
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
          管理 Agent 技能和工具
        </p>
      </div>
    </div>
  );
}
