const http = require("http");
const fs = require("fs");
const path = require("path");
const { createProxyServer } = require("./ws-proxy");

const UI_PORT = parseInt(process.env.UI_PORT || "3210", 10);
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || "18789", 10);
const GATEWAY_HOST = process.env.GATEWAY_HOST || "127.0.0.1";

const SCRIPT_DIR = __dirname;
const BASE_DIR = path.resolve(SCRIPT_DIR, "..");
const UI_DIR = path.join(BASE_DIR, "app", "ui", "dist");
const DATA_DIR = path.join(BASE_DIR, "data");
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*; font-src 'self'",
};

// Weixin login session state for onboarding QR flow.
const weixinLoginSession = {
  proc: null,
  startedAt: 0,
  qrUrl: "",
  qrAsciiLines: [],
  collectingQrAscii: false,
  logs: [],
  exitCode: null,
  error: null,
  configuredHint: false,
};

function getOpenClawHomeDir() {
  return path.join(DATA_DIR, ".openclaw");
}

function getWeixinAccountsDir() {
  return path.join(getOpenClawHomeDir(), ".openclaw", "openclaw-weixin", "accounts");
}

function getWeixinAccountCount() {
  // Source 1 (legacy): account files on disk.
  let count = 0;
  const dir = getWeixinAccountsDir();
  if (fs.existsSync(dir)) {
    try {
      const files = fs.readdirSync(dir);
      count = files.filter((f) => f.endsWith(".json") && !f.endsWith(".sync.json")).length;
    } catch {
      count = 0;
    }
  }
  if (count > 0) return count;

  // Source 2 (current plugin behavior): accounts written into internal openclaw.json.
  try {
    const internalPath = path.join(getOpenClawHomeDir(), ".openclaw", "openclaw.json");
    const internal = JSON.parse(fs.readFileSync(internalPath, "utf-8"));
    const accounts = internal?.channels?.["openclaw-weixin"]?.accounts;
    if (accounts && typeof accounts === "object" && !Array.isArray(accounts)) {
      return Object.keys(accounts).length;
    }
  } catch {
    // ignore parse/read errors and fallback to 0
  }
  return 0;
}

function isWeixinConfigured() {
  return getWeixinAccountCount() > 0;
}

function pushWeixinLoginLog(line) {
  if (!line) return;
  weixinLoginSession.logs.push(line.trim());
  if (weixinLoginSession.logs.length > 80) {
    weixinLoginSession.logs.splice(0, weixinLoginSession.logs.length - 80);
  }
  // Capture terminal QR block so frontend can echo it directly.
  if (/^[\s█▄▀]+$/.test(line) && (line.includes("█") || line.includes("▄") || line.includes("▀"))) {
    weixinLoginSession.collectingQrAscii = true;
    weixinLoginSession.qrAsciiLines.push(line);
    if (weixinLoginSession.qrAsciiLines.length > 60) {
      weixinLoginSession.qrAsciiLines.splice(0, weixinLoginSession.qrAsciiLines.length - 60);
    }
  } else if (weixinLoginSession.collectingQrAscii && line.trim() === "") {
    weixinLoginSession.collectingQrAscii = false;
  }
  // Prefer plugin's explicit "二维码链接: <url>" output.
  // IMPORTANT: always overwrite so QR refresh gets reflected in UI.
  const explicit = line.match(/二维码链接[:：]\s*(\S+)/);
  if (explicit && explicit[1]) {
    weixinLoginSession.qrUrl = explicit[1].trim();
    return;
  }
  // Success hint from plugin output, used to stop re-acquiring QR immediately.
  if (/绑定成功|已绑定|登录成功|扫码成功/i.test(line)) {
    weixinLoginSession.configuredHint = true;
  }
  // Fallback: first URL in output.
  if (!weixinLoginSession.qrUrl) {
    const generic = line.match(/https?:\/\/\S+/);
    if (generic && generic[0]) {
      weixinLoginSession.qrUrl = generic[0].trim();
    }
  }
}

function getWeixinLoginStatusPayload() {
  const running = Boolean(weixinLoginSession.proc && !weixinLoginSession.proc.killed);
  const configured = isWeixinConfigured() || weixinLoginSession.configuredHint;
  return {
    running,
    configured,
    accountCount: getWeixinAccountCount(),
    qrUrl: weixinLoginSession.qrUrl || null,
    qrAscii: weixinLoginSession.qrAsciiLines.length > 0
      ? weixinLoginSession.qrAsciiLines.slice(-40)
      : null,
    startedAt: weixinLoginSession.startedAt || null,
    exitCode: weixinLoginSession.exitCode,
    error: weixinLoginSession.error,
    logs: weixinLoginSession.logs.slice(-20),
  };
}

const SHARED_CONFIG = JSON.parse(
  fs.readFileSync(path.join(SCRIPT_DIR, "shared-config.json"), "utf-8"),
);
const KNOWN_PROVIDERS = SHARED_CONFIG.providers.map((p) => p.id);

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  try {
    const content = fs.readFileSync(filePath);
    const headers = { "Content-Type": contentType, ...SECURITY_HEADERS };
    // Prevent browser from caching HTML (so updates take effect immediately)
    if (ext === ".html") {
      headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    }
    res.writeHead(200, headers);
    res.end(content);
  } catch {
    return false;
  }
  return true;
}

/** Write JSON response with security headers. */
function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(data));
}

// Build provider ID → OpenClaw provider name mapping from shared-config.json.
// Providers with an "openclawId" field use that; others default to their own "id".
const OPENCLAW_PROVIDER = Object.fromEntries(
  SHARED_CONFIG.providers
    .filter((p) => p.openclawId)
    .map((p) => [p.id, p.openclawId]),
);

