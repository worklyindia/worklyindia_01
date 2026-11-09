import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
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
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Target modern browsers to avoid unnecessary legacy transforms/polyfills.
    target: "es2020",
    // Do not publish production source maps: the public .map requests were
    // returning truncated/invalid JSON and triggering Lighthouse warnings.
    // Keep source maps available in local development through Vite defaults.
    sourcemap: false,
    // Bundle is large (single big vendor chunk); raise the warning threshold
    // so the deploy log stays clean.
    chunkSizeWarningLimit: 6500,
    // Split expensive feature libraries away from the initial application bundle.
    // These chunks are requested only when their importing feature is rendered.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) return "vendor-react";
          if (id.includes("/node_modules/@supabase/")) return "vendor-supabase";
          if (id.includes("/node_modules/firebase/") || id.includes("/node_modules/@firebase/")) return "vendor-firebase";
          if (id.includes("/node_modules/pdfjs-dist/") || id.includes("/node_modules/jspdf/") || id.includes("/node_modules/jspdf-autotable/")) return "vendor-pdf";
          if (id.includes("/node_modules/docx/") || id.includes("/node_modules/html2canvas/") || id.includes("/node_modules/jszip/")) return "vendor-documents";
          if (id.includes("/node_modules/recharts/") || id.includes("/node_modules/d3-")) return "vendor-charts";
          if (id.includes("/node_modules/@100mslive/") || id.includes("/node_modules/@videosdk.live/")) return "vendor-video";
          if (id.includes("/node_modules/@sentry/")) return "vendor-monitoring";
        },
      },
    },
  },
}));
