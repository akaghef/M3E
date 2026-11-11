import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const betaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export default defineConfig({
  root: betaRoot,
  test: {
    include: ["tests/cutover/alias/**/*.test.ts"],
    fileParallelism: false,
  },
});
