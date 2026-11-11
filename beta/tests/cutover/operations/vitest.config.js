import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export default defineConfig({
  root,
  test: {
    include: ["tests/cutover/operations/**/*.test.ts"],
    fileParallelism: false,
  },
});
