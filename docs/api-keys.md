# API Key 获取指南

OpenClawU盘便携版支持 9 家 AI 模型提供商。选择一家注册即可使用。

## 推荐：国内模型（免翻墙）

### MiniMax（默认推荐）

1. 打开 [MiniMax 开放平台](https://www.minimaxi.com)
2. 注册并登录
3. 进入控制台 → API Keys → 创建新 Key
4. 复制 Key（以 `eyJ` 开头的长字符串）

### DeepSeek

1. 打开 [DeepSeek 开放平台](https://platform.deepseek.com)
2. 注册并登录
3. 进入 API Keys → 创建
4. 复制 Key

### Kimi (Moonshot)

1. 打开 [Moonshot AI 开放平台](https://platform.moonshot.cn)
2. 注册并登录
3. 进入 API Key 管理 → 新建
4. 复制 Key

### 通义千问 (Qwen)

1. 打开 [阿里云百炼平台](https://bailian.console.aliyun.com)
2. 注册阿里云账号并登录
3. 进入 API Key 管理 → 创建
4. 复制 Key

### 智谱 (GLM)

1. 打开 [智谱 AI 开放平台](https://open.bigmodel.cn)
2. 注册并登录
3. 进入 API Keys → 创建
4. 复制 Key

### 火山引擎 (豆包)

1. 打开 [火山引擎](https://www.volcengine.com)
2. 注册并登录
3. 进入方舟大模型 → API Key 管理 → 创建
4. 复制 Key

## 海外模型（需要海外网络）

### OpenAI (GPT)

1. 打开 [OpenAI Platform](https://platform.openai.com)
2. 注册并登录（需海外手机号）
3. 进入 API Keys → Create new secret key
4. 复制 Key

> **中转站：** 如果无法直接访问 OpenAI，可以使用 API 中转服务。在OpenClawU盘便携版的"模型 API Key"设置中，目前使用的是默认端点。如需使用中转站，需手动修改 `portable/system/shared-config.json` 中对应 provider 的 `baseUrl`。

### Anthropic (Claude)

1. 打开 [Anthropic Console](https://console.anthropic.com)
2. 注册并登录
3. 进入 API Keys → Create Key
4. 复制 Key

### Google (Gemini)

1. 打开 [Google AI Studio](https://aistudio.google.com)
2. 登录 Google 账号
3. 进入 API Keys → Create API Key
4. 复制 Key

## 在OpenClawU盘便携版中配置

1. 打开 http://localhost:3210/settings
2. 点击左侧 **模型 API Key** Tab
3. 找到对应的提供商卡片
4. 输入 API Key → 点击"验证"确认有效 → 点击"保存"
5. 如需切换默认模型，点击"设为默认"
