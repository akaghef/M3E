import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    outDir: "dist/browser",
    rollupOptions: {
      input: "src/browser/workbench-ui.tsx",
      output: {
        entryFileNames: "workbench-ui.js",
        assetFileNames: "workbench-ui.css",
      },
    },
  },
});