/**
 * Write auth-profiles.json for the agent auth store.
 * Format verified from OpenClaw source: src/agents/auth-profiles/types.ts
 */
function syncAuthProfiles(config) {
  const profiles = {};
  for (const provider of KNOWN_PROVIDERS) {
    const apiKey = config[provider]?.apiKey;
    if (!apiKey) continue;
    const openclawProvider = OPENCLAW_PROVIDER[provider] || provider;
    const profileKey = `${openclawProvider}:default`;
    // Don't overwrite if already set by a higher-priority alias
    if (profiles[profileKey]) continue;
    profiles[profileKey] = {
      type: "api_key",
      provider: openclawProvider,
      key: apiKey,
    };
  }

  if (Object.keys(profiles).length === 0) return;

  const store = { version: 1, profiles };
  const agentDir = path.join(
    DATA_DIR,
    ".openclaw",
    ".openclaw",
    "agents",
    "main",
    "agent",
  );
  fs.mkdirSync(agentDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(agentDir, "auth-profiles.json"),
    JSON.stringify(store, null, 2),
    { encoding: "utf-8", mode: 0o600 },
  );
}

// Reverse mapping: OpenClaw provider name → UI config key.
// e.g. "moonshot" → "kimi" (so syncInternalConfig can find the API key).
const CONFIG_KEY_FOR_PROVIDER = Object.fromEntries(
  SHARED_CONFIG.providers
    .filter((p) => p.openclawId)
    .map((p) => [p.openclawId, p.id]),
);

function normalizeCustomBaseUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw.trim().replace(/\/+$/, "");
}

function customModelIdFromUserConfig(config) {
  const m = config.agent?.model;
  if (typeof m === "string" && m.startsWith("custom/") && m.length > 7) {
    return m.slice(7).trim();
  }
  const n = config.custom?.modelName;
  if (typeof n === "string" && n.trim()) return n.trim();
  return "";
}

/**
 * Inject models.providers.custom when the active model is custom/... and config.custom is filled.
 */
function applyCustomProviderToInternal(config, internal) {
  const agentModel = typeof config.agent?.model === "string" ? config.agent.model : "";
  if (!agentModel.startsWith("custom/")) {
    if (internal.models?.providers?.custom) delete internal.models.providers.custom;
    return;
  }

  const cust = config.custom;
  if (!cust || typeof cust !== "object") {
    if (internal.models?.providers?.custom) delete internal.models.providers.custom;
    return;
  }

  const baseUrl = normalizeCustomBaseUrl(cust.baseUrl);
  const modelId = customModelIdFromUserConfig(config);
  const apiKey = typeof cust.apiKey === "string" ? cust.apiKey : "";
  const api =
    cust.api === "anthropic-messages" ? "anthropic-messages" : "openai-completions";

  if (!baseUrl || !modelId) {
    if (internal.models?.providers?.custom) delete internal.models.providers.custom;
    return;
  }

  if (!internal.models) internal.models = {};
  if (!internal.models.providers) internal.models.providers = {};
  const existing = internal.models.providers.custom || {};
  const displayName =
    typeof cust.displayName === "string" && cust.displayName.trim()
      ? cust.displayName.trim()
      : modelId;

  internal.models.providers.custom = {
    ...existing,
    baseUrl,
    api,
    apiKey: apiKey || existing.apiKey,
    models: [{ id: modelId, name: displayName }],
  };
}

/**
 * Sync model + all provider configs to OpenClaw's internal config.
 * API keys go through auth-profiles.json primarily, but also written here
 * as belt-and-suspenders. Provider entries must be COMPLETE (baseUrl, api, models)
 * to pass Zod strict validation.
 */
