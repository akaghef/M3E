import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "m3e-static-viewer-css",
      configureServer(server) {
        server.middlewares.use("/viewer.css", (_req, res) => {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
          fs.createReadStream(path.resolve(process.cwd(), "viewer.css")).pipe(res);
        });
      },
    },
  ],
  build: {
    emptyOutDir: false,
    outDir: "dist/browser",
    rollupOptions: {
      input: {
        viewer: "src/browser/viewer.ts",
        "workbench-ui": "src/browser/workbench-ui.tsx",
        "layout-lab": "src/labs/layout/layout-lab.html",
        "edge-port-lab": "src/labs/edge-port/edge-port-lab.html",
        "node-lab": "src/labs/node/node-lab.html",
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || "";
          if (name.includes("edge-port-lab")) return "edge-port-lab.css";
          if (name.includes("node-lab")) return "node-lab.css";
          return name.includes("layout-lab") ? "layout-lab.css" : "workbench-ui.css";
        },
      },
    },
  },
});
