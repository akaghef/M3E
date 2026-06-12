import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.js"],
    fileParallelism: false,
    testTimeout: 30000,
  },
});
