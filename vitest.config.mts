import { defineConfig } from "vitest/config";
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    fileParallelism: false,
    pool: "threads",
  },
});