function syncInternalConfig(config, { updateModel = false } = {}) {
  const internalDir = path.join(DATA_DIR, ".openclaw", ".openclaw");
  const internalPath = path.join(internalDir, "openclaw.json");

  let internal = {};
  try {
    internal = JSON.parse(fs.readFileSync(internalPath, "utf-8"));
  } catch {
    // File doesn't exist yet, start fresh
  }

  // Local-only: no auth + no device identity checks
  if (!internal.gateway) internal.gateway = {};
  if (!internal.gateway.auth) internal.gateway.auth = {};
  internal.gateway.auth.mode = "none";
  if (!internal.gateway.controlUi) internal.gateway.controlUi = {};
  internal.gateway.controlUi.allowInsecureAuth = true;
  internal.gateway.controlUi.dangerouslyDisableDeviceAuth = true;

  // Model sync: only write agents.defaults.model when explicitly requested.
  // Previously this ran on EVERY PUT, overwriting whatever model the user
  // selected in the 18789 Control UI with whatever was in our user config.
  if (!internal.agents) internal.agents = {};
  if (!internal.agents.defaults) internal.agents.defaults = {};
  if (updateModel) {
    const model = config.agent?.model;
    if (model) {
      internal.agents.defaults.model = model;
    }
  }
  if (!internal.agents.defaults.model) {
    internal.agents.defaults.model = "minimax/MiniMax-M2.7";
  }

  // Disable heartbeat (visible "Read HEARTBEAT.md" every 30 min in 18789 chat).
  // heartbeat is part of agents.defaults which IS in the config schema.
  internal.agents.defaults.heartbeat = { every: "0" };

  // NOTE: browser, canvasHost, discovery.mdns, update.checkOnStart are NOT in
  // OpenClaw's config file Zod schema (they're CLI/runtime params). Writing them
  // to openclaw.json causes Zod strict() validation failure → gateway crash.
  // These are disabled via env vars in the gateway spawn call instead.

  // Explicitly set workspace path so OpenClaw finds ClawHub skills.
  // Without this, OpenClaw defaults to ~/.openclaw/workspace/ which
  // doesn't contain the bundled skills we installed to $OPENCLAW_HOME/workspace/.
  const workspacePath = path.join(DATA_DIR, ".openclaw", "workspace");
  internal.agents.defaults.workspace = workspacePath;

  // Write provider configs for all providers that have entries in shared-config.json.
  // This ensures OpenClaw knows the baseUrl/api/models for each provider.
  if (!internal.models) internal.models = {};
  if (!internal.models.providers) internal.models.providers = {};

  for (const [providerKey, providerCfg] of Object.entries(SHARED_CONFIG)) {
    if (providerKey === "providers") continue;
    if (!providerCfg.baseUrl) continue;

    // Resolve API key: check config under the UI provider ID
    const configKey = CONFIG_KEY_FOR_PROVIDER[providerKey] || providerKey;
    const apiKey = config[configKey]?.apiKey || config[providerKey]?.apiKey;

    const existing = internal.models.providers[providerKey] || {};
    // Merge models: keep user-added models from OpenClaw, add ours if missing
    const existingModels = Array.isArray(existing.models) ? existing.models : [];
    const sharedModels = Array.isArray(providerCfg.models) ? providerCfg.models : [];
    const mergedModelIds = new Set(existingModels.map((m) => m.id || m));
    const mergedModels = [...existingModels];
    for (const m of sharedModels) {
      if (!mergedModelIds.has(m.id || m)) {
        mergedModels.push(m);
      }
    }

    internal.models.providers[providerKey] = {
      ...existing,
      baseUrl: providerCfg.baseUrl,
      apiKey: apiKey ?? existing.apiKey,
      api: providerCfg.api,
      models: mergedModels,
    };
  }

  // User-defined OpenAI-compatible or Anthropic-compatible endpoint (config.custom + agent.model custom/...)
  applyCustomProviderToInternal(config, internal);

  // Register community plugins on-demand only.
  // Load channel plugins only when user has configured and enabled that channel.
  const corePlugins = path.join(BASE_DIR, "app", "core", "node_modules");
  const pluginPaths = [];
  const userChannels = (config.channels && typeof config.channels === "object") ? config.channels : {};
  // Map: channel config key → plugin npm path
  const pluginMap = {
    qqbot: path.join(corePlugins, "@tencent-connect", "openclaw-qqbot"),
    "openclaw-weixin": path.join(corePlugins, "@tencent-weixin", "openclaw-weixin"),
    // Feishu is BUNDLED in OpenClaw 3.22+ — never register here
  };
  const isChannelEnabled = (channelId) => {
    const ch = userChannels[channelId];
    if (!ch || typeof ch !== "object" || Array.isArray(ch)) return false;
    return ch.enabled !== false;
  };
  const qqPluginPath = pluginMap.qqbot;
  const weixinPluginPath = pluginMap["openclaw-weixin"];
  if (fs.existsSync(qqPluginPath) && isChannelEnabled("qqbot")) {
    pluginPaths.push(qqPluginPath);
  }
  if (fs.existsSync(weixinPluginPath) && isChannelEnabled("openclaw-weixin")) {
    pluginPaths.push(weixinPluginPath);
  }

  // Clean up stale plugins from $OPENCLAW_HOME/node_modules/ left by previous versions.
  // These have broken openclaw/plugin-sdk resolution and cause gateway load failures.
  const stalePluginDir = path.join(DATA_DIR, ".openclaw", "node_modules");
  if (fs.existsSync(stalePluginDir)) {
    try { fs.rmSync(stalePluginDir, { recursive: true, force: true }); } catch { /* ok */ }
  }
  if (!internal.plugins) internal.plugins = {};
  if (!internal.plugins.load) internal.plugins.load = {};
  if (pluginPaths.length > 0) {
    internal.plugins.load.paths = pluginPaths;
  } else if (internal.plugins.load && internal.plugins.load.paths) {
    delete internal.plugins.load.paths;
  }

  // Keep default channel list from previous internal config, but manage feishu/qqbot/weixin on-demand.
  const MANAGED_CHANNELS = new Set(["feishu", "qqbot", "openclaw-weixin"]);
  const prevChannels =
    internal.channels && typeof internal.channels === "object" && !Array.isArray(internal.channels)
      ? internal.channels
      : {};
  const channels = {};
  for (const [id, raw] of Object.entries(prevChannels)) {
    if (!MANAGED_CHANNELS.has(id)) channels[id] = raw;
  }
  const incomingChannels =
    config.channels && typeof config.channels === "object" && !Array.isArray(config.channels)
      ? config.channels
      : {};
  for (const [id, incomingRaw] of Object.entries(incomingChannels)) {
    if (!MANAGED_CHANNELS.has(id)) continue;
    const incoming =
      incomingRaw && typeof incomingRaw === "object" && !Array.isArray(incomingRaw)
        ? incomingRaw
        : null;
    if (!incoming || incoming.enabled === false) continue;
    const existing = prevChannels[id];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      channels[id] = { ...existing, ...incoming };
    } else {
      channels[id] = incoming;
    }
  }
  if (Object.keys(channels).length > 0) internal.channels = channels;
  else delete internal.channels;

  fs.mkdirSync(internalDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    internalPath,
    JSON.stringify(internal, null, 2),
    { encoding: "utf-8", mode: 0o600 },
  );
}

