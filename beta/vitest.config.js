import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.js", "tests/unit/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
  },
});
