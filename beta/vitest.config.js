import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.js", "tests/unit/**/*.test.ts", "tests/cutover/**/*.test.ts"],
    fileParallelism: false,
    // Unit tests must never open the personal workspace under the user home.
    env: { M3E_FORBID_LIVE_DATA: "1" },
    testTimeout: 30000,
    // Neo4j test stores are made and dropped in hooks; a large one takes more than the default 10 s.
    hookTimeout: 120000,
  },
});
