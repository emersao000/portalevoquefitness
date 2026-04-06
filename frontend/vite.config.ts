import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const target = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3005,
    proxy: {
      "/api": {
        target,
        changeOrigin: true,
      },
      "/socket.io": {
        target,
        changeOrigin: true,
        ws: true,
      },
      "/ws": {
        target,
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path,
      },
    },
    hmr: {
      port: 3005,
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
