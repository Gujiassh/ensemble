import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@ensemble/protocol": path.resolve(
        __dirname,
        "../../packages/protocol/src/index.ts",
      ),
    },
  },
  server: {
    // Tauri shell (M4) loads http://127.0.0.1:17351 — keep loopback explicit.
    host: "127.0.0.1",
    port: 17351,
    strictPort: true,
  },
  clearScreen: false,
});
