import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Même alias que dans les tsconfig : code partagé client/serveur.
    alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Les appels /api/* sont relayés vers le serveur Express : pas de CORS à gérer,
    // et le client ne connaît jamais la clé OpenAI.
    proxy: { "/api": "http://localhost:3001" },
  },
});
