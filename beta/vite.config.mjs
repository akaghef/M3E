import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export default defineConfig({
  cacheDir: "../tmp/vite-cache",
  plugins: [
    react(),
    {
      name: "agent-node-icon-import-gate",
      buildStart() {
        execFileSync("python3", [path.resolve(process.cwd(), "../scripts/ops/check-agent-node-icons.py")], { stdio: "inherit" });
      },
      handleHotUpdate(context) {
        if (/[/\\]labs[/\\]node[/\\](pets[/\\]|pet_catalog\.json)/.test(context.file)) {
          execFileSync("python3", [path.resolve(process.cwd(), "../scripts/ops/check-agent-node-icons.py")], { stdio: "inherit" });
        }
      },
    },
    {
      name: "m3e-static-viewer-css",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/") {
            req.url = "/src/labs/index.html";
          }
          next();
        });

        server.middlewares.use("/agent-node-session.local.json", (_req, res) => {
          const local = path.resolve(process.cwd(), "agent-node-session.local.json");
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(fs.existsSync(local) ? fs.readFileSync(local) : "null");
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
        "node-draw-lab": "src/labs/node-draw/node-lab.html",
        "pn-lab": "src/labs/pn/pn-lab.html",
        "runtime-board": "src/labs/runtime-board/runtime-board.html",
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || "";
          if (!name.endsWith(".css")) return "assets/[name]-[hash][extname]";
          if (name.includes("node-draw-lab")) return "node-draw-lab.css";
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
