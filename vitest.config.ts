import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@threadlight/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@threadlight/providers": fileURLToPath(
        new URL("./packages/providers/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      enabled: false,
    },
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
    reporters: ["default"],
  },
});
