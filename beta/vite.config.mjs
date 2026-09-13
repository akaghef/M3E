import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

export default defineConfig({
  cacheDir: "../tmp/vite-cache",
  plugins: [
    react(),
    {
      name: "m3e-static-viewer-css",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/") {
            req.url = "/src/labs/index.html";
          }
          next();
        });

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
        "seam-lab-index": "src/labs/index.html",
        "layout-lab": "src/labs/layout/layout-lab.html",
        "edge-port-lab": "src/labs/edge-port/edge-port-lab.html",
        "node-lab": "src/labs/node/node-lab.html",
        "pn-lab": "src/labs/pn/pn-lab.html",
        "runtime-board": "src/labs/runtime-board/runtime-board.html",
        "ot-deck-lab": "src/labs/ot/routes/deck.html",
        "ot-network-lab": "src/labs/ot/routes/network.html",
        "ot-detail-lab": "src/labs/ot/routes/detail.html",
        "ot-edge-lab": "src/labs/ot/routes/edge.html",
        "ot-mail-lab": "src/labs/ot/routes/mail.html",
        "ot-replay-lab": "src/labs/ot/routes/replay.html",
        "ot-runtime-lab": "src/labs/ot/routes/runtime.html",
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || "";
          if (name.includes("edge-port-lab")) return "edge-port-lab.css";
          if (name.includes("node-lab")) return "node-lab.css";
          if (name.includes("pn-lab")) return "pn-lab.css";
          if (name.includes("runtime-board")) return "runtime-board.css";
          return name.includes("layout-lab") ? "layout-lab.css" : "workbench-ui.css";
        },
      },
    },
  },
});
