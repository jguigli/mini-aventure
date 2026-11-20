import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Same alias as in the tsconfig files: code shared by client and server.
    alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) },
  },
  server: {
    port: 5173,
    // /api/* calls are proxied to the Express server: no CORS to handle,
    // and the client never knows the OpenAI key.
    proxy: { "/api": "http://localhost:3001" },
  },
});
