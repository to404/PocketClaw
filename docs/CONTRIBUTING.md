# 贡献指南

感谢你对OpenClawU盘便携版的关注！欢迎提交 Issue 和 Pull Request。

## 开发环境

1. Clone 仓库
2. 进入 `ui/` 目录
3. 运行 `pnpm install`（或 `npm install`）
4. 启动本地调试（二选一）：
   - **一条命令**：`pnpm dev:full` — 同时起 PocketClaw `server.js`（端口 **3211**，负责 `/api` 与 `/ws` 转发）和 Vite（**3210**）。
   - **两个终端**：先 `pnpm dev:api`，再 `pnpm dev`。

浏览器打开 **http://localhost:3210**。`/api/config`、`/api/validate-key` 等由 `portable/system/server.js` 提供，不能像以前一样把代理指到 18789。

聊天 WebSocket 仍会经 3211 转发到本机 **18789** 网关；若未启动便携版 AI 引擎，界面可用但聊天会连不上。

## 代码规范

- TypeScript 严格模式
- ESLint + Prettier 格式化
- 提交前运行 `pnpm lint && pnpm test && pnpm build`

## Commit 规范

使用 Conventional Commits：

```
feat(ui): add model selection page
fix(portable): fix Windows path issue
docs: update tutorial
```

## 提交 Issue

- Bug: 包含复现步骤、系统环境、错误日志
- Feature: 说明使用场景和期望行为

## 许可证

贡献的代码将采用 MIT 许可证。
