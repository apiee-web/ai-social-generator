import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // So the app can call /api/generate and reach server.cjs during development.
      "/api": "http://localhost:8787",
    },
  },
});