/** Module-level reference to the gateway child process (set in supervisor mode). */
let gatewayChildProcess = null;

/**
 * Notify the OpenClaw gateway to do a graceful restart.
 * On Unix: SIGUSR1. On Windows: write a .restart sentinel file that
 * OpenClaw's health-monitor detects.
 *
 * This is the ONLY mechanism that causes the 18789 Control UI to refresh
 * config. File-based chokidar hot-reload updates runtime but does NOT
 * push changes to connected WebSocket clients.
 */
function notifyGatewayRestart() {
  if (!gatewayChildProcess || gatewayChildProcess.killed) return;

  if (process.platform !== "win32") {
    // Unix: SIGUSR1 triggers graceful restart
    try { gatewayChildProcess.kill("SIGUSR1"); } catch { /* ok */ }
    return;
  }

  // Windows: no SIGUSR1. Kill and re-spawn the gateway process.
  // The supervisor will detect the exit and the health check loop will
  // wait for the new process to start. This is heavy but reliable.
  // Note: we set a flag so the exit handler doesn't terminate the whole process.
  gatewayRestarting = true;
  try { gatewayChildProcess.kill(); } catch { /* ok */ }
}

let gatewayRestarting = false;

/** Mask all apiKey fields in a config object — returns last 4 chars only. */
function maskApiKeys(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const result = {};
  for (const key of Object.keys(obj)) {
    if (key === "apiKey" && typeof obj[key] === "string") {
      const k = obj[key];
      result[key] = k.length > 4 ? "****" + k.slice(-4) : "****";
    } else {
      result[key] = maskApiKeys(obj[key]);
    }
  }
  return result;
}

function handleApiConfig(req, res) {
  const configPath = path.join(DATA_DIR, ".openclaw", "openclaw.json");

  if (req.method === "GET") {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      jsonResponse(res, 200, maskApiKeys(raw));
    } catch {
      jsonResponse(res, 404, { error: "Config not found" });
    }
    return;
  }

  if (req.method === "PUT" || req.method === "POST") {
    readBody(req, res, (body) => {
      try {
        const parsed = JSON.parse(body);

        // Restore real API keys when frontend sends masked values (****xxxx)
        let existing = {};
        try { existing = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch { /* first run */ }
        for (const key of Object.keys(parsed)) {
          if (
            parsed[key] &&
            typeof parsed[key] === "object" &&
            typeof parsed[key].apiKey === "string" &&
            parsed[key].apiKey.startsWith("****")
          ) {
            if (existing[key]?.apiKey) {
              parsed[key].apiKey = existing[key].apiKey;
            }
          }
        }

        const finalBody = JSON.stringify(parsed, null, 2);
        fs.mkdirSync(path.dirname(configPath), { recursive: true, mode: 0o700 });
        fs.writeFileSync(configPath, finalBody, { encoding: "utf-8", mode: 0o600 });

        // Sync to OpenClaw auth store and internal config
        syncAuthProfiles(parsed);
        // Only update the model in internal config if the user explicitly changed it.
        // Without this check, saving an API key overwrites whatever model the user
        // selected in the 18789 Control UI.
        const modelChanged = parsed.agent?.model && parsed.agent.model !== existing.agent?.model;
        const channelsChanged = JSON.stringify(parsed.channels || null) !== JSON.stringify(existing.channels || null);
        const customChanged =
          JSON.stringify(parsed.custom || null) !== JSON.stringify(existing.custom || null);
        syncInternalConfig(parsed, { updateModel: modelChanged });

        // Delay restart 500ms to let chokidar complete its hot-reload cycle (300ms debounce).
        // Without this delay, the gateway restart races with hot-reload and may cache stale model.
        const needsRestart = modelChanged || channelsChanged || customChanged;
        if (needsRestart) {
          setTimeout(() => notifyGatewayRestart(), 500);
        }

        jsonResponse(res, 200, { success: true });
      } catch {
        jsonResponse(res, 400, { error: "Invalid JSON" });
      }
    });
    return;
  }

  res.writeHead(405, SECURITY_HEADERS);
  res.end();
}

function handleApiVersion(res) {
  const versionPath = path.join(BASE_DIR, "version.txt");
  try {
    const version = fs.readFileSync(versionPath, "utf-8").trim();
    jsonResponse(res, 200, { version });
  } catch {
    jsonResponse(res, 500, { error: "Version file not found" });
  }
}

function handleApiOpenclawVersion(res) {
  const pkgPath = path.join(BASE_DIR, "app", "core", "node_modules", "openclaw", "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    jsonResponse(res, 200, { version: pkg.version });
  } catch {
    jsonResponse(res, 500, { error: "OpenClaw version not found" });
  }
}

// ---------------------------------------------------------------------------
// OpenClaw kernel version check: /api/openclaw-check (GET)
// Portable runtime has no npm — OpenClaw updates ship with OpenClawU盘便携版 releases
// release packages. This endpoint only CHECKS for updates (no install).
// ---------------------------------------------------------------------------

function handleApiOpenclawCheck(res) {
  const pkgPath = path.join(BASE_DIR, "app", "core", "node_modules", "openclaw", "package.json");
  let current = "unknown";
  try {
    current = JSON.parse(fs.readFileSync(pkgPath, "utf-8")).version;
  } catch { /* ok */ }

  // Check npm registry for latest version
  const https = require("https");
  const req = https.get("https://registry.npmjs.org/openclaw/latest", { timeout: 10000 }, (apiRes) => {
    let body = "";
    apiRes.on("data", (chunk) => { body += chunk; });
    apiRes.on("end", () => {
      try {
        const data = JSON.parse(body);
        const latest = data.version || "unknown";
        jsonResponse(res, 200, { current, latest, updateAvailable: current !== latest && latest !== "unknown" });
      } catch {
        jsonResponse(res, 200, { current, latest: null, updateAvailable: false });
      }
    });
  });
  req.on("error", () => {
    jsonResponse(res, 200, { current, latest: null, updateAvailable: false, error: "无法检查 OpenClaw 更新" });
  });
  req.on("timeout", () => { req.destroy(); });
}

