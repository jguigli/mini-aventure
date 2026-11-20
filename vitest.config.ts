import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for the core (serializer, explorer, layout, validation).
// These are pure functions: Node environment, no simulated browser.
export default defineConfig({
  resolve: {
    alias: { "@shared": fileURLToPath(new URL("./shared", import.meta.url)) },
  },
  test: {
    include: ["{client,server,shared}/**/*.test.ts"],
    environment: "node",
  },
});
