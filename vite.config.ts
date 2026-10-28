import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { devServerBridgePlugin } from "@lovable.dev/vite-plugin-dev-server-bridge";
import { hmrGatePlugin } from "@lovable.dev/vite-plugin-hmr-gate";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { documentPagesPlugin } from "./scripts/document-pages.mjs";
import { autoWebpPlugin } from "./scripts/auto-webp.mjs";
import { routePagesPlugin } from "./scripts/route-pages.mjs";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    autoWebpPlugin(),
    documentPagesPlugin(),
    routePagesPlugin(),
    mcpPlugin(),
    mode === "development" && componentTagger(),
    mode === "development" && hmrGatePlugin(),
    mode === "development" && devServerBridgePlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Bundle is large (single big vendor chunk); raise the warning threshold
    // so the deploy log stays clean.
    chunkSizeWarningLimit: 6500,
  },
}));