/** Whether optional channel npm packages are present next to openclaw (same node_modules). */
function handleApiChannelPlugins(res) {
  const coreNm = path.join(BASE_DIR, "app", "core", "node_modules");
  const qqbot = fs.existsSync(
    path.join(coreNm, "@tencent-connect", "openclaw-qqbot", "package.json"),
  );
  const openclawWeixin = fs.existsSync(
    path.join(coreNm, "@tencent-weixin", "openclaw-weixin", "package.json"),
  );
  jsonResponse(res, 200, { qqbot, openclawWeixin });
}

function handleApiHealth(res) {
  const gatewayUrl = `http://${GATEWAY_HOST}:${GATEWAY_PORT}/health`;
  const reqLib = require("http");

  reqLib
    .get(gatewayUrl, { timeout: 3000 }, (gwRes) => {
      let data = "";
      gwRes.on("data", (chunk) => (data += chunk));
      gwRes.on("end", () => {
        jsonResponse(res, 200, {
          ui: "ok",
          gateway: "ok",
          gatewayResponse: data,
        });
      });
    })
    .on("error", () => {
      jsonResponse(res, 200, { ui: "ok", gateway: "unreachable" });
    });
}

function handleApiWeixinLoginStatus(req, res) {
  if (req.method !== "GET") {
    res.writeHead(405, SECURITY_HEADERS);
    res.end();
    return;
  }
  jsonResponse(res, 200, getWeixinLoginStatusPayload());
}

function proxyRemoteImage(urlStr, res, redirectsLeft = 3) {
  let target;
  try {
    target = new URL(urlStr);
  } catch {
    res.writeHead(400, SECURITY_HEADERS);
    res.end("Bad QR URL");
    return;
  }

  const lib = target.protocol === "http:" ? require("http") : require("https");
  const req = lib.request(
    {
      hostname: target.hostname,
      port: target.port || (target.protocol === "http:" ? 80 : 443),
      path: `${target.pathname}${target.search || ""}`,
      method: "GET",
      headers: {
        "User-Agent": "PocketClaw/1.0",
        Accept: "image/*,*/*;q=0.8",
      },
      timeout: 10000,
    },
    (upstream) => {
      const code = upstream.statusCode || 500;
      const location = upstream.headers.location;
      if (
        redirectsLeft > 0 &&
        (code === 301 || code === 302 || code === 303 || code === 307 || code === 308) &&
        location
      ) {
        const nextUrl = new URL(location, target).toString();
        upstream.resume();
        proxyRemoteImage(nextUrl, res, redirectsLeft - 1);
        return;
      }

      if (code < 200 || code >= 300) {
        upstream.resume();
        res.writeHead(502, SECURITY_HEADERS);
        res.end("QR upstream unavailable");
        return;
      }

      const contentType = String(upstream.headers["content-type"] || "image/png");
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        ...SECURITY_HEADERS,
      });
      upstream.pipe(res);
    },
  );
  req.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, SECURITY_HEADERS);
      res.end("QR fetch failed");
    }
  });
  req.on("timeout", () => {
    req.destroy();
    if (!res.headersSent) {
      res.writeHead(504, SECURITY_HEADERS);
      res.end("QR fetch timeout");
    }
  });
  req.end();
}

function handleApiWeixinLoginQrcode(req, res) {
  if (req.method !== "GET") {
    res.writeHead(405, SECURITY_HEADERS);
    res.end();
    return;
  }
  const qrUrl = (weixinLoginSession.qrUrl || "").trim();
  if (!qrUrl) {
    res.writeHead(404, SECURITY_HEADERS);
    res.end("QR not ready");
    return;
  }
  proxyRemoteImage(qrUrl, res);
}

function handleApiWeixinLoginStart(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, SECURITY_HEADERS);
    res.end();
    return;
  }

  readBody(req, res, (body) => {
    let force = false;
    try {
      const parsed = body ? JSON.parse(body) : {};
      force = Boolean(parsed.force);
    } catch {
      force = false;
    }

    // If already configured, return immediately unless force requested.
    if (!force && isWeixinConfigured()) {
      jsonResponse(res, 200, getWeixinLoginStatusPayload());
      return;
    }

    // If a login command is already running: return current state unless force requested.
    if (weixinLoginSession.proc && !weixinLoginSession.proc.killed) {
      if (!force) {
        jsonResponse(res, 200, getWeixinLoginStatusPayload());
        return;
      }
      try { weixinLoginSession.proc.kill(); } catch { /* ignore */ }
      weixinLoginSession.proc = null;
    }

    const { spawn } = require("child_process");
    const openclawEntry = findOpenClawEntry();
    if (!openclawEntry) {
      jsonResponse(res, 500, { error: "OpenClaw entry not found" });
      return;
    }

    weixinLoginSession.proc = null;
    weixinLoginSession.startedAt = Date.now();
    weixinLoginSession.qrUrl = "";
    weixinLoginSession.qrAsciiLines = [];
    weixinLoginSession.collectingQrAscii = false;
    weixinLoginSession.logs = [];
    weixinLoginSession.exitCode = null;
    weixinLoginSession.error = null;
    weixinLoginSession.configuredHint = false;

    const child = spawn(
      process.execPath,
      [openclawEntry, "channels", "login", "--channel", "openclaw-weixin"],
      {
        cwd: BASE_DIR,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          OPENCLAW_HOME: getOpenClawHomeDir(),
        },
      },
    );
    weixinLoginSession.proc = child;

    child.stdout.on("data", (chunk) => {
      const text = String(chunk || "");
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (t) pushWeixinLoginLog(t);
      }
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk || "");
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (t) pushWeixinLoginLog(t);
      }
    });
    child.on("error", (err) => {
      weixinLoginSession.error = String(err?.message || err || "failed to start weixin login");
    });
    child.on("exit", (code) => {
      weixinLoginSession.exitCode = code;
      if (code === 0) {
        // openclaw channels login succeeded; config persistence may lag briefly.
        weixinLoginSession.configuredHint = true;
      }
      if (code !== 0 && !isWeixinConfigured()) {
        weixinLoginSession.error = weixinLoginSession.error || `weixin login exited with code ${code}`;
      }
      weixinLoginSession.proc = null;
    });

    // Return quickly so frontend can start polling.
    setTimeout(() => {
      jsonResponse(res, 200, getWeixinLoginStatusPayload());
    }, 200);
  });
}

