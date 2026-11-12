import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "es2022",
  },
});
