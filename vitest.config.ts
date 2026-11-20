import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests unitaires du cœur (sérialiseur, explorateur, layout, validation).
// Ce sont des fonctions pures : environnement Node, pas de navigateur simulé.
export default defineConfig({
  resolve: {
    alias: { "@shared": fileURLToPath(new URL("./shared", import.meta.url)) },
  },
  test: {
    include: ["{client,server,shared}/**/*.test.ts"],
    environment: "node",
  },
});