// Loaded from shared-config.json (single source of truth for providers).
const PROVIDER_VALIDATORS = Object.fromEntries(
  SHARED_CONFIG.providers
    .filter((p) => p.validateUrl)
    .map((p) => [
      p.id,
      { url: p.validateUrl, method: p.validateMethod, auth: p.validateAuth },
    ]),
);

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

function readBody(req, res, callback) {
  let body = "";
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      jsonResponse(res, 413, { error: "Payload too large" });
      req.destroy();
      return;
    }
    body += chunk;
  });
  req.on("end", () => callback(body));
}

function validateKeyRequest(validator, apiKey, model, res) {
  const https = require("https");
  const urlObj = new URL(validator.url);

  const headers = { "Content-Type": "application/json" };
  if (validator.auth === "bearer") {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  }

  let postData = null;
  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname,
    method: validator.method,
    headers,
    timeout: 10000,
  };

  if (validator.method === "POST") {
    let modelId = (model || "").split("/")[1] || "";
    if (!modelId) {
      // Fallback model for validation by provider
      if (urlObj.hostname.includes("minimaxi")) modelId = "MiniMax-M2.7";
      else if (urlObj.hostname.includes("anthropic")) modelId = "claude-haiku-4-5";
      else if (urlObj.hostname.includes("volces.com")) modelId = "doubao-seed-2-0-mini-260215";
      else modelId = "test";
    }
    postData = JSON.stringify({
      model: modelId,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    });
    options.headers["Content-Length"] = Buffer.byteLength(postData);
  }

  const apiReq = https.request(options, (apiRes) => {
    let body = "";
    apiRes.on("data", (c) => { body += c; });
    apiRes.on("end", () => {
      if (res.headersSent) return;
      if (apiRes.statusCode === 401 || apiRes.statusCode === 403) {
        // Try to extract error message from response body
        let detail = "";
        try {
          const parsed = JSON.parse(body);
          detail = parsed.error?.message || parsed.message || "";
        } catch { /* not JSON */ }
        const errorMsg = detail
          ? `验证失败 (HTTP ${apiRes.statusCode}): ${detail}`
          : `API Key 无效 (HTTP ${apiRes.statusCode})`;
        jsonResponse(res, 200, { valid: false, error: errorMsg });
      } else {
        jsonResponse(res, 200, { valid: true });
      }
    });
  });

  apiReq.on("error", () => {
    if (!res.headersSent) jsonResponse(res, 200, { valid: true });
  });

  apiReq.on("timeout", () => {
    apiReq.destroy();
    if (!res.headersSent) jsonResponse(res, 200, { valid: true });
  });

  if (postData) apiReq.write(postData);
  apiReq.end();
}

function requestUrlOnce(urlStr, headers, timeoutMs, callback) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    callback(new Error("bad url"), null);
    return;
  }
  const lib = u.protocol === "http:" ? require("http") : require("https");
  const opts = {
    hostname: u.hostname,
    port: u.port || (u.protocol === "http:" ? 80 : 443),
    path: `${u.pathname}${u.search || ""}`,
    method: "GET",
    headers,
    timeout: timeoutMs,
  };
  const req = lib.request(opts, (apiRes) => {
    callback(null, apiRes);
  });
  req.on("error", (e) => callback(e, null));
  req.on("timeout", () => {
    req.destroy();
    callback(new Error("timeout"), null);
  });
  req.end();
}

