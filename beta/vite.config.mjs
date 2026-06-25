import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    outDir: "dist/browser",
    rollupOptions: {
      input: {
        viewer: "src/browser/viewer.ts",
        "workbench-ui": "src/browser/workbench-ui.tsx",
        "layout-lab": "src/labs/layout/layout-lab.html",
        "edge-port-lab": "src/labs/edge-port/edge-port-lab.html",
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || "";
          if (name.includes("edge-port-lab")) return "edge-port-lab.css";
          return name.includes("layout-lab") ? "layout-lab.css" : "workbench-ui.css";
        },
      },
    },
  },
});
