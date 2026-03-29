import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

/**
 * PocketClaw `server.js` (not the OpenClaw gateway) serves /api/* and proxies /ws → gateway.
 * Run it on 3211 while Vite uses 3210 so dev gets real config + validate-key + WS proxy.
 *
 *   pnpm dev:api   # Terminal 1 (from ui/)
 *   pnpm dev       # Terminal 2
 *
 * Or: pnpm dev:full (single command).
 */
const POCKETCLAW_UI_BACKEND =
  process.env.POCKETCLAW_UI_BACKEND?.trim() || "http://127.0.0.1:3211";
const POCKETCLAW_WS_BACKEND = POCKETCLAW_UI_BACKEND.replace(/^http/i, "ws");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3210,
    proxy: {
      "/api": {
        target: POCKETCLAW_UI_BACKEND,
        changeOrigin: true,
      },
      "/ws": {
        target: POCKETCLAW_WS_BACKEND,
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