/** Try OpenAI-compatible /v1/models (or /models) with Bearer key. */
function validateCustomProviderKey(baseUrl, apiKey, apiMode, res) {
  const raw = normalizeCustomBaseUrl(baseUrl);
  if (!raw || !apiKey) {
    jsonResponse(res, 200, { valid: false, error: "请填写 API 根地址与 Key" });
    return;
  }

  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let root;
  try {
    root = new URL(withProto);
  } catch {
    jsonResponse(res, 200, { valid: false, error: "API 地址格式无效" });
    return;
  }

  // Anthropic-compatible bases vary; skip remote probe (same as many CLI tools).
  if (apiMode === "anthropic-messages") {
    jsonResponse(res, 200, { valid: true });
    return;
  }

  const origin = root.origin;
  const pathname = (root.pathname || "").replace(/\/$/, "");
  const urls = [
    pathname.endsWith("/v1")
      ? `${origin}${pathname}/models`
      : `${origin}${pathname}/v1/models`,
    `${origin}${pathname}/models`,
  ];

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  let i = 0;
  const next = () => {
    if (res.headersSent) return;
    if (i >= urls.length) {
      jsonResponse(res, 200, { valid: true });
      return;
    }
    const url = urls[i++];
    requestUrlOnce(url, headers, 8000, (err, apiRes) => {
      if (res.headersSent) return;
      if (err) {
        next();
        return;
      }
      apiRes.resume();
      const code = apiRes.statusCode ?? 0;
      if (code === 401 || code === 403) {
        jsonResponse(res, 200, { valid: false, error: "API Key 无效或无权限" });
        return;
      }
      if (code === 404) {
        next();
        return;
      }
      jsonResponse(res, 200, { valid: true });
    });
  };
  next();
}

