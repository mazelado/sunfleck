import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// During development, Vite serves the frontend on port 5173 and forwards backend URLs to
// Django on port 8000, so the browser sees a single origin, just like in production.
// `changeOrigin: false` keeps the browser's Host header (localhost:5173), so Django's CSRF
// origin check matches and links Django builds (invitations, password resets) point to Vite.
const backend = { target: "http://localhost:8000", changeOrigin: false };

export default defineConfig({
  plugins: [
    react(),
    // An installable app (PWA): a manifest, icons, and a service worker that keeps the app's
    // files on the phone so it opens instantly. Data always comes fresh from the server.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Sunfleck",
        short_name: "Sunfleck",
        description: "Plant care for your indoor and outdoor plants.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#2f9e44",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Showing push notifications, and opening the app when one is tapped.
        importScripts: ["/push-sw.js"],
        // Pages come from the server first, which also sets the cookie that protects forms
        // (CSRF). Only when it can't be reached does the app open from the stored copy (every
        // page of the app is the same index.html).
        navigateFallback: null,
        runtimeCaching: [
          {
            // Not Django's own pages. (This function is copied into the service worker as
            // text, so it can't use anything defined outside it.)
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && !/^\/(api|admin|_allauth|static)\//.test(url.pathname),
            handler: "NetworkOnly",
            options: { precacheFallback: { fallbackURL: "/index.html" } },
          },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Libraries change less often than the app: in their own files, phones keep them
        // after an update.
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
            },
            // Only libraries every page uses: the others load with the pages that need them.
            { name: "mantine", test: /node_modules[\\/]@mantine[\\/](core|hooks)[\\/]/ },
          ],
        },
      },
    },
  },
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
