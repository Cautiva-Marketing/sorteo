import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "server-only",
        replacement: path.resolve(import.meta.dirname, "tests/setup/server-only-stub.ts"),
      },
      { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
    ],
  },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/rules/**/*.test.ts",
    ],
    // Las pruebas con emulador comparten estado, por lo que no se ejecutan en paralelo.
    fileParallelism: false,
  },
});
