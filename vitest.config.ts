import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    // These are integration tests against the real Neon dev database (this
    // project never mocks Postgres — see README), run sequentially so
    // fixtures from one test don't collide with another's.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
