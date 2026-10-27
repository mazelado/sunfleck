import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// During development, Vite serves the frontend on port 5173 and forwards backend URLs to
// Django on port 8000, so the browser sees a single origin, just like in production.
// `changeOrigin: false` keeps the browser's Host header (localhost:5173), so Django's CSRF
// origin check matches and links Django builds (invitations, password resets) point to Vite.
const backend = { target: "http://localhost:8000", changeOrigin: false };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": backend,
      "/_allauth": backend,
      "/admin": backend,
      "/static": backend,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
  },
});