function handleApiValidateKey(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, SECURITY_HEADERS);
    res.end();
    return;
  }

  readBody(req, res, (body) => {
    try {
      const parsed = JSON.parse(body);
      const { provider, apiKey, model, baseUrl, api } = parsed;
      if (provider === "custom") {
        const mode = api === "anthropic-messages" ? "anthropic-messages" : "openai-completions";
        validateCustomProviderKey(baseUrl, apiKey, mode, res);
        return;
      }
      const validator = PROVIDER_VALIDATORS[provider];
      if (!validator || !apiKey) {
        jsonResponse(res, 200, { valid: true });
        return;
      }
      validateKeyRequest(validator, apiKey, model, res);
    } catch {
      jsonResponse(res, 400, { error: "Invalid request" });
    }
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${UI_PORT}`);
  const pathname = url.pathname;

  if (pathname === "/api/config") return handleApiConfig(req, res);
  if (pathname === "/api/validate-key") return handleApiValidateKey(req, res);
  if (pathname === "/api/version") return handleApiVersion(res);
  if (pathname === "/api/openclaw-version") return handleApiOpenclawVersion(res);
  if (pathname === "/api/health") return handleApiHealth(res);
  if (pathname === "/api/channel-plugins") return handleApiChannelPlugins(res);
  if (pathname === "/api/openclaw-check") return handleApiOpenclawCheck(res);
  if (pathname === "/api/weixin-login/start") return handleApiWeixinLoginStart(req, res);
  if (pathname === "/api/weixin-login/status") return handleApiWeixinLoginStatus(req, res);
  if (pathname === "/api/weixin-login/qrcode") return handleApiWeixinLoginQrcode(req, res);

  const filePath = path.join(UI_DIR, pathname === "/" ? "index.html" : pathname);
  if (serveStatic(res, filePath)) return;

  const indexPath = path.join(UI_DIR, "index.html");
  if (serveStatic(res, indexPath)) return;

  res.writeHead(404, SECURITY_HEADERS);
  res.end("Not Found");
});

server.on("upgrade", (req, socket, head) => {
  createProxyServer(req, socket, head, GATEWAY_HOST, GATEWAY_PORT);
});

// ---------------------------------------------------------------------------
// --supervisor mode: manage gateway lifecycle (used by .bat / .command launcher)
// ---------------------------------------------------------------------------

function findOpenClawEntry() {
  const coreDir = path.join(BASE_DIR, "app", "core", "node_modules", "openclaw");
  const pkgPath = path.join(coreDir, "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    // Try bin field first
    if (typeof pkg.bin === "string") {
      const entry = path.join(coreDir, pkg.bin);
      if (fs.existsSync(entry)) return entry;
    } else if (typeof pkg.bin === "object" && pkg.bin !== null) {
      for (const v of Object.values(pkg.bin)) {
        const entry = path.join(coreDir, v);
        if (fs.existsSync(entry)) return entry;
      }
    }
    // Fallback to main
    if (pkg.main) {
      const entry = path.join(coreDir, pkg.main);
      if (fs.existsSync(entry)) return entry;
    }
  } catch { /* fall through */ }
  // Last resort: common patterns
  for (const candidate of ["bin/cli.js", "dist/cli.js", "dist/index.js"]) {
    const entry = path.join(coreDir, candidate);
    if (fs.existsSync(entry)) return entry;
  }
  return null;
}

function openBrowser(url) {
  const { exec } = require("child_process");
  if (process.platform === "win32") exec(`start ${url}`);
  else if (process.platform === "darwin") exec(`open ${url}`);
}

if (process.argv.includes("--supervisor")) {
  const { spawn, execSync } = require("child_process");
  const log = (msg) => console.log(`  ${msg}`);
  const supervisorExit = (code) => {
    if (code !== 0 && process.platform === "win32") {
      try {
        execSync("pause", { stdio: "inherit", shell: true });
      } catch {
        /* user closed console */
      }
    }
    process.exit(code);
  };

  // 1. Config sync
  const configPath = path.join(DATA_DIR, ".openclaw", "openclaw.json");
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch { /* first run, no config yet */ }

  process.env.OPENCLAW_HOME = path.join(DATA_DIR, ".openclaw");
  process.env.PATH = path.join(BASE_DIR, "app", "runtime", "node-win-x64") +
    path.delimiter + process.env.PATH;

  // Always sync internal config (gateway auth settings) even on first run with empty config.
  // Without this, gateway.auth.mode="none" and dangerouslyDisableDeviceAuth=true are never
  // written, causing the gateway to reject UI WebSocket connections on fresh installs.
  // On startup, set model from user config (first-time setup or config migration).
  // After startup, model changes come from 18789 Control UI and should NOT be overwritten.
  syncInternalConfig(config, { updateModel: true });
  if (Object.keys(config).length > 0) {
    syncAuthProfiles(config);
  }
  log("配置同步完成");

  // 2. Find OpenClaw
  const openclawEntry = findOpenClawEntry();
  if (!openclawEntry) {
    log("[错误] AI 引擎未找到，请确认文件完整。");
    supervisorExit(1);
  }

  // Apply proxy from user config (Settings)
  if (config.proxy?.httpsProxy) {
    process.env.HTTPS_PROXY = config.proxy.httpsProxy;
    process.env.HTTP_PROXY = config.proxy.httpsProxy;
  }

  // 3. Start gateway
  log("正在启动 AI 引擎...");
  let gatewayProcess = spawn(
    process.execPath,
    [openclawEntry, "gateway", "--port", String(GATEWAY_PORT), "--allow-unconfigured"],
    {
      cwd: BASE_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        OPENCLAW_HOME: path.join(DATA_DIR, ".openclaw"),
        // Pass through proxy settings so OpenClaw can reach overseas APIs
        // Proxy passthrough
        ...(process.env.HTTPS_PROXY ? { HTTPS_PROXY: process.env.HTTPS_PROXY } : {}),
        ...(process.env.HTTP_PROXY ? { HTTP_PROXY: process.env.HTTP_PROXY } : {}),
        ...(process.env.ALL_PROXY ? { ALL_PROXY: process.env.ALL_PROXY } : {}),
        ...(process.env.NO_PROXY ? { NO_PROXY: process.env.NO_PROXY } : {}),
        // Disable non-consumer features via env vars (NOT config file — Zod strict rejects unknown keys)
        OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: "1",
        OPENCLAW_DISABLE_BONJOUR: "1",
        OPENCLAW_SKIP_CANVAS_HOST: "1",
      },
    },
  );
  // Write gateway output to log file for diagnostics
  const logPath = path.join(DATA_DIR, "pocketclaw.log");
  const logStream = fs.createWriteStream(logPath, { flags: "a", mode: 0o600 });
  gatewayChildProcess = gatewayProcess;
  gatewayProcess.stdout.on("data", (chunk) => logStream.write(chunk));
  gatewayProcess.stderr.on("data", (chunk) => logStream.write(chunk));

  // Cleanup on exit
  const cleanup = () => {
    if (gatewayProcess && !gatewayProcess.killed) gatewayProcess.kill();
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  gatewayProcess.on("exit", (code) => {
    if (gatewayRestarting) {
      // Windows model-switch restart: re-spawn the gateway
      gatewayRestarting = false;
      log("[gateway] 模型已切换，正在重启 AI 引擎...");
      const newGw = spawn(
        process.execPath,
        [openclawEntry, "gateway", "--port", String(GATEWAY_PORT), "--allow-unconfigured"],
        { cwd: BASE_DIR, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, OPENCLAW_HOME: path.join(DATA_DIR, ".openclaw") } },
      );
      newGw.stdout.on("data", (chunk) => logStream.write(chunk));
      newGw.stderr.on("data", (chunk) => logStream.write(chunk));
      newGw.on("exit", gatewayProcess.listeners("exit")[0]); // re-attach this handler
      gatewayProcess = newGw;
      gatewayChildProcess = newGw;
      return;
    }
    if (code !== null && code !== 0) {
      log(`[错误] AI 引擎异常退出 (code ${code})`);
      log(`详细日志: ${logPath}`);
      supervisorExit(1);
    }
  });

  // 4. Wait for gateway health
  const waitForGateway = () => {
    let elapsed = 0;
    const retry = () => {
      elapsed++;
      if (elapsed > 90) {
        log("[错误] AI 引擎启动超时（若网关较慢，可查看日志排查）");
        log(`详细日志: ${logPath}`);
        cleanup();
        supervisorExit(1);
      }
      if (elapsed % 5 === 0) log(`仍在加载中...（已等待 ${elapsed} 秒）`);
      setTimeout(check, 1000);
    };
    const check = () => {
      // req.destroy() after timeout also emits "error"; guard so we only retry once per probe.
      let settled = false;
      const failOnce = () => {
        if (settled) return;
        settled = true;
        retry();
      };
      const okOnce = () => {
        if (settled) return;
        settled = true;
        log("AI 引擎已启动");
        startUI();
      };
      const req = http.get(
        `http://127.0.0.1:${GATEWAY_PORT}/health`,
        { timeout: 2000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) okOnce();
          else failOnce();
        },
      );
      req.on("error", failOnce);
      req.on("timeout", () => {
        req.destroy();
        failOnce();
      });
    };
    check();
  };

  // 5. Start UI server + open browser
  const startUI = () => {
    log("正在启动界面...");
    server.listen(UI_PORT, "127.0.0.1", () => {
      log("OpenClawU盘便携版已启动！");
      log(`浏览器地址: http://localhost:${UI_PORT}`);
      log("");
      log("关闭此窗口即可退出OpenClawU盘便携版");
      openBrowser(`http://localhost:${UI_PORT}`);
    });
  };

  waitForGateway();
} else {
  // Normal mode: just start the UI server (gateway managed by Go launcher)
  server.listen(UI_PORT, "127.0.0.1", () => {
    console.log(`[OpenClawU盘便携版 UI] Server running at http://localhost:${UI_PORT}`);
    console.log(
      `[OpenClawU盘便携版 UI] Gateway proxy: ws://localhost:${UI_PORT}/ws -> ws://${GATEWAY_HOST}:${GATEWAY_PORT}`,
    );
  });
}
