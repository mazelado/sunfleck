import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// During development, Vite serves the frontend on port 5173 and forwards backend URLs to
// Django on port 8000, so the browser sees a single origin, just like in production.
const backend = "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": backend,
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
