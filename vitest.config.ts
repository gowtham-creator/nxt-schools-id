import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // The real `server-only` package throws on import outside an RSC bundle;
      // alias it to an empty stub so server-only modules run under plain Node.
      "server-only": path.resolve(root, "test/stubs/server-only.ts"),
      "@": path.resolve(root, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
