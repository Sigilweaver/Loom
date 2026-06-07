import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { aliases } from "./vite.aliases";

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  plugins: [react()],
  server: {
    port: 25803,
    proxy: {
      "/api": {
        target: "http://localhost:25802",
        changeOrigin: true,
      },
    },
  },
});
