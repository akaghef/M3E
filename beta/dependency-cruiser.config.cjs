module.exports = {
  forbidden: [
    {
      name: "no-layout-internal-imports",
      severity: "error",
      from: { path: "^src/(browser|labs|shared)" },
      to: {
        path: "^src/shared/layout_.*",
        pathNot: "^src/shared/layout_port\\.ts$",
      },
    },
    {
      name: "labs-must-not-import-browser-implementation",
      severity: "error",
      from: { path: "^src/labs/" },
      to: { path: "^src/browser/" },
    },
    {
      name: "labs-use-shared-layout-port-only",
      severity: "error",
      from: { path: "^src/labs/layout/" },
      to: {
        path: "^src/shared/(?!layout_port\\.ts$)",
      },
    },
    {
      name: "edge-port-lab-must-not-import-browser-implementation",
      severity: "error",
      from: { path: "^src/labs/edge-port/" },
      to: { path: "^src/browser/" },
    },
    {
      name: "parent-child-edge-must-not-import-graphlink-endpoint-edit",
      severity: "error",
      from: { path: "^src/shared/parent_child_edge_adapter\\.ts$" },
      to: { path: "src/browser/edge_adapters/graphlink_endpoint_edit\\.ts$" },
    },
    {
      name: "shared-edge-port-must-not-import-browser",
      severity: "error",
      from: { path: "^src/shared/edge_(port|route)\\.ts$" },
      to: { path: "^src/browser/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: {
      path: "^(dist|node_modules|tests/fixtures)/",
    },
    tsConfig: {
      fileName: "tsconfig.layout.json",
    },
  },
};
